import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { generateProposalPdf } from '../services/pdf';

export const estimatesRouter = Router();

estimatesRouter.get('/', async (req, res) => {
  try {
    const { job_id, status, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = { deleted_at: null };
    if (job_id) where.job_id = job_id;
    if (status) where.status = status;

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({ where, skip, take: parseInt(limit), orderBy: { created_at: 'desc' } }),
      prisma.estimate.count({ where }),
    ]);
    res.json({ data: estimates, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch estimates' });
  }
});

estimatesRouter.post('/', async (req, res) => {
  try {
    const settings = await prisma.companySettings.findFirst();
    const prefix = settings?.estimate_prefix || 'EST';
    const count = await prisma.estimate.count();
    const estimate_number = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const estimate = await prisma.estimate.create({
      data: { ...req.body, estimate_number },
    });
    res.status(201).json({ data: estimate });
  } catch {
    res.status(500).json({ error: 'Failed to create estimate' });
  }
});

estimatesRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const estimate = await prisma.estimate.update({ where: { id: req.params.id }, data });
    res.json({ data: estimate });
  } catch {
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

estimatesRouter.post('/:id/send', async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { id: req.params.id },
      include: { job: { include: { customer: true } }, tax_profile: true },
    });
    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const approvalUrl = `${process.env.APP_URL}/approve/${token}`;

    // Generate proposal PDF
    const settings = await prisma.companySettings.findFirst();
    const lineItems = estimate.line_items as Array<{
      description: string;
      type: string;
      qty: number;
      unit: string;
      unit_price: number;
      taxable: boolean;
    }>;

    const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

    // Send email with approval link
    const customerEmail = estimate.job?.customer.email;
    if (customerEmail) {
      await sendEmail({
        to: customerEmail,
        subject: `Estimate ${estimate.estimate_number} from ${settings?.company_name || 'BrushPro'}`,
        html: `
          <p>Dear ${estimate.job?.customer.name},</p>
          <p>Please review and approve your estimate for ${estimate.job?.address}.</p>
          <p><strong>Estimate #:</strong> ${estimate.estimate_number}</p>
          <p><strong>Total:</strong> $${total.toFixed(2)}</p>
          <p><a href="${approvalUrl}" style="background:#007AFF;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Review &amp; Approve</a></p>
          <p>This link expires in 30 days.</p>
          <p>${settings?.company_name || ''}</p>
        `,
      });
    }

    const updated = await prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        status: 'SENT',
        approval_token: token,
        approval_token_expires_at: expiresAt,
        sent_at: new Date(),
      },
    });

    res.json({ data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send estimate' });
  }
});

estimatesRouter.post('/:id/convert', async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
    if (!estimate || estimate.status !== 'APPROVED') {
      res.status(400).json({ error: 'Only approved estimates can be converted' });
      return;
    }
    if (!estimate.job_id) {
      res.status(400).json({ error: 'Estimate must be linked to a job before converting to invoice' });
      return;
    }
    if (!estimate.tax_profile_id) {
      res.status(400).json({ error: 'Estimate must have a tax profile before converting to invoice' });
      return;
    }

    const settings = await prisma.companySettings.findFirst();
    const prefix = settings?.invoice_prefix || 'INV';
    const count = await prisma.invoice.count();
    const invoice_number = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        job_id: estimate.job_id,
        estimate_id: estimate.id,
        invoice_number,
        type: 'FINAL',
        line_items: estimate.line_items as any,
        tax_profile_id: estimate.tax_profile_id,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ data: invoice });
  } catch {
    res.status(500).json({ error: 'Failed to convert estimate to invoice' });
  }
});

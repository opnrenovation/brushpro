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

    // Auto-resolve tax_profile_id if not provided
    let { tax_profile_id } = req.body;
    if (!tax_profile_id) {
      // Try to match by job's municipality first
      const job_id = req.body.job_id;
      let profile = null;
      if (job_id) {
        const job = await prisma.job.findUnique({ where: { id: job_id } });
        if (job?.municipality) {
          profile = await prisma.taxProfile.findFirst({
            where: { municipality: { equals: job.municipality, mode: 'insensitive' } },
          });
        }
      }
      if (!profile) profile = await prisma.taxProfile.findFirst({ where: { is_default: true } });
      if (!profile) profile = await prisma.taxProfile.findFirst();
      if (!profile) {
        profile = await prisma.taxProfile.create({
          data: {
            name: 'Iowa Standard',
            state_code: 'IA',
            state_rate: 0.06,
            local_rate: 0.01,
            municipality: 'Des Moines',
            taxable_labor: false,
            is_default: true,
          },
        });
      }
      tax_profile_id = profile.id;
    }

    const estimate = await prisma.estimate.create({
      data: { ...req.body, tax_profile_id, estimate_number },
    });
    res.status(201).json({ data: estimate });
  } catch (err) {
    console.error('Failed to create estimate:', err);
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

estimatesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.estimate.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete estimate' });
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

    // Generate proposal PDF
    const settings = await prisma.companySettings.findFirst();

    const token = uuidv4();
    const expiryDays = settings?.estimate_expiry_days ?? 30;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const approvalUrl = `${process.env.APP_URL}/approve/${token}`;
    const lineItems = estimate.line_items as Array<{
      description: string;
      type: string;
      qty: number;
      unit: string;
      unit_price: number;
      taxable: boolean;
    }>;

    const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

    // Update estimate to SENT first — email is best-effort
    const updated = await prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        status: 'SENT',
        approval_token: token,
        approval_token_expires_at: expiresAt,
        sent_at: new Date(),
      },
    });

    // Try to email customer — non-fatal so approval link is always generated
    let email_sent = false;
    const customerEmail = estimate.job?.customer.email;
    if (customerEmail) {
      try {
        const emailData = await sendEmail({
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
          tags: [{ name: 'estimate_id', value: estimate.id }],
        });
        email_sent = true;
        if (emailData?.id) {
          await prisma.estimate.update({
            where: { id: estimate.id },
            data: { resend_email_id: emailData.id },
          });
        }
      } catch (emailErr) {
        console.error('Email send failed (non-fatal):', emailErr);
      }
    }

    res.json({ data: updated, approval_url: approvalUrl, email_sent });
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

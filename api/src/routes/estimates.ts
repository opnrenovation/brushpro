import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { sendEmail, COMPANY_BCC } from '../lib/resend';
import { generateProposalPdf } from '../services/pdf';
import { computeInvoiceTotals } from '../lib/invoiceTotals';

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

    // Find the highest number currently in use so we never collide
    const maxRow = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART(estimate_number, '-', 2) AS INTEGER)) AS max
      FROM "estimates"
      WHERE estimate_number ~ '^[A-Z]+-[0-9]+$'
    `;
    const maxUsed = maxRow[0]?.max ?? 0;
    let nextNum = Math.max(
      settings?.next_estimate_number ?? 1,
      maxUsed + 1,
    );
    const estimate_number = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { next_estimate_number: nextNum + 1 },
      });
    }

    // Auto-resolve tax_profile_id if not provided
    let { tax_profile_id } = req.body;
    if (!tax_profile_id) {
      // Try to match by job's municipality first
      const job_id = req.body.job_id;
      let profile: { id: string } | null = null;
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

    // Tax-inclusive total so the emailed figure matches the approval page the
    // customer opens (which also adds tax). Estimates carry no discount.
    const { total } = computeInvoiceTotals({
      line_items: lineItems,
      state_rate: Number(estimate.tax_profile.state_rate),
      local_rate: Number(estimate.tax_profile.local_rate),
    });

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

    // Generate proposal PDF (non-fatal)
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateProposalPdf({
        estimate_number: estimate.estimate_number,
        estimate_date: estimate.created_at.toISOString(),
        job_address: estimate.job?.address || '',
        customer_name: estimate.job?.customer?.name ?? undefined,
        customer_email: estimate.job?.customer?.email ?? undefined,
        notes: (estimate as any).notes ?? undefined,
        disclaimer: settings?.disclaimer ?? undefined,
        total_price: total,
        company_name: settings?.company_name || 'OPN Renovation',
        company_address: settings?.address ?? undefined,
        company_phone: settings?.phone ?? undefined,
        company_email: settings?.email ?? undefined,
        logo_url: settings?.logo_url ?? undefined,
        approval_url: approvalUrl,
        expiry_date: expiresAt.toISOString(),
      });
    } catch (pdfErr) {
      console.error('Proposal PDF generation failed (non-fatal):', pdfErr);
    }

    // Try to email customer — non-fatal so approval link is always generated
    let email_sent = false;
    const customerEmail = estimate.job?.customer.email;
    if (customerEmail) {
      try {
        const emailData = await sendEmail({
          to: customerEmail,
          bcc: COMPANY_BCC,
          subject: `Estimate ${estimate.estimate_number} from ${settings?.company_name || 'BrushPro'}`,
          html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#007AFF;padding:24px 32px;border-radius:12px 12px 0 0">
    <img src="https://www.opnrenovation.com/opn-logo-white.png" alt="${settings?.company_name || 'OPN Renovation'}" width="96" height="96" style="display:block;margin-bottom:10px" />
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">${settings?.company_name || 'OPN Renovation'}</p>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Estimate ${estimate.estimate_number}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 8px">Dear ${estimate.job?.customer.name},</p>
    <p style="color:#555;margin:0 0 24px">Please review and approve your estimate for ${estimate.job?.address}.</p>
    <p style="margin:0 0 8px"><strong>Estimate #:</strong> ${estimate.estimate_number}</p>
    <p style="margin:0 0 24px"><strong>Total:</strong> $${total.toFixed(2)}</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${approvalUrl}" style="background:#007AFF;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;display:inline-block;font-weight:600;font-size:16px">Review &amp; Approve</a>
    </div>
    <p style="color:#666;font-size:13px;margin:0 0 16px">This link expires in ${expiryDays} days. Your estimate is also attached as a PDF.</p>
    <p style="color:#aaa;font-size:12px;margin:0">${settings?.company_name || 'OPN Renovation'}${settings?.phone ? ` · ${settings.phone}` : ''}${settings?.email ? ` · ${settings.email}` : ''}</p>
  </div>
</div>`,
          attachments: pdfBuffer ? [{ filename: `Estimate-${estimate.estimate_number}.pdf`, content: pdfBuffer }] : undefined,
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

    const maxInvRow = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER)) AS max
      FROM "invoices"
      WHERE invoice_number ~ '^[A-Z]+-[0-9]+$'
    `;
    const maxInvUsed = maxInvRow[0]?.max ?? 0;
    const nextNum = Math.max(settings?.next_invoice_number ?? 1, maxInvUsed + 1);
    const invoice_number = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { next_invoice_number: nextNum + 1 },
      });
    }

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

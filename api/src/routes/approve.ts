import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { uploadFile } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const approveRouter = Router();

approveRouter.get('/:token', async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: {
        job: { include: { customer: true } },
        tax_profile: true,
        contract_template: true,
      },
    });

    if (!estimate) {
      res.status(404).json({ message: 'Estimate not found' });
      return;
    }
    if (estimate.approval_token_expires_at && estimate.approval_token_expires_at < new Date()) {
      res.status(410).json({ message: 'This approval link has expired. Please contact us for a new one.' });
      return;
    }
    if (estimate.status !== 'SENT') {
      const msg =
        estimate.status === 'APPROVED'
          ? 'This estimate has already been approved. Thank you!'
          : estimate.status === 'REJECTED'
          ? 'This estimate was declined.'
          : estimate.status === 'EXPIRED'
          ? 'This estimate has expired. Please contact us.'
          : `This estimate is no longer available (${estimate.status.toLowerCase()}).`;
      res.status(400).json({ message: msg });
      return;
    }

    const settings = await prisma.companySettings.findFirst();
    const lineItems = estimate.line_items as Array<{
      description: string;
      qty: number;
      unit_price: number;
      taxable: boolean;
    }>;

    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const taxProfile = estimate.tax_profile;
    const taxRate = job_tax_exempt(estimate)
      ? 0
      : Number(taxProfile?.state_rate ?? 0) + Number(taxProfile?.local_rate ?? 0);
    const taxableSubtotal = lineItems
      .filter(li => li.taxable)
      .reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const taxAmount = job_tax_exempt(estimate) ? 0 : taxableSubtotal * taxRate;
    const total = subtotal + taxAmount;

    // Build scope of work text for contract substitution
    const scopeLines = lineItems
      .map(li => `  - ${li.description} (${li.qty} × $${li.unit_price.toFixed(2)})`)
      .join('\n');

    // Resolve contract template: use linked one, else default
    const template =
      estimate.contract_template ||
      (await prisma.contractTemplate.findFirst({ where: { is_default: true } })) ||
      (await prisma.contractTemplate.findFirst());

    const deposit = settings?.deposit_required
      ? (subtotal * Number(settings?.deposit_percentage ?? 30)) / 100
      : 0;

    const contractBody = template
      ? template.body_text
          .replace(/{customer_name}/g, estimate.job?.customer.name ?? '')
          .replace(/{job_address}/g, estimate.job?.address ?? '')
          .replace(/{total_price}/g, `$${total.toFixed(2)}`)
          .replace(/{deposit_amount}/g, `$${deposit.toFixed(2)}`)
          .replace(/{company_name}/g, settings?.company_name ?? 'Service Provider')
          .replace(/{estimate_number}/g, estimate.estimate_number)
          .replace(/{payment_terms}/g, String(settings?.payment_terms_days ?? 7))
          .replace(/{date}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
          .replace(/{scope_of_work}/g, scopeLines)
      : '';

    res.json({
      estimate_number: estimate.estimate_number,
      customer_name: estimate.job?.customer.name ?? '',
      job_address: estimate.job?.address ?? '',
      line_items: lineItems.map(li => ({
        description: li.description,
        qty: li.qty,
        unit_price: li.unit_price,
        taxable: li.taxable,
      })),
      subtotal,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      total,
      tax_exempt: job_tax_exempt(estimate),
      notes: estimate.notes ?? null,
      company_name: settings?.company_name ?? '',
      company_logo: settings?.logo_url ?? null,
      contract_body: contractBody,
      status: estimate.status,
    });
  } catch {
    res.status(500).json({ message: 'Failed to load estimate' });
  }
});

function job_tax_exempt(estimate: { job?: { tax_exempt?: boolean } | null }): boolean {
  return estimate.job?.tax_exempt ?? false;
}

approveRouter.post('/:token/sign', async (req, res) => {
  try {
    const { signature_png, customer_name, sign_method, paint_codes, client_notes } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: { job: { include: { customer: true } }, contract_template: true },
    });

    if (!estimate || estimate.status !== 'SENT') {
      res.status(400).json({ message: 'Invalid or expired approval link' });
      return;
    }

    if (!estimate.job_id) {
      res.status(400).json({ message: 'Estimate must be linked to a job before signing' });
      return;
    }

    // Handle signature storage
    let signature_url: string | null = null;
    if (sign_method === 'pad' && signature_png) {
      try {
        const sigBuffer = Buffer.from(
          signature_png.replace(/^data:image\/png;base64,/, ''),
          'base64'
        );
        const sigPath = `sig-${estimate.id}-${uuidv4()}.png`;
        signature_url = await uploadFile(
          process.env.STORAGE_BUCKET_CONTRACTS!,
          sigPath,
          sigBuffer,
          'image/png'
        );
      } catch {
        // Storage not configured — store data URL directly
        signature_url = signature_png;
      }
    }

    const settings = await prisma.companySettings.findFirst();
    const lineItems = estimate.line_items as Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

    // Build rendered contract body
    const template =
      estimate.contract_template ||
      (await prisma.contractTemplate.findFirst({ where: { is_default: true } })) ||
      (await prisma.contractTemplate.findFirst());

    const scopeLines = lineItems
      .map(li => `  - ${li.description} (${li.qty} × $${li.unit_price.toFixed(2)})`)
      .join('\n');
    const deposit = settings?.deposit_required
      ? (subtotal * Number(settings?.deposit_percentage ?? 30)) / 100
      : 0;
    const taxProfile = await prisma.taxProfile.findUnique({ where: { id: estimate.tax_profile_id } });
    const taxRate = job_tax_exempt(estimate)
      ? 0
      : Number(taxProfile?.state_rate ?? 0) + Number(taxProfile?.local_rate ?? 0);
    const taxAmount = job_tax_exempt(estimate)
      ? 0
      : lineItems.filter(li => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0) * taxRate;
    const total = subtotal + taxAmount;

    const body_text = template
      ? template.body_text
          .replace(/{customer_name}/g, estimate.job?.customer.name ?? '')
          .replace(/{job_address}/g, estimate.job?.address ?? '')
          .replace(/{total_price}/g, `$${total.toFixed(2)}`)
          .replace(/{deposit_amount}/g, `$${deposit.toFixed(2)}`)
          .replace(/{company_name}/g, settings?.company_name ?? 'Service Provider')
          .replace(/{estimate_number}/g, estimate.estimate_number)
          .replace(/{payment_terms}/g, String(settings?.payment_terms_days ?? 7))
          .replace(/{date}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
          .replace(/{scope_of_work}/g, scopeLines)
      : '';

    const contract = await prisma.contract.create({
      data: {
        estimate_id: estimate.id,
        job_id: estimate.job_id,
        contract_template_id: template?.id ?? null,
        body_text,
        status: 'SIGNED',
        customer_name_signed: customer_name?.trim() ?? null,
        signature_url,
        ip_address: ip,
        signed_at: new Date(),
      },
    });

    // Save client-provided data back to estimate
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        status: 'APPROVED',
        approved_at: new Date(),
        paint_codes: paint_codes ?? undefined,
        client_notes: client_notes?.trim() || null,
      },
    });

    // Advance job from ESTIMATING → ACTIVE
    await prisma.job.updateMany({
      where: { id: estimate.job_id, status: 'ESTIMATING' },
      data: { status: 'ACTIVE' },
    });

    // Notify owner
    if (settings?.email) {
      const paintInfo =
        Array.isArray(paint_codes) && paint_codes.length > 0
          ? `<p><strong>Paint Colors:</strong> ${(paint_codes as { name: string; code: string }[]).map(p => `${p.name} (${p.code})`).join(', ')}</p>`
          : '';
      const notesInfo = client_notes?.trim()
        ? `<p><strong>Client Notes:</strong> ${client_notes.trim()}</p>`
        : '';
      await sendEmail({
        to: settings.email,
        subject: `Agreement signed — Estimate ${estimate.estimate_number}`,
        html: `
          <p><strong>${customer_name}</strong> signed the service agreement for estimate <strong>${estimate.estimate_number}</strong> at ${estimate.job?.address}.</p>
          ${paintInfo}
          ${notesInfo}
        `,
      });
    }

    res.json({ data: { status: 'SIGNED', contract_id: contract.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to process signature' });
  }
});

approveRouter.post('/:token/decline', async (req, res) => {
  try {
    const { note } = req.body;
    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: { job: { include: { customer: true } } },
    });

    if (!estimate || estimate.status !== 'SENT') {
      res.status(400).json({ message: 'Invalid or expired approval link' });
      return;
    }

    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'REJECTED', rejected_at: new Date(), rejection_note: note || null },
    });

    const settings = await prisma.companySettings.findFirst();
    if (settings?.email) {
      await sendEmail({
        to: settings.email,
        subject: `Estimate ${estimate.estimate_number} was declined`,
        html: `<p>${estimate.job?.customer.name} declined estimate ${estimate.estimate_number} for ${estimate.job?.address}${note ? `<br>Reason: "${note}"` : '.'}</p>`,
      });
    }

    res.json({ data: { status: 'REJECTED' } });
  } catch {
    res.status(500).json({ message: 'Failed to process decline' });
  }
});

// Keep old endpoints for backwards compatibility
approveRouter.post('/:token/approve', async (req, res) => {
  res.redirect(307, `/${req.params.token}/sign`);
});

approveRouter.post('/:token/reject', async (req, res) => {
  req.url = `/${req.params.token}/decline`;
  res.redirect(307, req.url);
});

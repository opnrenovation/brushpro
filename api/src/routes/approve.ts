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
      include: { job: { include: { customer: true } }, tax_profile: true },
    });

    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }
    if (estimate.approval_token_expires_at && estimate.approval_token_expires_at < new Date()) {
      res.status(410).json({ error: 'Approval link has expired' });
      return;
    }
    if (estimate.status !== 'SENT') {
      res.status(400).json({ error: `Estimate is already ${estimate.status.toLowerCase()}` });
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

    // Return only customer-safe data — no our_cost
    res.json({
      data: {
        estimate_number: estimate.estimate_number,
        job_address: estimate.job.address,
        notes: estimate.notes,
        total_price: subtotal,
        company_name: settings?.company_name,
        logo_url: settings?.logo_url,
        status: estimate.status,
        has_contract_template: !!settings?.contract_template,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load estimate' });
  }
});

approveRouter.post('/:token/approve', async (req, res) => {
  try {
    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: { job: { include: { customer: true } } },
    });

    if (!estimate || estimate.status !== 'SENT') {
      res.status(400).json({ error: 'Invalid or expired approval link' });
      return;
    }

    const settings = await prisma.companySettings.findFirst();

    if (settings?.contract_template) {
      // Proceed to contract signing — return contract body
      const lineItems = estimate.line_items as Array<{ qty: number; unit_price: number }>;
      const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

      const body = (settings.contract_template || '')
        .replace(/{customer_name}/g, estimate.job.customer.name)
        .replace(/{job_address}/g, estimate.job.address)
        .replace(/{total_price}/g, `$${total.toFixed(2)}`)
        .replace(/{company_name}/g, settings.company_name)
        .replace(/{estimate_number}/g, estimate.estimate_number)
        .replace(/{date}/g, new Date().toLocaleDateString());

      res.json({ data: { requires_signature: true, contract_body: body } });
    } else {
      // No contract template — approve immediately
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: { status: 'APPROVED', approved_at: new Date() },
      });

      // Notify owner
      if (settings?.email) {
        await sendEmail({
          to: settings.email,
          subject: `Estimate ${estimate.estimate_number} has been approved`,
          html: `<p>${estimate.job.customer.name} has approved estimate ${estimate.estimate_number} for ${estimate.job.address}.</p>`,
        });
      }

      res.json({ data: { requires_signature: false, status: 'APPROVED' } });
    }
  } catch {
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

approveRouter.post('/:token/reject', async (req, res) => {
  try {
    const { note } = req.body;
    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: { job: { include: { customer: true } } },
    });

    if (!estimate || estimate.status !== 'SENT') {
      res.status(400).json({ error: 'Invalid or expired approval link' });
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
        html: `<p>${estimate.job.customer.name} declined estimate ${estimate.estimate_number}${note ? `: "${note}"` : '.'}</p>`,
      });
    }

    res.json({ data: { status: 'REJECTED' } });
  } catch {
    res.status(500).json({ error: 'Failed to process rejection' });
  }
});

approveRouter.post('/:token/sign', async (req, res) => {
  try {
    const { signature_png_base64, customer_name_signed } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const estimate = await prisma.estimate.findUnique({
      where: { approval_token: req.params.token },
      include: { job: { include: { customer: true } } },
    });

    if (!estimate || estimate.status !== 'SENT') {
      res.status(400).json({ error: 'Invalid or expired approval link' });
      return;
    }

    // Upload signature PNG
    const sigBuffer = Buffer.from(signature_png_base64.replace(/^data:image\/png;base64,/, ''), 'base64');
    const sigPath = `sig-${estimate.id}-${uuidv4()}.png`;
    const signature_url = await uploadFile(
      process.env.STORAGE_BUCKET_CONTRACTS!,
      sigPath,
      sigBuffer,
      'image/png'
    );

    const settings = await prisma.companySettings.findFirst();
    const lineItems = estimate.line_items as Array<{ qty: number; unit_price: number }>;
    const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);

    const body_text = (settings?.contract_template || '')
      .replace(/{customer_name}/g, estimate.job.customer.name)
      .replace(/{job_address}/g, estimate.job.address)
      .replace(/{total_price}/g, `$${total.toFixed(2)}`)
      .replace(/{company_name}/g, settings?.company_name || '')
      .replace(/{estimate_number}/g, estimate.estimate_number)
      .replace(/{date}/g, new Date().toLocaleDateString());

    const contract = await prisma.contract.create({
      data: {
        estimate_id: estimate.id,
        job_id: estimate.job_id,
        body_text,
        status: 'SIGNED',
        customer_name_signed,
        signature_url,
        ip_address: ip,
        signed_at: new Date(),
      },
    });

    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'APPROVED', approved_at: new Date() },
    });

    // Notify owner
    if (settings?.email) {
      await sendEmail({
        to: settings.email,
        subject: `Contract signed — Estimate ${estimate.estimate_number}`,
        html: `<p>${customer_name_signed} signed the contract for estimate ${estimate.estimate_number} at ${estimate.job.address}.</p>`,
      });
    }

    res.json({ data: { status: 'SIGNED', contract_id: contract.id } });
  } catch {
    res.status(500).json({ error: 'Failed to process signature' });
  }
});

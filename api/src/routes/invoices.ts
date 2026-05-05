import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { generateInvoicePdf } from '../lib/invoicePdf';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set.');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

export const invoicesRouter = Router();

function calcDiscount(subtotal: number, type: string | null, value: unknown): number {
  if (!type || type === 'NONE' || !value) return 0;
  const v = Number(value);
  if (type === 'PERCENT') return subtotal * (v / 100);
  if (type === 'FIXED') return Math.min(v, subtotal);
  return 0;
}

invoicesRouter.get('/', async (req, res) => {
  try {
    const { status, job_id, start, end, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = { deleted_at: null };
    if (status) where.status = status;
    if (job_id) where.job_id = job_id;
    if (start || end) {
      where.created_at = {};
      if (start) (where.created_at as Record<string, unknown>).gte = new Date(start);
      if (end) (where.created_at as Record<string, unknown>).lte = new Date(end);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { payments: true, tax_profile: true, job: { include: { customer: true } }, customer: true },
      }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ data: invoices, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

invoicesRouter.post('/', async (req, res) => {
  try {
    const settings = await prisma.companySettings.findFirst();
    const prefix = settings?.invoice_prefix || 'INV';
    const count = await prisma.invoice.count();
    const invoice_number = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: { ...req.body, invoice_number },
    });
    res.status(201).json({ data: invoice });
  } catch {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

invoicesRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data });
    res.json({ data: invoice });
  } catch {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

invoicesRouter.post('/:id/send', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        job: { include: { customer: true } },
        customer: true,
        tax_profile: true,
        payments: true,
      },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Resolve recipient — job customer takes priority, then direct customer
    const recipient = invoice.job?.customer ?? invoice.customer;
    const settings = await prisma.companySettings.findFirst();
    const lineItems = invoice.line_items as Array<{
      description: string;
      qty: number;
      unit_price: number;
      taxable: boolean;
    }>;

    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const discountAmt = calcDiscount(subtotal, invoice.discount_type, invoice.discount_value);
    const discountedSubtotal = subtotal - discountAmt;
    const taxableRaw = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
    const taxableAmount = discountedSubtotal * taxableFraction;
    const stateTax = taxableAmount * Number(invoice.tax_profile.state_rate);
    const localTax = taxableAmount * Number(invoice.tax_profile.local_rate);
    const total = discountedSubtotal + stateTax + localTax;

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const payUrl = `${appUrl}/invoices/${invoice.id}`;

    // Generate PDF attachment
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateInvoicePdf(
        {
          invoice_number: invoice.invoice_number,
          type: invoice.type,
          status: invoice.status,
          due_date: invoice.due_date.toISOString(),
          notes: invoice.notes ?? undefined,
          tax_profile: { state_rate: Number(invoice.tax_profile.state_rate), local_rate: Number(invoice.tax_profile.local_rate), name: invoice.tax_profile.name },
          discount_type: invoice.discount_type,
          discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
          line_items: lineItems,
          payments: invoice.payments.map(p => ({ amount: Number(p.amount), method: p.method, paid_at: p.paid_at.toISOString() })),
          job: invoice.job ? { address: invoice.job.address ?? undefined, name: invoice.job.name ?? undefined, customer: invoice.job.customer ? { name: invoice.job.customer.name ?? undefined, email: invoice.job.customer.email ?? undefined } : undefined } : null,
          customer: invoice.customer ? { name: invoice.customer.name ?? undefined, email: invoice.customer.email ?? undefined } : null,
        },
        { company_name: settings?.company_name, phone: settings?.phone ?? undefined, email: settings?.email ?? undefined },
        payUrl,
      );
    } catch (pdfErr) {
      console.error('PDF generation failed (non-fatal):', pdfErr);
    }

    if (recipient?.email) {
      const lineItemRows = lineItems
        .map((li) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${li.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${li.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${li.unit_price.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(li.qty * li.unit_price).toFixed(2)}</td></tr>`)
        .join('');
      const forLine = invoice.job?.address ? `for work at <strong>${invoice.job.address}</strong>` : '';

      await sendEmail({
        to: recipient.email,
        subject: `Invoice ${invoice.invoice_number} — ${settings?.company_name || 'OPN Renovation'}`,
        html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#007AFF;padding:24px 32px;border-radius:12px 12px 0 0">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">${settings?.company_name || 'OPN Renovation'}</p>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 8px">Dear ${recipient.name},</p>
    <p style="color:#555;margin:0 0 24px">Please find your invoice ${forLine} attached below.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <thead>
        <tr style="background:#f9f9f9">
          <th style="padding:8px;text-align:left;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Description</th>
          <th style="padding:8px;text-align:center;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Qty</th>
          <th style="padding:8px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Price</th>
          <th style="padding:8px;text-align:right;font-size:12px;color:#888;font-weight:600;text-transform:uppercase">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemRows}</tbody>
    </table>

    <table style="margin-left:auto;margin-bottom:24px;min-width:220px">
      <tr><td style="padding:4px 0;color:#666;font-size:14px">Subtotal</td><td style="padding:4px 0 4px 24px;text-align:right;font-size:14px">$${subtotal.toFixed(2)}</td></tr>
      ${discountAmt > 0 ? `<tr><td style="padding:4px 0;color:#16a34a;font-size:14px">Discount</td><td style="padding:4px 0 4px 24px;text-align:right;font-size:14px;color:#16a34a">-$${discountAmt.toFixed(2)}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#666;font-size:14px">State Tax (${(Number(invoice.tax_profile.state_rate) * 100).toFixed(2)}%)</td><td style="padding:4px 0 4px 24px;text-align:right;font-size:14px">$${stateTax.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;font-size:14px">Local Tax (${(Number(invoice.tax_profile.local_rate) * 100).toFixed(2)}%)</td><td style="padding:4px 0 4px 24px;text-align:right;font-size:14px">$${localTax.toFixed(2)}</td></tr>
      <tr style="border-top:2px solid #111"><td style="padding:8px 0 0;font-weight:700;font-size:16px">Total Due</td><td style="padding:8px 0 0 24px;text-align:right;font-weight:700;font-size:16px">$${total.toFixed(2)}</td></tr>
    </table>

    <p style="color:#666;font-size:14px;margin-bottom:24px">Due by: <strong>${new Date(invoice.due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>

    <div style="text-align:center;margin-bottom:24px">
      <a href="${payUrl}" style="display:inline-block;background:#007AFF;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none">View &amp; Pay Invoice</a>
    </div>

    ${settings?.invoice_notes ? `<p style="color:#666;font-size:13px;border-top:1px solid #eee;padding-top:16px">${settings.invoice_notes}</p>` : ''}
    <p style="color:#aaa;font-size:12px;margin-top:16px">${settings?.company_name || 'OPN Renovation'}${settings?.phone ? ` · ${settings.phone}` : ''}${settings?.email ? ` · ${settings.email}` : ''}</p>
  </div>
</div>`,
        attachments: pdfBuffer ? [{ filename: `Invoice-${invoice.invoice_number}.pdf`, content: pdfBuffer }] : undefined,
      });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'SENT', sent_at: new Date() },
    });

    res.json({ data: { sent: true } });
  } catch {
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

invoicesRouter.post('/:id/payments', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { payments: true },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const payment = await prisma.payment.create({
      data: { invoice_id: invoice.id, ...req.body },
    });

    // Update invoice status
    const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
    const sub = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const disc = calcDiscount(sub, invoice.discount_type, invoice.discount_value);
    const total = sub - disc;
    const totalPaid = [...invoice.payments, payment].reduce((s, p) => s + Number(p.amount), 0);

    let status: string;
    if (totalPaid >= total) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    else status = invoice.status;

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: status as 'PAID' | 'PARTIAL' } });
    res.status(201).json({ data: payment });
  } catch {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

invoicesRouter.delete('/:id/payments/:paymentId', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { payments: true },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await prisma.payment.delete({ where: { id: req.params.paymentId } });

    const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number }>;
    const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const remaining = invoice.payments.filter(p => p.id !== req.params.paymentId);
    const totalPaid = remaining.reduce((s, p) => s + Number(p.amount), 0);

    let status: string;
    if (totalPaid >= total) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    else status = 'SENT';

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: status as 'PAID' | 'PARTIAL' | 'SENT' } });
    res.json({ data: { deleted: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

invoicesRouter.post('/:id/stripe-link', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { job: { include: { customer: true } }, tax_profile: true, payments: true },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const lineItems = invoice.line_items as Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const discountAmt = calcDiscount(subtotal, invoice.discount_type, invoice.discount_value);
    const discountedSubtotal = subtotal - discountAmt;
    const taxableRaw = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
    const tax = discountedSubtotal * taxableFraction * (Number(invoice.tax_profile.state_rate) + Number(invoice.tax_profile.local_rate));
    const total = discountedSubtotal + tax;
    const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const amountDue = Math.round((total - alreadyPaid) * 100); // cents

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountDue,
            product_data: { name: `Invoice ${invoice.invoice_number}` },
          },
          quantity: 1,
        },
      ],
      metadata: { invoice_id: invoice.id },
      success_url: `${process.env.APP_URL}/invoices/${invoice.id}?paid=true`,
      cancel_url: `${process.env.APP_URL}/invoices/${invoice.id}`,
    });

    res.json({ data: { url: session.url, session_id: session.id } });
  } catch {
    res.status(500).json({ error: 'Failed to create Stripe payment link' });
  }
});

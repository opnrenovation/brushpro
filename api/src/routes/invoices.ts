import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail, COMPANY_BCC } from '../lib/resend';
import { generateInvoicePdf } from '../lib/invoicePdf';
import { sendInvoiceEmail } from '../lib/sendInvoice';
import { getInvoiceLogoBuffer } from '../lib/supabase';
import { computeInvoiceTotals } from '../lib/invoiceTotals';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set.');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

export const invoicesRouter = Router();

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

    // Find the highest number currently in use so we never collide
    const maxRow = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER)) AS max
      FROM "invoices"
      WHERE invoice_number ~ '^[A-Z]+-[0-9]+$'
    `;
    const maxUsed = maxRow[0]?.max ?? 0;
    const nextNum = Math.max(
      settings?.next_invoice_number ?? 1,
      maxUsed + 1,
    );
    const invoice_number = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    // Increment the counter before creating so concurrent requests get unique numbers
    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { next_invoice_number: nextNum + 1 },
      });
    }

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
    const result = await sendInvoiceEmail(req.params.id);
    if (!result.sent) {
      res.status(400).json({ error: result.reason || 'Failed to send invoice' });
      return;
    }
    res.json({ data: { sent: true } });
  } catch (err) {
    console.error('Invoice send failed:', err);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

invoicesRouter.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { job: { include: { customer: true } }, customer: true, tax_profile: true, payments: true },
    });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const settings = await prisma.companySettings.findFirst();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const lineItems = invoice.line_items as Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
    const logoBuffer = await getInvoiceLogoBuffer(settings?.logo_url);

    const pdfBuffer = await generateInvoicePdf(
      {
        invoice_number: invoice.invoice_number,
        type: invoice.type,
        status: invoice.status,
        invoice_date: invoice.created_at.toISOString(),
        due_date: invoice.due_date.toISOString(),
        payment_terms_label: settings?.payment_terms_label ?? 'Due on receipt',
        disclaimer: settings?.disclaimer ?? undefined,
        notes: invoice.notes ?? undefined,
        tax_profile: { state_rate: Number(invoice.tax_profile.state_rate), local_rate: Number(invoice.tax_profile.local_rate), name: invoice.tax_profile.name },
        discount_type: invoice.discount_type,
        discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
        line_items: lineItems,
        payments: invoice.payments.map((p) => ({ amount: Number(p.amount), method: p.method, paid_at: p.paid_at.toISOString() })),
        job: invoice.job ? { address: invoice.job.address ?? undefined, name: invoice.job.name ?? undefined, customer: invoice.job.customer ? { name: invoice.job.customer.name ?? undefined, email: invoice.job.customer.email ?? undefined } : undefined } : null,
        customer: invoice.customer ? { name: invoice.customer.name ?? undefined, email: invoice.customer.email ?? undefined } : null,
      },
      {
        company_name: settings?.company_name,
        phone: settings?.phone ?? undefined,
        email: settings?.email ?? undefined,
        address: settings?.address ?? undefined,
        logoBuffer,
      },
      `${appUrl}/invoices/${invoice.id}`,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoice_number}.pdf"`);
    res.setHeader('X-Logo-Url', settings?.logo_url ? 'set' : 'missing');
    res.setHeader('X-Logo-Buffer', logoBuffer ? `${logoBuffer.length}bytes` : 'null');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

invoicesRouter.post('/:id/payments', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { payments: true, tax_profile: true },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const payment = await prisma.payment.create({
      data: { invoice_id: invoice.id, ...req.body },
    });

    // Update invoice status against the true total (subtotal - discount + tax)
    const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
    const totalPaid = [...invoice.payments, payment].reduce((s, p) => s + Number(p.amount), 0);
    const { total } = computeInvoiceTotals({
      line_items: lineItems,
      discount_type: invoice.discount_type,
      discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
      state_rate: Number(invoice.tax_profile.state_rate),
      local_rate: Number(invoice.tax_profile.local_rate),
    });

    let status: string;
    // Allow a one-cent rounding tolerance so a "pay in full" never lands PARTIAL
    if (totalPaid >= total - 0.005) status = 'PAID';
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
      include: { payments: true, tax_profile: true },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await prisma.payment.delete({ where: { id: req.params.paymentId } });

    const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
    const { total } = computeInvoiceTotals({
      line_items: lineItems,
      discount_type: invoice.discount_type,
      discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
      state_rate: Number(invoice.tax_profile.state_rate),
      local_rate: Number(invoice.tax_profile.local_rate),
    });
    const remaining = invoice.payments.filter(p => p.id !== req.params.paymentId);
    const totalPaid = remaining.reduce((s, p) => s + Number(p.amount), 0);

    let status: string;
    if (totalPaid >= total - 0.005) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    else status = invoice.status === 'DRAFT' ? 'DRAFT' : 'SENT';

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: status as 'PAID' | 'PARTIAL' | 'SENT' | 'DRAFT' } });
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
    const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const { balance } = computeInvoiceTotals({
      line_items: lineItems,
      discount_type: invoice.discount_type,
      discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
      state_rate: Number(invoice.tax_profile.state_rate),
      local_rate: Number(invoice.tax_profile.local_rate),
      amount_paid: alreadyPaid,
    });
    const amountDue = Math.round(balance * 100); // cents

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

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-11-20.acacia' });

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
        include: { payments: true, tax_profile: true },
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
        tax_profile: true,
        payments: true,
      },
    });
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const settings = await prisma.companySettings.findFirst();
    const lineItems = invoice.line_items as Array<{
      description: string;
      qty: number;
      unit_price: number;
      taxable: boolean;
    }>;

    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const taxableAmount = lineItems
      .filter((li) => li.taxable)
      .reduce((sum, li) => sum + li.qty * li.unit_price, 0);
    const stateTax = taxableAmount * Number(invoice.tax_profile.state_rate);
    const localTax = taxableAmount * Number(invoice.tax_profile.local_rate);
    const total = subtotal + stateTax + localTax;

    const customerEmail = invoice.job.customer.email;
    if (customerEmail) {
      const lineItemRows = lineItems
        .map((li) => `<tr><td>${li.description}</td><td>${li.qty}</td><td>$${li.unit_price.toFixed(2)}</td><td>$${(li.qty * li.unit_price).toFixed(2)}</td></tr>`)
        .join('');

      await sendEmail({
        to: customerEmail,
        subject: `Invoice ${invoice.invoice_number} — ${settings?.company_name || 'BrushPro'}`,
        html: `
          <p>Dear ${invoice.job.customer.name},</p>
          <p>Invoice <strong>${invoice.invoice_number}</strong> for ${invoice.job.address}.</p>
          <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
            <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
            ${lineItemRows}
          </table>
          <p>Subtotal: $${subtotal.toFixed(2)}</p>
          <p>State Tax (${(Number(invoice.tax_profile.state_rate) * 100).toFixed(2)}%): $${stateTax.toFixed(2)}</p>
          <p>Local Tax (${(Number(invoice.tax_profile.local_rate) * 100).toFixed(2)}%): $${localTax.toFixed(2)}</p>
          <p><strong>Total: $${total.toFixed(2)}</strong></p>
          <p>Due: ${new Date(invoice.due_date).toLocaleDateString()}</p>
          <p>${settings?.invoice_notes || ''}</p>
        `,
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
    const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number }>;
    const total = lineItems.reduce((sum, li) => sum + li.qty * li.unit_price, 0);
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
    const taxable = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const tax = taxable * (Number(invoice.tax_profile.state_rate) + Number(invoice.tax_profile.local_rate));
    const total = subtotal + tax;
    const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const amountDue = Math.round((total - alreadyPaid) * 100); // cents

    const session = await stripe.checkout.sessions.create({
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

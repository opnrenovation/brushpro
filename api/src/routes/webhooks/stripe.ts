import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { generateInvoicePdf } from '../../lib/invoicePdf';
import { sendEmail } from '../../lib/resend';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set.');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

export const stripeWebhookRouter = Router();

// ── Deposit receipt helper ──────────────────────────────────────────────────────
async function sendDepositReceipt(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        job: { include: { customer: true } },
        customer: true,
        tax_profile: true,
        payments: { orderBy: { paid_at: 'asc' } },
      },
    });
    if (!invoice) return;

    const recipient = invoice.job?.customer ?? invoice.customer;
    if (!recipient?.email) return;

    const settings = await prisma.companySettings.findFirst();
    const lineItems = invoice.line_items as Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const payUrl = `${appUrl}/invoices/${invoice.id}`;

    const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxableRaw = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const stateTax = taxableRaw * Number(invoice.tax_profile.state_rate);
    const localTax  = taxableRaw * Number(invoice.tax_profile.local_rate);
    const total     = subtotal + stateTax + localTax;
    const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance   = Math.max(0, total - totalPaid);

    const usd = (n: number) =>
      `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Generate the full invoice PDF so customer sees deposit as partial payment
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
        tax_profile: {
          state_rate: Number(invoice.tax_profile.state_rate),
          local_rate: Number(invoice.tax_profile.local_rate),
          name: invoice.tax_profile.name,
        },
        discount_type: invoice.discount_type,
        discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
        line_items: lineItems,
        payments: invoice.payments.map((p) => ({
          amount: Number(p.amount),
          method: p.method,
          paid_at: p.paid_at.toISOString(),
        })),
        job: invoice.job
          ? {
              address: invoice.job.address ?? undefined,
              name: invoice.job.name ?? undefined,
              customer: invoice.job.customer
                ? { name: invoice.job.customer.name ?? undefined, email: invoice.job.customer.email ?? undefined }
                : undefined,
            }
          : null,
        customer: invoice.customer
          ? { name: invoice.customer.name ?? undefined, email: invoice.customer.email ?? undefined }
          : null,
      },
      {
        company_name: settings?.company_name,
        phone: settings?.phone ?? undefined,
        email: settings?.email ?? undefined,
        address: settings?.address ?? undefined,
        logo_url: settings?.logo_url ?? undefined,
      },
      payUrl,
    );

    const companyName = settings?.company_name || 'OPN Renovation';

    await sendEmail({
      to: recipient.email,
      subject: `Deposit received — ${companyName} Invoice ${invoice.invoice_number}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
          <div style="background:#1e3a8a;padding:24px 32px;border-radius:12px 12px 0 0">
            <p style="color:#fff;font-size:18px;font-weight:700;margin:0">${companyName}</p>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px">Invoice ${invoice.invoice_number}</p>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
            <p style="margin:0 0 8px">Dear ${recipient.name},</p>
            <p style="color:#555;margin:0 0 24px">
              Your deposit payment of <strong>${usd(totalPaid)}</strong> has been received.
              Your invoice is attached showing the deposit as a partial payment and the remaining balance.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border-radius:8px;overflow:hidden">
              <tr style="background:#f9fafb">
                <td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Invoice total</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb">${usd(total)}</td>
              </tr>
              <tr style="background:#f0fdf4">
                <td style="padding:12px 16px;font-size:14px;color:#16a34a;border-bottom:1px solid #e5e7eb">Deposit paid</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#16a34a;text-align:right;border-bottom:1px solid #e5e7eb">- ${usd(totalPaid)}</td>
              </tr>
              <tr style="background:#fff">
                <td style="padding:14px 16px;font-size:15px;font-weight:700">Balance due on completion</td>
                <td style="padding:14px 16px;font-size:15px;font-weight:700;text-align:right">${usd(balance)}</td>
              </tr>
            </table>
            <a href="${payUrl}" style="background:#0047C8;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-size:14px;font-weight:600;">View Invoice</a>
          </div>
        </div>
      `,
      attachments: [{ filename: `Invoice-${invoice.invoice_number}.pdf`, content: pdfBuffer }],
    });
  } catch (err) {
    console.error('[webhook] sendDepositReceipt failed:', err);
  }
}

// ── Webhook handler ─────────────────────────────────────────────────────────────
stripeWebhookRouter.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      if (invoiceId && session.amount_total) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { payments: true },
        });

        if (invoice) {
          await prisma.payment.create({
            data: {
              invoice_id: invoiceId,
              amount: session.amount_total / 100,
              method: 'CARD',
              stripe_id: session.id,
              paid_at: new Date(),
            },
          });

          // Recalculate total including tax for accurate status
          const lineItems = invoice.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
          const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
          const totalPaid =
            invoice.payments.reduce((s, p) => s + Number(p.amount), 0) +
            session.amount_total / 100;
          const status = totalPaid >= subtotal * 0.999 ? 'PAID' : 'PARTIAL';
          await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });

          // Send deposit receipt with full invoice PDF when deposit is collected
          if (session.metadata?.payment_type === 'deposit') {
            await sendDepositReceipt(invoiceId);
          }
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        await prisma.payment.upsert({
          where: { id: pi.id },
          create: {
            id: pi.id,
            invoice_id: invoiceId,
            amount: pi.amount_received / 100,
            method: 'CARD',
            stripe_id: pi.id,
            paid_at: new Date(),
          },
          update: {},
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

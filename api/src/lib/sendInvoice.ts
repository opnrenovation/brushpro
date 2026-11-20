import prisma from './prisma';
import { sendEmail, COMPANY_BCC, INVOICE_OPEN_NOTIFY } from './resend';
import { getInvoiceLogoBuffer } from './supabase';
import { generateInvoicePdf } from './invoicePdf';
import { computeInvoiceTotals } from './invoiceTotals';

// Emails an invoice to its customer (with PDF + pay link). Shows amount paid
// and balance due when payments exist, so it doubles as the final-balance
// invoice after a deposit. Used by the manual send route and job completion.
export async function sendInvoiceEmail(invoiceId: string): Promise<{ sent: boolean; reason?: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      job: { include: { customer: true } },
      customer: true,
      tax_profile: true,
      payments: true,
    },
  });
  if (!invoice) return { sent: false, reason: 'Invoice not found' };

  const recipient = invoice.job?.customer ?? invoice.customer;
  if (!recipient?.email) return { sent: false, reason: 'Customer has no email address' };

  const settings = await prisma.companySettings.findFirst();
  const lineItems = invoice.line_items as Array<{
    description: string;
    qty: number;
    unit_price: number;
    taxable: boolean;
  }>;

  const { subtotal, discountAmount: discountAmt, stateTax, localTax, total } = computeInvoiceTotals({
    line_items: lineItems,
    discount_type: invoice.discount_type,
    discount_value: invoice.discount_value ? Number(invoice.discount_value) : null,
    state_rate: Number(invoice.tax_profile.state_rate),
    local_rate: Number(invoice.tax_profile.local_rate),
  });
  const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, total - totalPaid);

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const payUrl = `${appUrl}/invoices/${invoice.id}`;

  const logoBuffer = await getInvoiceLogoBuffer(settings?.logo_url);
  let pdfBuffer: Buffer | undefined;
  try {
    pdfBuffer = await generateInvoicePdf(
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
        payments: invoice.payments.map(p => ({ amount: Number(p.amount), method: p.method, paid_at: p.paid_at.toISOString() })),
        job: invoice.job
          ? { address: invoice.job.address ?? undefined, name: invoice.job.name ?? undefined, customer: invoice.job.customer ? { name: invoice.job.customer.name, email: invoice.job.customer.email ?? undefined } : undefined }
          : null,
        customer: invoice.customer ? { name: invoice.customer.name, email: invoice.customer.email ?? undefined } : null,
      },
      {
        company_name: settings?.company_name,
        phone: settings?.phone ?? undefined,
        email: settings?.email ?? undefined,
        address: settings?.address ?? undefined,
        logoBuffer,
      },
      payUrl,
    );
  } catch (pdfErr) {
    console.error('PDF generation failed (non-fatal):', pdfErr);
  }

  const lineItemRows = lineItems
    .map((li) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${li.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${li.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${li.unit_price.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(li.qty * li.unit_price).toFixed(2)}</td></tr>`)
    .join('');
  const forLine = invoice.job?.address ? `for work at <strong>${invoice.job.address}</strong>` : '';
  const isBalance = totalPaid > 0;

  const subject = isBalance
    ? `Invoice ${invoice.invoice_number} — Balance Due — ${settings?.company_name || 'OPN Renovation'}`
    : `Invoice ${invoice.invoice_number} — ${settings?.company_name || 'OPN Renovation'}`;

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#007AFF;padding:24px 32px;border-radius:12px 12px 0 0">
    <img src="https://www.opnrenovation.com/opn-logo-white.png" alt="${settings?.company_name || 'OPN Renovation'}" width="96" height="96" style="display:block;margin-bottom:10px" />
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">${settings?.company_name || 'OPN Renovation'}</p>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin:0 0 8px">Dear ${recipient.name},</p>
    <p style="color:#555;margin:0 0 24px">${isBalance ? `Thank you for your deposit. Please find the invoice ${forLine} with your remaining balance below.` : `Please find your invoice ${forLine} attached below.`}</p>

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
      <tr style="border-top:2px solid #111"><td style="padding:8px 0 0;font-weight:700;font-size:16px">Total</td><td style="padding:8px 0 0 24px;text-align:right;font-weight:700;font-size:16px">$${total.toFixed(2)}</td></tr>
      ${isBalance ? `<tr><td style="padding:4px 0;color:#16a34a;font-size:14px">Amount Paid</td><td style="padding:4px 0 4px 24px;text-align:right;font-size:14px;color:#16a34a">-$${totalPaid.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px;color:#dc2626">Balance Due</td><td style="padding:8px 0 0 24px;text-align:right;font-weight:700;font-size:16px;color:#dc2626">$${balance.toFixed(2)}</td></tr>` : ''}
    </table>

    <p style="color:#666;font-size:14px;margin-bottom:24px">Due by: <strong>${new Date(invoice.due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>

    <div style="text-align:center;margin-bottom:24px">
      <a href="${payUrl}" style="display:inline-block;background:#007AFF;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none">View &amp; Pay Invoice</a>
    </div>

    ${settings?.invoice_notes ? `<p style="color:#666;font-size:13px;border-top:1px solid #eee;padding-top:16px">${settings.invoice_notes}</p>` : ''}
    <p style="color:#aaa;font-size:12px;margin-top:16px">${settings?.company_name || 'OPN Renovation'}${settings?.phone ? ` · ${settings.phone}` : ''}${settings?.email ? ` · ${settings.email}` : ''}</p>
  </div>
</div>`;

  const attachments = pdfBuffer
    ? [{ filename: `Invoice-${invoice.invoice_number}.pdf`, content: pdfBuffer }]
    : undefined;

  // The customer's copy is the tracked one: tagging it with invoice_id lets the
  // Resend webhook record delivery/open/click against this invoice. The team's
  // copy goes out as a separate message rather than a BCC — a BCC shares one
  // Resend email_id with the customer's copy, so info@/Haruko/Danny opening
  // their own copy would read as the customer opening theirs and would fire the
  // "invoice opened" alert immediately on every send.
  const emailData = await sendEmail({
    to: recipient.email,
    subject,
    html,
    attachments,
    tags: [{ name: 'invoice_id', value: invoice.id }],
  });

  if (COMPANY_BCC.length > 0) {
    try {
      await sendEmail({ to: COMPANY_BCC, subject: `Copy: ${subject}`, html, attachments });
    } catch (copyErr) {
      console.error('Internal invoice copy failed (non-fatal):', copyErr);
    }
  }

  // Never downgrade a PARTIAL/PAID invoice back to SENT
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      sent_at: new Date(),
      // Tracking is per-send: clear the previous send's timestamps so a resend
      // reports on the new email and can alert on its first open.
      resend_email_id: emailData?.id ?? null,
      email_delivered_at: null,
      email_opened_at: null,
      email_clicked_at: null,
      open_notified_at: null,
      ...(invoice.status === 'DRAFT' || invoice.status === 'SENT' ? { status: 'SENT' as const } : {}),
    },
  });

  return { sent: true };
}

// Internal heads-up that the customer opened their invoice email. Fired once
// per send by the Resend webhook, which owns the open_notified_at guard.
export async function sendInvoiceOpenedAlert(invoiceId: string): Promise<void> {
  if (INVOICE_OPEN_NOTIFY.length === 0) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { job: { include: { customer: true } }, customer: true },
  });
  if (!invoice) return;

  const settings = await prisma.companySettings.findFirst();
  const recipient = invoice.job?.customer ?? invoice.customer;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const invoiceUrl = `${appUrl}/invoices/${invoice.id}`;
  const openedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
  });

  await sendEmail({
    to: INVOICE_OPEN_NOTIFY,
    subject: `Opened: Invoice ${invoice.invoice_number}${recipient?.name ? ` — ${recipient.name}` : ''}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#007AFF;padding:24px 32px;border-radius:12px 12px 0 0">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0">Invoice opened</p>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Invoice ${invoice.invoice_number}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p style="color:#555;margin:0 0 24px">${recipient?.name ?? 'The customer'} opened the invoice email${recipient?.email ? ` sent to ${recipient.email}` : ''}.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:6px 0;color:#666;font-size:14px">Invoice</td><td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600">${invoice.invoice_number}</td></tr>
      <tr><td style="padding:6px 0;color:#666;font-size:14px">Customer</td><td style="padding:6px 0;text-align:right;font-size:14px">${recipient?.name ?? '—'}</td></tr>
      ${invoice.job?.address ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Job</td><td style="padding:6px 0;text-align:right;font-size:14px">${invoice.job.address}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#666;font-size:14px">Sent</td><td style="padding:6px 0;text-align:right;font-size:14px">${invoice.sent_at ? new Date(invoice.sent_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }) : '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#666;font-size:14px">Opened</td><td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600">${openedAt}</td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${invoiceUrl}" style="display:inline-block;background:#007AFF;color:#fff;padding:14px 32px;border-radius:10px;font-weight:600;font-size:16px;text-decoration:none">View Invoice</a>
    </div>
    <p style="color:#aaa;font-size:12px;margin:0">Open tracking is approximate — some mail apps block the tracking pixel, and others load it automatically without the customer reading the message. This alert is sent once per invoice send.</p>
    <p style="color:#aaa;font-size:12px;margin-top:12px">${settings?.company_name || 'OPN Renovation'}</p>
  </div>
</div>`,
  });
}

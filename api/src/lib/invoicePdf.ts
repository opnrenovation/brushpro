import PDFDocument from 'pdfkit';

interface LineItem { description: string; qty: number; unit_price: number; taxable: boolean; }
interface TaxProfile { state_rate: number; local_rate: number; name: string; }
interface Payment { amount: number; method: string; paid_at: string; }
interface InvoiceData {
  invoice_number: string;
  type: string;
  status: string;
  due_date: string;
  line_items: LineItem[];
  payments: Payment[];
  notes?: string;
  tax_profile: TaxProfile;
  discount_type?: string | null;
  discount_value?: number | null;
  job?: { address?: string; name?: string; customer?: { name?: string; email?: string } } | null;
  customer?: { name?: string; email?: string } | null;
}
interface Settings { company_name?: string; phone?: string; email?: string; website?: string; }

const METHOD: Record<string, string> = { CHECK: 'Check', CASH: 'Cash', CARD: 'Card', TRANSFER: 'Bank Transfer' };

function calcDiscount(subtotal: number, type: string | null | undefined, value: number | null | undefined): number {
  const v = Number(value || 0);
  if (type === 'PERCENT') return subtotal * (v / 100);
  if (type === 'FIXED') return Math.min(v, subtotal);
  return 0;
}

function usd(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function generateInvoicePdf(invoice: InvoiceData, settings: Settings, payUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#1e3a8a';
    const gold = '#E8A838';
    const gray = '#64748b';
    const lightGray = '#f1f5f9';
    const companyName = settings.company_name || 'OPN Renovation';
    const recipient = invoice.job?.customer ?? invoice.customer;
    const pageWidth = doc.page.width - 100;

    // ── Header bar ────────────────────────────────────────────────────────
    doc.rect(50, 50, pageWidth, 70).fill(navy);

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
      .text(companyName, 70, 68, { width: pageWidth / 2 });

    if (settings.phone || settings.email) {
      doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)');
      const contact = [settings.phone, settings.email].filter(Boolean).join('  ·  ');
      doc.text(contact, 70, 91, { width: pageWidth / 2 });
    }

    // Invoice number + status (right side of header)
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff')
      .text(`Invoice ${invoice.invoice_number}`, 50, 68, { width: pageWidth, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)')
      .text(`Due ${new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 50, 91, { width: pageWidth, align: 'right' });

    let y = 140;

    // ── Bill-to block ──────────────────────────────────────────────────────
    if (recipient?.name || invoice.job?.address) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(gray).text('BILLED TO', 50, y);
      y += 14;
      if (recipient?.name) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(recipient.name, 50, y);
        y += 15;
      }
      if (recipient?.email) {
        doc.font('Helvetica').fontSize(9).fillColor(gray).text(recipient.email, 50, y);
        y += 13;
      }
      if (invoice.job?.address) {
        doc.font('Helvetica').fontSize(9).fillColor(gray).text(invoice.job.address, 50, y);
        y += 13;
      }
      y += 10;
    }

    // ── Section divider ────────────────────────────────────────────────────
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 14;

    // ── Line items table header ────────────────────────────────────────────
    doc.rect(50, y, pageWidth, 22).fill(lightGray);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(gray);
    doc.text('DESCRIPTION', 60, y + 7);
    doc.text('QTY', 380, y + 7, { width: 40, align: 'right' });
    doc.text('PRICE', 430, y + 7, { width: 60, align: 'right' });
    doc.text('TOTAL', 500, y + 7, { width: pageWidth - 454, align: 'right' });
    y += 22;

    // ── Line items ─────────────────────────────────────────────────────────
    const lineItems = invoice.line_items || [];
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
    lineItems.forEach((li, i) => {
      if (i % 2 === 1) doc.rect(50, y, pageWidth, 20).fill('#fafafa');
      doc.fillColor('#0f172a').text(li.description, 60, y + 5, { width: 315 });
      doc.text(String(li.qty), 380, y + 5, { width: 40, align: 'right' });
      doc.text(usd(li.unit_price), 430, y + 5, { width: 60, align: 'right' });
      doc.text(usd(li.qty * li.unit_price), 500, y + 5, { width: pageWidth - 454, align: 'right' });
      y += 20;
    });

    y += 6;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 12;

    // ── Totals ─────────────────────────────────────────────────────────────
    const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const discountAmt = calcDiscount(subtotal, invoice.discount_type, invoice.discount_value);
    const discountedSubtotal = subtotal - discountAmt;
    const taxableRaw = lineItems.filter(li => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
    const stateTax = discountedSubtotal * taxableFraction * Number(invoice.tax_profile.state_rate);
    const localTax = discountedSubtotal * taxableFraction * Number(invoice.tax_profile.local_rate);
    const total = discountedSubtotal + stateTax + localTax;
    const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = total - totalPaid;

    const totalsX = 370;
    const totalsW = pageWidth - totalsX + 50;

    function totalsRow(label: string, value: string, bold = false, color = '#0f172a') {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10)
        .fillColor(color).text(label, totalsX, y, { width: totalsW / 2 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10)
        .fillColor(color).text(value, totalsX + totalsW / 2, y, { width: totalsW / 2, align: 'right' });
      y += bold ? 18 : 16;
    }

    totalsRow('Subtotal', usd(subtotal));
    if (discountAmt > 0) totalsRow('Discount', `-${usd(discountAmt)}`, false, '#16a34a');
    totalsRow(`State Tax (${(Number(invoice.tax_profile.state_rate) * 100).toFixed(2)}%)`, usd(stateTax));
    totalsRow(`Local Tax (${(Number(invoice.tax_profile.local_rate) * 100).toFixed(2)}%)`, usd(localTax));

    doc.moveTo(totalsX, y).lineTo(50 + pageWidth, y).strokeColor('#0f172a').lineWidth(1.5).stroke();
    y += 8;
    totalsRow('Total', usd(total), true);

    if (totalPaid > 0) {
      totalsRow('Amount Paid', usd(totalPaid), false, '#16a34a');
      doc.moveTo(totalsX, y).lineTo(50 + pageWidth, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      y += 6;
      totalsRow('Balance Due', usd(Math.max(0, balance)), true, balance <= 0 ? '#16a34a' : '#dc2626');
    }

    y += 16;

    // ── Payment history ────────────────────────────────────────────────────
    if (invoice.payments.length > 0) {
      doc.rect(50, y, pageWidth, 18).fill(lightGray);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(gray).text('PAYMENT HISTORY', 60, y + 5);
      y += 18;
      invoice.payments.forEach(p => {
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
          .text(`${METHOD[p.method] || p.method}  ·  ${new Date(p.paid_at).toLocaleDateString()}`, 60, y + 3);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#16a34a')
          .text(usd(Number(p.amount)), 50, y + 3, { width: pageWidth, align: 'right' });
        y += 18;
      });
      y += 8;
    }

    // ── Notes ──────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc.font('Helvetica').fontSize(9).fillColor(gray)
        .text(invoice.notes, 50, y, { width: pageWidth });
      y += doc.heightOfString(invoice.notes, { width: pageWidth }) + 12;
    }

    // ── Pay link ───────────────────────────────────────────────────────────
    doc.rect(50, y, pageWidth, 36).fill(navy);
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)')
      .text('Pay online:', 60, y + 8);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(gold)
      .text(payUrl, 60, y + 20, { width: pageWidth - 20 });

    // ── Footer ─────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 40;
    doc.font('Helvetica').fontSize(8).fillColor(gray)
      .text(`${companyName}${settings.phone ? '  ·  ' + settings.phone : ''}${settings.email ? '  ·  ' + settings.email : ''}`, 50, footerY, { width: pageWidth, align: 'center' });

    doc.end();
  });
}

import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

interface LineItem { description: string; qty: number; unit_price: number; taxable: boolean; }
interface TaxProfile { state_rate: number; local_rate: number; name: string; }
interface Payment { amount: number; method: string; paid_at: string; }

interface InvoiceData {
  invoice_number: string;
  type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  payment_terms_label: string;
  disclaimer?: string;
  line_items: LineItem[];
  payments: Payment[];
  notes?: string;
  tax_profile: TaxProfile;
  discount_type?: string | null;
  discount_value?: number | null;
  job?: { address?: string; name?: string; customer?: { name?: string; email?: string } } | null;
  customer?: { name?: string; email?: string } | null;
}

interface CompanySettings {
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
}

const METHOD: Record<string, string> = { CHECK: 'Check', CASH: 'Cash', CARD: 'Card', TRANSFER: 'Bank Transfer' };

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function calcDiscount(subtotal: number, type: string | null | undefined, value: number | null | undefined): number {
  const v = Number(value || 0);
  if (type === 'PERCENT') return subtotal * (v / 100);
  if (type === 'FIXED') return Math.min(v, subtotal);
  return 0;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

export async function generateInvoicePdf(
  invoice: InvoiceData,
  settings: CompanySettings,
  payUrl: string,
): Promise<Buffer> {
  // Pre-fetch logo before opening the doc stream
  let logoBuffer: Buffer | null = null;
  if (settings.logo_url) {
    logoBuffer = await fetchImageBuffer(settings.logo_url);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 50;
    const PW = doc.page.width - 2 * M;   // 512 pt usable width

    // ── Color palette ──────────────────────────────────────────────────────────
    const BLUE       = '#0047C8';
    const NAVY       = '#1e3a8a';
    const LIGHT_BLUE = '#EFF6FF';
    const BORDER     = '#DBEAFE';
    const GRAY       = '#6B7280';
    const DARK       = '#111827';
    const MID        = '#374151';
    const GREEN      = '#16a34a';
    const RED        = '#dc2626';
    const ROW_ALT    = '#F9FAFB';
    const THEAD_BG   = '#F3F4F6';

    const companyName = settings.company_name || 'OPN Renovation';
    const recipient = invoice.job?.customer ?? invoice.customer;
    let y = M;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    // Left: "INVOICE" title
    doc.font('Helvetica-Bold').fontSize(26).fillColor(BLUE).text('INVOICE', M, y);

    // Right: logo (if available) — reserve 100 pt wide column
    const LOGO_W = 100;
    const LOGO_X = M + PW - LOGO_W;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, LOGO_X, y, { fit: [LOGO_W, 60] });
      } catch {
        // logo decode failed — skip silently
      }
    }

    y += 36;

    // Company name + address + contact (left side, two sub-columns)
    const INFO_COL2 = M + Math.round(PW * 0.42);  // where email/phone starts
    const INFO_COL2_W = LOGO_X - INFO_COL2 - 8;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(companyName, M, y, { width: INFO_COL2 - M - 8 });

    let addrY = y + 15;
    if (settings.address) {
      const addrLines = settings.address.split('\n').map((l) => l.trim()).filter(Boolean);
      addrLines.forEach((line) => {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(line, M, addrY, { width: INFO_COL2 - M - 8 });
        addrY += 12;
      });
    }

    // Email + phone — right of address block, left of logo
    let contactY = y + 15;
    if (settings.email) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(settings.email, INFO_COL2, contactY, { width: INFO_COL2_W, align: 'right' });
      contactY += 12;
    }
    if (settings.phone) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(settings.phone, INFO_COL2, contactY, { width: INFO_COL2_W, align: 'right' });
      contactY += 12;
    }

    y = Math.max(addrY, contactY) + 18;

    // ── Divider ────────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 14;

    // ── Bill To / Job Address boxes ────────────────────────────────────────────
    const BOX_GAP = 12;
    const BOX_W   = (PW - BOX_GAP) / 2;
    const BOX_PAD = 10;

    // Measure box content height first
    const billLines = [recipient?.name, recipient?.email, invoice.job?.address].filter(Boolean);
    const jobLines  = [invoice.job?.name, invoice.job?.address].filter(Boolean);
    const BOX_H = Math.max(14 + billLines.length * 14 + BOX_PAD * 2, 60);

    const drawBox = (bx: number, label: string, lines: (string | undefined | null)[], bold: boolean[]) => {
      doc.rect(bx, y, BOX_W, BOX_H).fillAndStroke(LIGHT_BLUE, BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(label.toUpperCase(), bx + BOX_PAD, y + BOX_PAD);
      let iy = y + BOX_PAD + 14;
      lines.forEach((line, i) => {
        if (!line) return;
        doc.font(bold[i] ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
          .fillColor(bold[i] ? DARK : GRAY)
          .text(line, bx + BOX_PAD, iy, { width: BOX_W - BOX_PAD * 2 });
        iy += 14;
      });
    };

    drawBox(M, 'Bill to', [recipient?.name, invoice.job?.address, recipient?.email], [true, false, false]);
    drawBox(M + BOX_W + BOX_GAP, 'Job Address', [invoice.job?.name, invoice.job?.address], [true, false]);

    y += BOX_H + 12;

    // ── Invoice Details bar ────────────────────────────────────────────────────
    const DET_H  = 52;
    const DET_CW = PW / 4;
    doc.rect(M, y, PW, DET_H).fillAndStroke(LIGHT_BLUE, BORDER);

    const details = [
      { label: 'Invoice no.', value: invoice.invoice_number },
      { label: 'Terms',       value: invoice.payment_terms_label || 'Due on receipt' },
      { label: 'Invoice date', value: fmtDate(invoice.invoice_date) },
      { label: 'Due date',    value: fmtDate(invoice.due_date) },
    ];

    details.forEach((d, i) => {
      const dx = M + i * DET_CW + 10;
      if (i > 0) {
        doc.moveTo(M + i * DET_CW, y + 8).lineTo(M + i * DET_CW, y + DET_H - 8)
          .strokeColor(BORDER).lineWidth(0.5).stroke();
      }
      doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY)
        .text(d.label.toUpperCase(), dx, y + 9, { width: DET_CW - 20 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MID)
        .text(d.value, dx, y + 22, { width: DET_CW - 20 });
    });

    y += DET_H + 16;

    // ── Table header ──────────────────────────────────────────────────────────
    // Columns: #(16) | Date(62) | Description(rest) | Qty(34) | Rate(72) | Amount(72)
    const C_NUM  = { x: M,           w: 16 };
    const C_DATE = { x: M + 20,      w: 62 };
    const C_DESC = { x: M + 86,      w: PW - 86 - 34 - 72 - 72 - 12 };
    const C_QTY  = { x: M + PW - 34 - 72 - 72, w: 34 };
    const C_RATE = { x: M + PW - 72 - 72,       w: 72 };
    const C_AMT  = { x: M + PW - 72,            w: 72 };

    doc.rect(M, y, PW, 22).fill(THEAD_BG);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY);
    const thY = y + 7;
    doc.text('#',           C_NUM.x + 2,  thY);
    doc.text('Date',        C_DATE.x,     thY);
    doc.text('Description', C_DESC.x,     thY);
    doc.text('Qty',         C_QTY.x,      thY, { width: C_QTY.w,  align: 'right' });
    doc.text('Rate',        C_RATE.x,     thY, { width: C_RATE.w, align: 'right' });
    doc.text('Amount',      C_AMT.x,      thY, { width: C_AMT.w,  align: 'right' });
    y += 22;

    // ── Line items ─────────────────────────────────────────────────────────────
    const lineItems = invoice.line_items || [];
    const invDateStr = fmtDate(invoice.invoice_date);

    lineItems.forEach((li, i) => {
      const ROW_H = 22;
      if (i % 2 === 1) doc.rect(M, y, PW, ROW_H).fill(ROW_ALT);
      doc.font('Helvetica').fontSize(9).fillColor(DARK);
      doc.text(String(i + 1),          C_NUM.x + 2,  y + 6);
      doc.text(invDateStr,             C_DATE.x,     y + 6);
      doc.text(li.description,         C_DESC.x,     y + 6, { width: C_DESC.w });
      doc.text(String(li.qty),         C_QTY.x,      y + 6, { width: C_QTY.w,  align: 'right' });
      doc.text(usd(li.unit_price),     C_RATE.x,     y + 6, { width: C_RATE.w, align: 'right' });
      doc.text(usd(li.qty * li.unit_price), C_AMT.x, y + 6, { width: C_AMT.w,  align: 'right' });
      y += ROW_H;
    });

    y += 8;
    doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    y += 14;

    // ── Totals ─────────────────────────────────────────────────────────────────
    const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const discountAmt = calcDiscount(subtotal, invoice.discount_type, invoice.discount_value);
    const discountedSubtotal = subtotal - discountAmt;
    const taxableRaw = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
    const taxableFraction = subtotal > 0 ? taxableRaw / subtotal : 1;
    const stateTax = discountedSubtotal * taxableFraction * Number(invoice.tax_profile.state_rate);
    const localTax  = discountedSubtotal * taxableFraction * Number(invoice.tax_profile.local_rate);
    const total     = discountedSubtotal + stateTax + localTax;
    const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance   = total - totalPaid;

    const T_LABEL_X = M + Math.round(PW * 0.55);
    const T_LABEL_W = Math.round(PW * 0.25);
    const T_VALUE_X = T_LABEL_X + T_LABEL_W;
    const T_VALUE_W = M + PW - T_VALUE_X;

    const totRow = (label: string, value: string, bold = false, color = DARK, size = 9) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
        .text(label, T_LABEL_X, y, { width: T_LABEL_W });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
        .text(value, T_VALUE_X, y, { width: T_VALUE_W, align: 'right' });
      y += bold && size > 10 ? 20 : 16;
    };

    totRow('Subtotal', usd(subtotal));
    if (discountAmt > 0) totRow('Discount', `-${usd(discountAmt)}`, false, GREEN);
    if (stateTax > 0) totRow(`State Tax (${(Number(invoice.tax_profile.state_rate) * 100).toFixed(2)}%)`, usd(stateTax));
    if (localTax  > 0) totRow(`Local Tax (${(Number(invoice.tax_profile.local_rate) * 100).toFixed(2)}%)`, usd(localTax));

    doc.moveTo(T_LABEL_X, y).lineTo(M + PW, y).strokeColor(DARK).lineWidth(1.5).stroke();
    y += 6;
    totRow('Total', usd(total), true, DARK, 12);

    if (totalPaid > 0) {
      totRow('Amount Paid', usd(totalPaid), false, GREEN);
      doc.moveTo(T_LABEL_X, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      y += 4;
      totRow('Balance Due', usd(Math.max(0, balance)), true, balance <= 0 ? GREEN : RED, 11);
    }

    y += 20;

    // ── Payment history ────────────────────────────────────────────────────────
    if (invoice.payments.length > 0) {
      doc.rect(M, y, PW, 18).fill(THEAD_BG);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY).text('PAYMENT HISTORY', M + 8, y + 5);
      y += 18;
      invoice.payments.forEach((p) => {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(`${METHOD[p.method] || p.method}  ·  ${new Date(p.paid_at).toLocaleDateString()}`, M + 8, y + 4);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
          .text(usd(Number(p.amount)), M, y + 4, { width: PW, align: 'right' });
        y += 18;
      });
      y += 8;
    }

    // ── Notes ──────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(invoice.notes, M, y, { width: PW });
      y += doc.heightOfString(invoice.notes, { width: PW }) + 16;
    }

    // ── Disclaimer ─────────────────────────────────────────────────────────────
    if (invoice.disclaimer) {
      doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      y += 10;
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY)
        .text(invoice.disclaimer, M, y, { width: PW, lineGap: 2 });
      y += doc.heightOfString(invoice.disclaimer, { width: PW, lineGap: 2 }) + 14;
    }

    // ── Pay online bar ──────────────────────────────────────────────────────────
    if (payUrl) {
      doc.rect(M, y, PW, 46).fill(NAVY);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
        .text('View and Pay Online', M + 14, y + 9, { width: PW - 28 });
      doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.7)')
        .text(payUrl, M + 14, y + 26, { width: PW - 28 });
      y += 58;
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    const FOOTER_Y = doc.page.height - 36;
    const footerParts = [companyName, settings.phone, settings.email].filter(Boolean);
    doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
      .text(footerParts.join('  ·  '), M, FOOTER_Y, { width: PW, align: 'center' });

    doc.end();
  });
}

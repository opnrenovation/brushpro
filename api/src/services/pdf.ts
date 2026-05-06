/**
 * PDF generation service — uses PDFKit for both proposals and invoices.
 * No Puppeteer dependency required.
 */

import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

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

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateProposalPdf(params: {
  estimate_number: string;
  estimate_date: string;
  job_address: string;
  customer_name?: string;
  customer_email?: string;
  notes?: string;
  disclaimer?: string;
  total_price: number;
  company_name: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  logo_url?: string;
  approval_url?: string;
  expiry_date?: string;
}): Promise<Buffer> {
  let logoBuffer: Buffer | null = null;
  if (params.logo_url) {
    logoBuffer = await fetchImageBuffer(params.logo_url);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M  = 50;
    const PW = doc.page.width - 2 * M;  // 512pt

    const BLUE       = '#0047C8';
    const NAVY       = '#1e3a8a';
    const LIGHT_BLUE = '#EFF6FF';
    const BORDER     = '#DBEAFE';
    const GRAY       = '#6B7280';
    const DARK       = '#111827';
    const MID        = '#374151';

    let y = M;

    // ── Header ─────────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(26).fillColor(BLUE).text('ESTIMATE', M, y);

    const LOGO_W = 100;
    const LOGO_X = M + PW - LOGO_W;
    if (logoBuffer) {
      try { doc.image(logoBuffer, LOGO_X, y, { fit: [LOGO_W, 60] }); } catch { /* skip */ }
    }

    y += 36;

    const INFO_COL2  = M + Math.round(PW * 0.42);
    const INFO_COL2_W = LOGO_X - INFO_COL2 - 8;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
      .text(params.company_name, M, y, { width: INFO_COL2 - M - 8 });

    let addrY = y + 15;
    if (params.company_address) {
      params.company_address.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(line, M, addrY, { width: INFO_COL2 - M - 8 });
        addrY += 12;
      });
    }

    let contactY = y + 15;
    if (params.company_email) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(params.company_email, INFO_COL2, contactY, { width: INFO_COL2_W, align: 'right' });
      contactY += 12;
    }
    if (params.company_phone) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(params.company_phone, INFO_COL2, contactY, { width: INFO_COL2_W, align: 'right' });
      contactY += 12;
    }

    y = Math.max(addrY, contactY) + 18;

    // ── Divider ────────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 14;

    // ── Prepared For / Job Address boxes ───────────────────────────────────────
    const BOX_GAP = 12;
    const BOX_W   = (PW - BOX_GAP) / 2;
    const BOX_PAD = 10;
    const BOX_H   = 60;

    const drawBox = (bx: number, label: string, lines: (string | undefined | null)[], bold: boolean[]) => {
      doc.rect(bx, y, BOX_W, BOX_H).fillAndStroke(LIGHT_BLUE, BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(label.toUpperCase(), bx + BOX_PAD, y + BOX_PAD);
      let iy = y + BOX_PAD + 14;
      lines.forEach((line, i) => {
        if (!line) return;
        doc.font(bold[i] ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
          .fillColor(bold[i] ? DARK : GRAY)
          .text(line, bx + BOX_PAD, iy, { width: BOX_W - BOX_PAD * 2 });
        iy += 13;
      });
    };

    drawBox(M, 'Prepared For', [params.customer_name, params.customer_email], [true, false]);
    drawBox(M + BOX_W + BOX_GAP, 'Job Address', [params.job_address], [false]);

    y += BOX_H + 12;

    // ── Estimate details bar ────────────────────────────────────────────────────
    const DET_H  = 52;
    const DET_CW = PW / 3;
    const detailsData = [
      { label: 'Estimate no.',  value: params.estimate_number },
      { label: 'Date',          value: new Date(params.estimate_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) },
      { label: 'Valid until',   value: params.expiry_date ? new Date(params.expiry_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '30 days' },
    ];

    doc.rect(M, y, PW, DET_H).fillAndStroke(LIGHT_BLUE, BORDER);
    detailsData.forEach((d, i) => {
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

    y += DET_H + 20;

    // ── Scope of Work ──────────────────────────────────────────────────────────
    if (params.notes) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
        .text('SCOPE OF WORK', M, y);
      y += 14;
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(params.notes, M, y, { width: PW, lineGap: 3 });
      y += doc.heightOfString(params.notes, { width: PW, lineGap: 3 }) + 20;
    }

    // ── Total price box ────────────────────────────────────────────────────────
    const TOT_H = 60;
    doc.rect(M, y, PW, TOT_H).fill(NAVY);
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.7)').text('Total Project Price', M + 20, y + 12, { width: PW - 40 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(usd(params.total_price), M + 20, y + 28, { width: PW - 40 });
    y += TOT_H + 20;

    // ── Approval link ───────────────────────────────────────────────────────────
    if (params.approval_url) {
      doc.rect(M, y, PW, 36).fill(LIGHT_BLUE);
      doc.font('Helvetica').fontSize(9).fillColor(NAVY)
        .text('Review and approve this estimate online:', M + 12, y + 8, { width: PW - 24 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE)
        .text(params.approval_url, M + 12, y + 22, { width: PW - 24 });
      y += 48;
    }

    // ── Disclaimer ────────────────────────────────────────────────────────────
    if (params.disclaimer) {
      doc.moveTo(M, y).lineTo(M + PW, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      y += 10;
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY)
        .text(params.disclaimer, M, y, { width: PW, lineGap: 2 });
      y += doc.heightOfString(params.disclaimer, { width: PW, lineGap: 2 }) + 12;
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    const FOOTER_Y = doc.page.height - 36;
    const footerParts = [params.company_name, params.company_phone, params.company_email].filter(Boolean);
    doc.font('Helvetica').fontSize(7).fillColor('#9CA3AF')
      .text(footerParts.join('  ·  '), M, FOOTER_Y, { width: PW, align: 'center' });

    doc.end();
  });
}

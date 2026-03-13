// PDF generation service using Puppeteer
// Generates branded PDFs for proposals, invoices, and contracts

export async function generateProposalPdf(params: {
  estimate_number: string;
  job_address: string;
  notes?: string;
  total_price: number;
  company_name: string;
  logo_url?: string;
}): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 48px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .logo { max-height: 60px; max-width: 200px; }
        .company-name { font-size: 24px; font-weight: 700; }
        .doc-title { font-size: 32px; font-weight: 700; color: #007AFF; margin-bottom: 8px; }
        .doc-number { font-size: 16px; color: #666; margin-bottom: 32px; }
        .section { margin-bottom: 24px; }
        .label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .value { font-size: 16px; }
        .total-box { background: #f5f5f5; border-radius: 12px; padding: 24px; margin-top: 40px; }
        .total-label { font-size: 14px; color: #666; }
        .total-amount { font-size: 36px; font-weight: 700; color: #007AFF; margin-top: 4px; }
        .notes { font-size: 14px; color: #444; line-height: 1.6; white-space: pre-wrap; }
        .footer { margin-top: 60px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${params.logo_url ? `<img src="${params.logo_url}" class="logo" alt="Logo">` : `<div class="company-name">${params.company_name}</div>`}
        </div>
        <div style="text-align:right">
          <div class="doc-title">PROPOSAL</div>
          <div class="doc-number">${params.estimate_number}</div>
        </div>
      </div>

      <div class="section">
        <div class="label">Job Address</div>
        <div class="value">${params.job_address}</div>
      </div>

      ${params.notes ? `
      <div class="section">
        <div class="label">Scope of Work</div>
        <div class="notes">${params.notes}</div>
      </div>
      ` : ''}

      <div class="total-box">
        <div class="total-label">Total Project Price</div>
        <div class="total-amount">$${params.total_price.toFixed(2)}</div>
      </div>

      <div class="footer">
        ${params.company_name} &bull; Generated ${new Date().toLocaleDateString()}
      </div>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'Letter', printBackground: true });
  await browser.close();
  return Buffer.from(pdf);
}

export async function generateInvoicePdf(params: {
  invoice_number: string;
  customer_name: string;
  job_address: string;
  line_items: Array<{ description: string; qty: number; unit_price: number; taxable: boolean }>;
  state_rate: number;
  local_rate: number;
  due_date: string;
  notes?: string;
  company_name: string;
  logo_url?: string;
  exemption_type?: string;
}): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const subtotal = params.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0);
  const taxable = params.line_items.filter((li) => li.taxable && !params.exemption_type).reduce((s, li) => s + li.qty * li.unit_price, 0);
  const stateTax = taxable * params.state_rate;
  const localTax = taxable * params.local_rate;
  const total = subtotal + stateTax + localTax;

  const lineRows = params.line_items
    .map(
      (li) => `
    <tr>
      <td>${li.description}</td>
      <td style="text-align:right">${li.qty}</td>
      <td style="text-align:right">$${li.unit_price.toFixed(2)}</td>
      <td style="text-align:right">$${(li.qty * li.unit_price).toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 48px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .doc-title { font-size: 32px; font-weight: 700; color: #007AFF; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f5f5f5; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
        td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
        .totals { margin-left: auto; width: 320px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
        .total-final { font-size: 20px; font-weight: 700; padding-top: 8px; border-top: 2px solid #007AFF; color: #007AFF; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${params.logo_url ? `<img src="${params.logo_url}" style="max-height:60px;max-width:200px" alt="Logo">` : `<div style="font-size:24px;font-weight:700">${params.company_name}</div>`}
        </div>
        <div style="text-align:right">
          <div class="doc-title">INVOICE</div>
          <div style="color:#666">${params.invoice_number}</div>
          <div style="color:#666;margin-top:8px">Due: ${new Date(params.due_date).toLocaleDateString()}</div>
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div style="font-size:12px;color:#999;text-transform:uppercase">Bill To</div>
        <div style="font-size:16px;font-weight:600">${params.customer_name}</div>
        <div style="color:#666">${params.job_address}</div>
      </div>

      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>State Tax (${(params.state_rate * 100).toFixed(2)}%)</span><span>$${stateTax.toFixed(2)}</span></div>
        <div class="total-row"><span>Local Tax (${(params.local_rate * 100).toFixed(2)}%)</span><span>$${localTax.toFixed(2)}</span></div>
        ${params.exemption_type ? `<div class="total-row" style="color:#34C759"><span>Tax Exemption (${params.exemption_type})</span><span>Applied</span></div>` : ''}
        <div class="total-row total-final"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      </div>

      ${params.notes ? `<div style="margin-top:40px;font-size:12px;color:#666">${params.notes}</div>` : ''}
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'Letter', printBackground: true });
  await browser.close();
  return Buffer.from(pdf);
}

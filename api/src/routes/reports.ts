import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { computeInvoiceTotals } from '../lib/invoiceTotals';

export const reportsRouter = Router();

// Taxable base and tax actually charged for one invoice, applying the invoice
// discount (and zeroing out when the invoice is exempt). Matches the canonical
// money math used by the PDF / email / Stripe charge.
function invoiceTax(inv: {
  line_items: unknown;
  discount_type: string | null;
  discount_value: unknown;
  tax_profile: { state_rate: unknown; local_rate: unknown };
  exempt: boolean;
}) {
  if (inv.exempt) return { taxableAmount: 0, stateTax: 0, localTax: 0 };
  const { taxableAmount, stateTax, localTax } = computeInvoiceTotals({
    line_items: inv.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>,
    discount_type: inv.discount_type,
    discount_value: inv.discount_value ? Number(inv.discount_value) : null,
    state_rate: Number(inv.tax_profile.state_rate),
    local_rate: Number(inv.tax_profile.local_rate),
  });
  return { taxableAmount, stateTax, localTax };
}

function dateRange(start?: string, end?: string) {
  const range: Record<string, Date> = {};
  if (start) range.gte = new Date(start);
  if (end) range.lte = new Date(end);
  return Object.keys(range).length ? range : undefined;
}

reportsRouter.get('/tax', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL', 'SENT'] },
        deleted_at: null,
        ...(dateFilter ? { created_at: dateFilter } : {}),
      },
      include: { tax_profile: true, exemptions: true },
    });

    // Iowa local option sales tax is remitted by county, so group by county
    // (fall back to municipality for profiles without one).
    interface TaxEntry {
      county: string;
      state_code: string;
      state_rate: number;
      local_rate: number;
      invoice_count: number;
      taxable_subtotal: number;
      state_tax_collected: number;
      local_tax_collected: number;
      total_tax_collected: number;
      exempt_count: number;
    }

    const byCounty: Record<string, TaxEntry> = {};

    for (const inv of invoices) {
      const county = inv.tax_profile.county
        ? `${inv.tax_profile.county} County`
        : inv.tax_profile.municipality;
      if (!byCounty[county]) {
        byCounty[county] = {
          county,
          state_code: inv.tax_profile.state_code,
          state_rate: Number(inv.tax_profile.state_rate),
          local_rate: Number(inv.tax_profile.local_rate),
          invoice_count: 0,
          taxable_subtotal: 0,
          state_tax_collected: 0,
          local_tax_collected: 0,
          total_tax_collected: 0,
          exempt_count: 0,
        };
      }

      const exemption = inv.exemptions[0];
      const { taxableAmount, stateTax, localTax } = invoiceTax({
        line_items: inv.line_items,
        discount_type: inv.discount_type,
        discount_value: inv.discount_value,
        tax_profile: inv.tax_profile,
        exempt: !!exemption,
      });

      byCounty[county].invoice_count++;
      byCounty[county].taxable_subtotal += taxableAmount;
      byCounty[county].state_tax_collected += stateTax;
      byCounty[county].local_tax_collected += localTax;
      byCounty[county].total_tax_collected += stateTax + localTax;
      if (exemption) byCounty[county].exempt_count++;
    }

    res.json({ data: Object.values(byCounty) });
  } catch {
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
});

reportsRouter.get('/tax/export', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'PARTIAL', 'SENT'] },
        deleted_at: null,
        ...(dateFilter ? { created_at: dateFilter } : {}),
      },
      include: { tax_profile: true, exemptions: true, job: { include: { customer: true } }, customer: true },
    });

    const rows = invoices.map((inv) => {
      const { taxableAmount: taxable, stateTax, localTax } = invoiceTax({
        line_items: inv.line_items,
        discount_type: inv.discount_type,
        discount_value: inv.discount_value,
        tax_profile: inv.tax_profile,
        exempt: inv.exemptions.length > 0,
      });
      const customerName = inv.job?.customer?.name ?? inv.customer?.name ?? '';
      return `"${inv.invoice_number}","${customerName}","${inv.tax_profile.state_code}","${inv.tax_profile.county ? `${inv.tax_profile.county} County` : ''}","${inv.tax_profile.municipality}",${taxable.toFixed(2)},${stateTax.toFixed(2)},${localTax.toFixed(2)},"${inv.exemptions.length ? inv.exemptions[0].exemption_type : ''}"`;
    });

    const csv = ['invoice_number,customer,state,county,municipality,taxable_amount,state_tax,local_tax,exemption', ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tax-report.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export tax report' });
  }
});

reportsRouter.get('/tax/outstanding', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['PAID'] },
        deleted_at: null,
        ...(dateFilter ? { created_at: dateFilter } : {}),
      },
      include: { tax_profile: true, exemptions: true, job: { include: { customer: true } }, customer: true },
      orderBy: { due_date: 'asc' },
    });

    interface OutstandingEntry {
      county: string;
      state_rate: number;
      local_rate: number;
      invoice_count: number;
      taxable_subtotal: number;
      state_tax_outstanding: number;
      local_tax_outstanding: number;
      total_tax_outstanding: number;
    }

    const byMunicipality: Record<string, OutstandingEntry> = {};

    for (const inv of invoices) {
      const key = inv.tax_profile.county
        ? `${inv.tax_profile.county} County`
        : inv.tax_profile.municipality;
      if (!byMunicipality[key]) {
        byMunicipality[key] = {
          county: key,
          state_rate: Number(inv.tax_profile.state_rate),
          local_rate: Number(inv.tax_profile.local_rate),
          invoice_count: 0,
          taxable_subtotal: 0,
          state_tax_outstanding: 0,
          local_tax_outstanding: 0,
          total_tax_outstanding: 0,
        };
      }
      const exemption = inv.exemptions[0];
      const { taxableAmount, stateTax, localTax } = invoiceTax({
        line_items: inv.line_items,
        discount_type: inv.discount_type,
        discount_value: inv.discount_value,
        tax_profile: inv.tax_profile,
        exempt: !!exemption,
      });

      byMunicipality[key].invoice_count++;
      byMunicipality[key].taxable_subtotal += taxableAmount;
      byMunicipality[key].state_tax_outstanding += stateTax;
      byMunicipality[key].local_tax_outstanding += localTax;
      byMunicipality[key].total_tax_outstanding += stateTax + localTax;
    }

    const rows = Object.values(byMunicipality).sort((a, b) => b.total_tax_outstanding - a.total_tax_outstanding);
    res.json({ data: rows });
  } catch {
    res.status(500).json({ error: 'Failed to generate outstanding tax report' });
  }
});

reportsRouter.get('/profit', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const jobs = await prisma.job.findMany({
      where: {
        deleted_at: null,
        ...(dateFilter ? { created_at: dateFilter } : {}),
      },
      include: {
        customer: true,
        invoices: {
          where: { status: { in: ['PAID', 'PARTIAL'] }, deleted_at: null },
          include: { payments: true },
        },
        labor: true,
        expenses: true,
        estimates: {
          where: { status: 'APPROVED', deleted_at: null },
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    const rows = jobs.map((job) => {
      const revenue = job.invoices.reduce(
        (s, inv) => s + inv.payments.reduce((ps, p) => ps + Number(p.amount), 0),
        0
      );
      const laborCost = job.labor.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
      const expenseCost = job.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const materialCost = job.estimates[0]
        ? (job.estimates[0].line_items as Array<{ type: string; qty: number; our_cost: number }>)
            .filter((li) => li.type === 'material')
            .reduce((s, li) => s + li.qty * li.our_cost, 0)
        : 0;
      const totalCost = laborCost + expenseCost + materialCost;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        job_id: job.id,
        job_name: job.name,
        customer_name: job.customer.name,
        address: job.address,
        status: job.status,
        revenue,
        labor_cost: laborCost,
        expense_cost: expenseCost,
        material_cost: materialCost,
        total_cost: totalCost,
        gross_profit: profit,
        margin_percent: Math.round(margin * 10) / 10,
      };
    });

    res.json({ data: rows });
  } catch {
    res.status(500).json({ error: 'Failed to generate profit report' });
  }
});

reportsRouter.get('/profit/export', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const jobs = await prisma.job.findMany({
      where: { deleted_at: null, ...(dateFilter ? { created_at: dateFilter } : {}) },
      include: {
        customer: true,
        invoices: { where: { status: { in: ['PAID', 'PARTIAL'] }, deleted_at: null }, include: { payments: true } },
        labor: true,
        expenses: true,
        estimates: { where: { status: 'APPROVED', deleted_at: null }, take: 1, orderBy: { created_at: 'desc' } },
      },
    });

    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = jobs.map((job) => {
      const revenue = job.invoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
      const laborCost = job.labor.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0);
      const expenseCost = job.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const materialCost = job.estimates[0]
        ? (job.estimates[0].line_items as Array<{ type: string; qty: number; our_cost: number }>)
            .filter((li) => li.type === 'material')
            .reduce((s, li) => s + li.qty * li.our_cost, 0)
        : 0;
      const totalCost = laborCost + expenseCost + materialCost;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return [
        esc(job.name), esc(job.customer.name), esc(job.status),
        revenue.toFixed(2), totalCost.toFixed(2), profit.toFixed(2), (Math.round(margin * 10) / 10).toFixed(1),
      ].join(',');
    });

    const csv = ['job_name,customer,status,revenue,total_cost,gross_profit,margin_percent', ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-report.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export profit report' });
  }
});

reportsRouter.get('/materials', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const expenses = await prisma.expense.findMany({
      where: {
        category: 'MATERIALS',
        ...(dateFilter ? { created_at: dateFilter } : {}),
      },
      include: { job: { include: { customer: true } } },
      orderBy: { expense_date: 'desc' },
    });

    const labor = await prisma.laborEntry.findMany({
      where: dateFilter ? { created_at: dateFilter } : {},
      include: { job: { include: { customer: true } }, user: { select: { name: true } } },
      orderBy: { work_date: 'desc' },
    });

    res.json({ data: { materials: expenses, labor } });
  } catch {
    res.status(500).json({ error: 'Failed to generate materials report' });
  }
});

reportsRouter.get('/materials/export', async (req, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const dateFilter = dateRange(start, end);

    const expenses = await prisma.expense.findMany({
      where: { category: 'MATERIALS', ...(dateFilter ? { created_at: dateFilter } : {}) },
      include: { job: { include: { customer: true } } },
      orderBy: { expense_date: 'desc' },
    });
    const labor = await prisma.laborEntry.findMany({
      where: dateFilter ? { created_at: dateFilter } : {},
      include: { job: { include: { customer: true } }, user: { select: { name: true } } },
      orderBy: { work_date: 'desc' },
    });

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const matRows = expenses.map((e) => [
      'material', esc(e.expense_date.toISOString().slice(0, 10)), esc(e.job?.name ?? ''),
      esc(e.vendor ?? ''), esc(e.description ?? ''), Number(e.amount).toFixed(2),
    ].join(','));
    const laborRows = labor.map((l) => [
      'labor', esc(l.work_date.toISOString().slice(0, 10)), esc(l.job?.name ?? ''),
      esc(l.user?.name ?? ''), esc(l.description ?? ''), Number(l.hours).toFixed(2),
    ].join(','));

    const csv = ['type,date,job_name,vendor_or_user,description,amount_or_hours', ...matRows, ...laborRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="materials-hours-report.csv"');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export materials report' });
  }
});

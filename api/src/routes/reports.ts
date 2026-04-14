import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const reportsRouter = Router();

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

    interface TaxEntry {
      profile_name: string;
      state_code: string;
      municipality: string;
      state_rate: number;
      local_rate: number;
      taxable_subtotal: number;
      state_tax_collected: number;
      local_tax_collected: number;
      exempt_count: number;
    }

    const byJurisdiction: Record<string, TaxEntry> = {};

    for (const inv of invoices) {
      const key = inv.tax_profile_id;
      if (!byJurisdiction[key]) {
        byJurisdiction[key] = {
          profile_name: inv.tax_profile.name,
          state_code: inv.tax_profile.state_code,
          municipality: inv.tax_profile.municipality,
          state_rate: Number(inv.tax_profile.state_rate),
          local_rate: Number(inv.tax_profile.local_rate),
          taxable_subtotal: 0,
          state_tax_collected: 0,
          local_tax_collected: 0,
          exempt_count: 0,
        };
      }

      const exemption = inv.exemptions[0];
      const lineItems = inv.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
      const taxableAmount = lineItems
        .filter((li) => li.taxable && !exemption)
        .reduce((s, li) => s + li.qty * li.unit_price, 0);

      byJurisdiction[key].taxable_subtotal += taxableAmount;
      byJurisdiction[key].state_tax_collected += taxableAmount * Number(inv.tax_profile.state_rate);
      byJurisdiction[key].local_tax_collected += taxableAmount * Number(inv.tax_profile.local_rate);
      if (exemption) byJurisdiction[key].exempt_count++;
    }

    res.json({ data: Object.values(byJurisdiction) });
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
      const lineItems = inv.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
      const taxable = lineItems.filter((li) => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
      const stateTax = taxable * Number(inv.tax_profile.state_rate);
      const localTax = taxable * Number(inv.tax_profile.local_rate);
      const customerName = inv.job?.customer?.name ?? inv.customer?.name ?? '';
      return `"${inv.invoice_number}","${customerName}","${inv.tax_profile.state_code}","${inv.tax_profile.municipality}",${taxable.toFixed(2)},${stateTax.toFixed(2)},${localTax.toFixed(2)},"${inv.exemptions.length ? inv.exemptions[0].exemption_type : ''}"`;
    });

    const csv = ['invoice_number,customer,state,municipality,taxable_amount,state_tax,local_tax,exemption', ...rows].join('\n');
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
        status: 'SENT',
        deleted_at: null,
        ...(dateFilter ? { due_date: dateFilter } : {}),
      },
      include: { tax_profile: true, exemptions: true, job: { include: { customer: true } }, customer: true },
      orderBy: { due_date: 'asc' },
    });

    interface OutstandingEntry {
      municipality: string;
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
      const key = inv.tax_profile.municipality;
      if (!byMunicipality[key]) {
        byMunicipality[key] = {
          municipality: inv.tax_profile.municipality,
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
      const lineItems = inv.line_items as Array<{ qty: number; unit_price: number; taxable: boolean }>;
      const taxableAmount = lineItems
        .filter((li) => li.taxable && !exemption)
        .reduce((s, li) => s + li.qty * li.unit_price, 0);
      const stateTax = taxableAmount * Number(inv.tax_profile.state_rate);
      const localTax = taxableAmount * Number(inv.tax_profile.local_rate);

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
          where: { status: { in: ['PAID', 'PARTIAL'] } },
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
  // Similar to profit report but as CSV
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="profit-report.csv"');
  res.send('job_name,customer,status,revenue,total_cost,gross_profit,margin_percent\n(see /reports/profit for data)');
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

reportsRouter.get('/materials/export', async (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="materials-hours-report.csv"');
  res.send('type,date,job_name,vendor_or_user,description,amount_or_hours\n');
});

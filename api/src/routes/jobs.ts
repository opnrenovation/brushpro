import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const jobsRouter = Router();

jobsRouter.get('/', async (req, res) => {
  try {
    const { status, customer_id, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { deleted_at: null };
    if (status) where.status = status;
    if (customer_id) where.customer_id = customer_id;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { customer: true },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ data: jobs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

jobsRouter.post('/', async (req, res) => {
  try {
    // Default labor_rate from company settings
    if (!req.body.labor_rate) {
      const settings = await prisma.companySettings.findFirst();
      req.body.labor_rate = settings?.default_labor_rate || 0;
    }
    const job = await prisma.job.create({ data: req.body });
    res.status(201).json({ data: job });
  } catch {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

jobsRouter.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        estimates: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } },
        labor: { orderBy: { work_date: 'desc' } },
        expenses: { orderBy: { expense_date: 'desc' } },
        invoices: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } },
      },
    });
    if (!job || job.deleted_at) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ data: job });
  } catch {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

jobsRouter.patch('/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    const job = await prisma.job.update({ where: { id: req.params.id }, data });
    res.json({ data: job });
  } catch {
    res.status(500).json({ error: 'Failed to update job' });
  }
});

jobsRouter.delete('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job || job.deleted_at) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    await prisma.job.update({ where: { id: req.params.id }, data: { deleted_at: new Date() } });
    res.json({ data: { id: req.params.id } });
  } catch {
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

jobsRouter.get('/:id/profitability', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
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

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const revenue = job.invoices.reduce(
      (sum, inv) => sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0),
      0
    );

    const labor_cost = job.labor.reduce(
      (sum, l) => sum + Number(l.hours) * Number(l.rate),
      0
    );

    const expense_cost = job.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const material_cost = job.estimates[0]
      ? (job.estimates[0].line_items as Array<{ type: string; qty: number; our_cost: number }>)
          .filter((li) => li.type === 'material')
          .reduce((sum, li) => sum + li.qty * li.our_cost, 0)
      : 0;

    const total_cost = labor_cost + expense_cost + material_cost;
    const gross_profit = revenue - total_cost;
    const margin_percent = revenue > 0 ? (gross_profit / revenue) * 100 : 0;

    res.json({
      data: {
        job_id: job.id,
        revenue,
        labor_cost,
        expense_cost,
        material_cost,
        total_cost,
        gross_profit,
        margin_percent: Math.round(margin_percent * 10) / 10,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to compute profitability' });
  }
});

jobsRouter.post('/:id/labor', async (req: AuthRequest, res) => {
  try {
    const { description, hours, rate, work_date } = req.body;
    if (!description || !hours || !rate || !work_date) {
      res.status(400).json({ error: 'description, hours, rate, and work_date are required' });
      return;
    }
    const entry = await prisma.laborEntry.create({
      data: {
        job_id: req.params.id,
        user_id: req.user!.id,
        description,
        hours,
        rate,
        work_date: new Date(work_date),
      },
    });
    res.status(201).json({ data: entry });
  } catch {
    res.status(500).json({ error: 'Failed to create labor entry' });
  }
});

jobsRouter.delete('/:id/labor/:entryId', async (req, res) => {
  try {
    await prisma.laborEntry.delete({ where: { id: req.params.entryId } });
    res.json({ data: { id: req.params.entryId } });
  } catch {
    res.status(500).json({ error: 'Failed to delete labor entry' });
  }
});

jobsRouter.post('/:id/expenses', async (req, res) => {
  try {
    const { vendor, description, amount, expense_date, category, notes } = req.body;
    if (!vendor || !description || !amount || !expense_date || !category) {
      res.status(400).json({ error: 'vendor, description, amount, expense_date, and category are required' });
      return;
    }
    const expense = await prisma.expense.create({
      data: {
        job_id: req.params.id,
        vendor,
        description,
        amount,
        expense_date: new Date(expense_date),
        category,
        notes: notes || null,
      },
    });
    res.status(201).json({ data: expense });
  } catch {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

jobsRouter.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    res.json({ data: { id: req.params.expenseId } });
  } catch {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

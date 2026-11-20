import { Router } from 'express';
import { Prisma, PayFrequency } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireOwner } from '../middleware/auth';
import { generateStubs, recalcStub, refreshRunTotals } from '../lib/payroll';

export const payrollRouter = Router();
payrollRouter.use(requireOwner);

const FREQUENCIES: PayFrequency[] = ['WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY'];

function parseDay(s: unknown): Date | undefined {
  if (!s || typeof s !== 'string') return undefined;
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  return isNaN(d.getTime()) ? undefined : d;
}

const runInclude = {
  stubs: {
    orderBy: [{ employee: { last_name: 'asc' as const } }, { employee: { first_name: 'asc' as const } }],
    include: {
      employee: {
        select: {
          id: true, first_name: true, last_name: true, position: true, address: true,
          federal_withholding_pct: true, state_withholding_pct: true,
        },
      },
    },
  },
};

async function loadRun(id: string) {
  const run = await prisma.payRun.findUnique({ where: { id }, include: runInclude });
  if (!run) return null;
  // Crew time still waiting for review in this period is not paid yet.
  const pending_time_entries = await prisma.timeEntry.count({
    where: {
      status: 'PENDING',
      work_date: { gte: run.period_start, lte: run.period_end },
    },
  });
  return { ...run, pending_time_entries };
}

// ── Summary (YTD by employee) ──────────────────────────────────────────────

payrollRouter.get('/summary', async (req, res) => {
  try {
    const year = parseInt((req.query.year as string) || `${new Date().getUTCFullYear()}`, 10);
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const grouped = await prisma.payStub.groupBy({
      by: ['employee_id'],
      where: { pay_run: { pay_date: { gte: from, lt: to }, status: { not: 'DRAFT' } } },
      _sum: {
        regular_hours: true, overtime_hours: true, gross_pay: true, federal_withholding: true,
        state_withholding: true, social_security: true, medicare: true, other_deductions: true,
        reimbursement: true, net_pay: true, employer_social_security: true, employer_medicare: true,
      },
    });
    const employees = await prisma.employee.findMany({
      where: { id: { in: grouped.map((g) => g.employee_id) } },
      select: { id: true, first_name: true, last_name: true, worker_type: true },
    });
    const byId = new Map(employees.map((e) => [e.id, e]));
    const rows = grouped
      .map((g) => ({ employee: byId.get(g.employee_id), ...g._sum }))
      .sort((a, b) => `${a.employee?.last_name}`.localeCompare(`${b.employee?.last_name}`));
    res.json({ data: { year, rows } });
  } catch {
    res.status(500).json({ error: 'Failed to build payroll summary' });
  }
});

// ── Pay runs ───────────────────────────────────────────────────────────────

payrollRouter.get('/runs', async (_req, res) => {
  try {
    const runs = await prisma.payRun.findMany({
      orderBy: { pay_date: 'desc' },
      include: { _count: { select: { stubs: true } } },
    });
    res.json({ data: runs });
  } catch {
    res.status(500).json({ error: 'Failed to fetch pay runs' });
  }
});

payrollRouter.post('/runs', async (req: AuthRequest, res) => {
  try {
    const period_start = parseDay(req.body.period_start);
    const period_end = parseDay(req.body.period_end);
    const pay_date = parseDay(req.body.pay_date);
    const frequency = (req.body.frequency || 'BIWEEKLY') as PayFrequency;
    if (!period_start || !period_end || !pay_date) {
      res.status(400).json({ error: 'Period start, period end and pay date are required' });
      return;
    }
    if (period_end < period_start) {
      res.status(400).json({ error: 'Period end must be on or after period start' });
      return;
    }
    if (!FREQUENCIES.includes(frequency)) {
      res.status(400).json({ error: 'Invalid pay frequency' });
      return;
    }
    const run = await prisma.payRun.create({
      data: { period_start, period_end, pay_date, frequency, notes: req.body.notes || null, created_by: req.user?.id },
    });
    await generateStubs(run.id);
    res.status(201).json({ data: await loadRun(run.id) });
  } catch (err) {
    console.error('[payroll] create run failed:', err);
    res.status(500).json({ error: 'Failed to create pay run' });
  }
});

payrollRouter.get('/runs/:id', async (req, res) => {
  try {
    const run = await loadRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Pay run not found' });
      return;
    }
    res.json({ data: run });
  } catch {
    res.status(500).json({ error: 'Failed to fetch pay run' });
  }
});

payrollRouter.patch('/runs/:id', async (req, res) => {
  try {
    const run = await prisma.payRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      res.status(404).json({ error: 'Pay run not found' });
      return;
    }
    const data: Prisma.PayRunUpdateInput = {};
    if ('notes' in req.body) data.notes = req.body.notes || null;
    if (run.status === 'DRAFT') {
      const ps = parseDay(req.body.period_start);
      const pe = parseDay(req.body.period_end);
      const pd = parseDay(req.body.pay_date);
      if (ps) data.period_start = ps;
      if (pe) data.period_end = pe;
      if (pd) data.pay_date = pd;
      if (req.body.frequency && FREQUENCIES.includes(req.body.frequency)) data.frequency = req.body.frequency;
    }
    await prisma.payRun.update({ where: { id: run.id }, data });
    if (run.status === 'DRAFT' && (data.period_start || data.period_end || data.pay_date || data.frequency)) {
      await generateStubs(run.id);
    }
    res.json({ data: await loadRun(run.id) });
  } catch {
    res.status(500).json({ error: 'Failed to update pay run' });
  }
});

payrollRouter.post('/runs/:id/recalculate', async (req, res) => {
  try {
    const run = await prisma.payRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      res.status(404).json({ error: 'Pay run not found' });
      return;
    }
    if (run.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only draft pay runs can be recalculated. Reopen it first.' });
      return;
    }
    await generateStubs(run.id);
    res.json({ data: await loadRun(run.id) });
  } catch {
    res.status(500).json({ error: 'Failed to recalculate pay run' });
  }
});

payrollRouter.patch('/runs/:id/stubs/:stubId', async (req, res) => {
  try {
    const stub = await prisma.payStub.findUnique({ where: { id: req.params.stubId }, include: { pay_run: true } });
    if (!stub || stub.pay_run_id !== req.params.id) {
      res.status(404).json({ error: 'Pay stub not found' });
      return;
    }
    const b = req.body;
    const data: Prisma.PayStubUpdateInput = {};
    // Payment details can be recorded after finalizing; amounts cannot.
    if ('payment_method' in b) data.payment_method = b.payment_method || null;
    if ('check_number' in b) data.check_number = b.check_number || null;
    if ('notes' in b) data.notes = b.notes || null;

    const amountKeys = ['regular_hours', 'overtime_hours', 'bonus', 'reimbursement', 'other_deductions', 'pay_rate'] as const;
    const touchesAmounts = amountKeys.some((k) => k in b) || 'other_deductions_note' in b;
    if (touchesAmounts && stub.pay_run.status !== 'DRAFT') {
      res.status(409).json({ error: 'This pay run is finalized. Reopen it to change amounts.' });
      return;
    }
    for (const k of amountKeys) {
      if (!(k in b)) continue;
      const v = Number(b[k] === '' ? 0 : b[k]);
      if (!Number.isFinite(v) || v < 0) {
        res.status(400).json({ error: `${k.replace(/_/g, ' ')} must be zero or more` });
        return;
      }
      data[k] = v;
    }
    if ('other_deductions_note' in b) data.other_deductions_note = b.other_deductions_note || null;

    await prisma.payStub.update({ where: { id: stub.id }, data });
    if (touchesAmounts) {
      await recalcStub(stub.id);
      await refreshRunTotals(stub.pay_run_id);
    }
    res.json({ data: await loadRun(stub.pay_run_id) });
  } catch {
    res.status(500).json({ error: 'Failed to update pay stub' });
  }
});

payrollRouter.delete('/runs/:id/stubs/:stubId', async (req, res) => {
  try {
    const stub = await prisma.payStub.findUnique({ where: { id: req.params.stubId }, include: { pay_run: true } });
    if (!stub || stub.pay_run_id !== req.params.id) {
      res.status(404).json({ error: 'Pay stub not found' });
      return;
    }
    if (stub.pay_run.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only draft pay runs can be changed' });
      return;
    }
    await prisma.payStub.delete({ where: { id: stub.id } });
    await refreshRunTotals(stub.pay_run_id);
    res.json({ data: await loadRun(stub.pay_run_id) });
  } catch {
    res.status(500).json({ error: 'Failed to remove pay stub' });
  }
});

async function setStatus(id: string, from: string[], to: 'DRAFT' | 'FINALIZED' | 'PAID') {
  const run = await prisma.payRun.findUnique({ where: { id } });
  if (!run) return { code: 404, error: 'Pay run not found' };
  if (!from.includes(run.status)) return { code: 409, error: `Pay run is ${run.status.toLowerCase()}` };
  const now = new Date();
  await prisma.payRun.update({
    where: { id },
    data: {
      status: to,
      finalized_at: to === 'FINALIZED' ? now : to === 'DRAFT' ? null : run.finalized_at ?? now,
      paid_at: to === 'PAID' ? now : null,
    },
  });
  return { code: 200 };
}

payrollRouter.post('/runs/:id/finalize', async (req, res) => {
  try {
    // Recalculate once more so finalized numbers reflect the latest settings.
    const run = await prisma.payRun.findUnique({ where: { id: req.params.id }, include: { stubs: true } });
    if (run?.status === 'DRAFT') {
      for (const s of run.stubs) await recalcStub(s.id);
      await refreshRunTotals(run.id);
    }
    const r = await setStatus(req.params.id, ['DRAFT'], 'FINALIZED');
    if (r.code !== 200) {
      res.status(r.code).json({ error: r.error });
      return;
    }
    res.json({ data: await loadRun(req.params.id) });
  } catch {
    res.status(500).json({ error: 'Failed to finalize pay run' });
  }
});

payrollRouter.post('/runs/:id/mark-paid', async (req, res) => {
  try {
    const r = await setStatus(req.params.id, ['FINALIZED'], 'PAID');
    if (r.code !== 200) {
      res.status(r.code).json({ error: r.error });
      return;
    }
    res.json({ data: await loadRun(req.params.id) });
  } catch {
    res.status(500).json({ error: 'Failed to mark pay run paid' });
  }
});

payrollRouter.post('/runs/:id/reopen', async (req, res) => {
  try {
    const r = await setStatus(req.params.id, ['FINALIZED', 'PAID'], 'DRAFT');
    if (r.code !== 200) {
      res.status(r.code).json({ error: r.error });
      return;
    }
    res.json({ data: await loadRun(req.params.id) });
  } catch {
    res.status(500).json({ error: 'Failed to reopen pay run' });
  }
});

payrollRouter.delete('/runs/:id', async (req, res) => {
  try {
    const run = await prisma.payRun.findUnique({ where: { id: req.params.id } });
    if (!run) {
      res.status(404).json({ error: 'Pay run not found' });
      return;
    }
    if (run.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only draft pay runs can be deleted. Reopen it first.' });
      return;
    }
    await prisma.payRun.delete({ where: { id: run.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete pay run' });
  }
});

payrollRouter.get('/runs/:id/export', async (req, res) => {
  try {
    const run = await loadRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Pay run not found' });
      return;
    }
    const cols = [
      'Employee', 'Worker Type', 'Pay Type', 'Rate', 'Regular Hours', 'Overtime Hours', 'Regular Pay',
      'Overtime Pay', 'Bonus', 'Gross Pay', 'Federal WH', 'State WH', 'Social Security', 'Medicare',
      'Other Deductions', 'Reimbursement', 'Net Pay', 'Employer SS', 'Employer Medicare', 'Method', 'Check #',
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(',')];
    for (const s of run.stubs) {
      lines.push([
        `${s.employee.first_name} ${s.employee.last_name}`, s.worker_type, s.pay_type, s.pay_rate,
        s.regular_hours, s.overtime_hours, s.regular_pay, s.overtime_pay, s.bonus, s.gross_pay,
        s.federal_withholding, s.state_withholding, s.social_security, s.medicare, s.other_deductions,
        s.reimbursement, s.net_pay, s.employer_social_security, s.employer_medicare,
        s.payment_method || '', s.check_number || '',
      ].map(esc).join(','));
    }
    const day = run.pay_date.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${day}.csv"`);
    res.send(lines.join('\n'));
  } catch {
    res.status(500).json({ error: 'Failed to export pay run' });
  }
});

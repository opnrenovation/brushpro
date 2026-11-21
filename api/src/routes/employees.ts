import { Router } from 'express';
import { Prisma, Employee } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireOwner } from '../middleware/auth';
import { buildTimecards, listPeriods } from '../lib/timecards';
import { centralDateIso, centralTime, dayStart, isIsoDay, addDays, workedHours } from '../lib/time';

// Employees, their time entries, and pay history. Pay rates and withholding
// are sensitive, so the whole module is OWNER-only.
export const employeesRouter = Router();
employeesRouter.use(requireOwner);

const EMPLOYEE_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'address', 'position', 'status',
  'worker_type', 'pay_type', 'pay_rate', 'overtime_eligible',
  'federal_withholding_pct', 'state_withholding_pct', 'hire_date', 'termination_date',
  'emergency_contact_name', 'emergency_contact_phone', 'notes', 'app_access',
] as const;
const DATE_FIELDS = new Set(['hire_date', 'termination_date']);

function pickEmployee(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const k of EMPLOYEE_FIELDS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (v === '') v = null;
    if (DATE_FIELDS.has(k) && v) v = new Date(v as string);
    data[k] = v;
  }
  return data;
}

// Never send PIN hashes or lockout state to the browser.
function publicEmployee(e: Employee) {
  const { pin_hash, failed_pin_attempts: _f, pin_locked_until, ...rest } = e;
  return { ...rest, has_pin: !!pin_hash, pin_locked: !!(pin_locked_until && pin_locked_until > new Date()) };
}

// Applies a new crew-app PIN from the request body, if one was sent.
async function withPin(data: Record<string, unknown>, body: Record<string, unknown>) {
  if (body.pin === undefined || body.pin === '') return null;
  const pin = String(body.pin);
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4 to 6 digits';
  data.pin_hash = await bcrypt.hash(pin, 10);
  data.failed_pin_attempts = 0;
  data.pin_locked_until = null;
  return null;
}

// Crew app access needs a way to sign in: email or phone, plus a PIN.
function accessError(merged: { app_access?: unknown; email?: unknown; phone?: unknown; pin_hash?: unknown }) {
  if (!merged.app_access) return null;
  if (!merged.email && !String(merged.phone || '').replace(/\D/g, '')) return 'Add an email or phone number so they can sign in to the crew app';
  if (!merged.pin_hash) return 'Set a PIN to turn on crew app access';
  return null;
}

function parseDate(s: unknown): Date | undefined {
  if (!s || typeof s !== 'string') return undefined;
  const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Time cards (the Time Cards screen) ────────────────────────────────────

const reviewer = (req: AuthRequest) =>
  req.user ? (req.user.name && req.user.name !== 'Admin' ? req.user.name : req.user.email) : null;

function periodFrom(q: Record<string, unknown>): { start: string; end: string } | null {
  if (!isIsoDay(q.start) || !isIsoDay(q.end) || q.end < q.start) return null;
  if (dayStart(q.end as string).getTime() - dayStart(q.start as string).getTime() > 62 * 86_400_000) return null;
  return { start: q.start as string, end: q.end as string };
}

employeesRouter.get('/timecards/periods', async (_req, res) => {
  try {
    res.json({ data: await listPeriods() });
  } catch {
    res.status(500).json({ error: 'Failed to load pay periods' });
  }
});

employeesRouter.get('/timecards', async (req, res) => {
  try {
    const p = periodFrom(req.query as Record<string, unknown>);
    if (!p) {
      res.status(400).json({ error: 'Pass start and end dates (YYYY-MM-DD)' });
      return;
    }
    res.json({ data: await buildTimecards(p.start, p.end) });
  } catch (err) {
    console.error('[timecards]', err);
    res.status(500).json({ error: 'Failed to build time cards' });
  }
});

// Approve whole time cards: every closed, pending shift in the period.
employeesRouter.post('/timecards/approve', async (req: AuthRequest, res) => {
  try {
    const p = periodFrom(req.body);
    const ids: string[] = Array.isArray(req.body.employee_ids) ? req.body.employee_ids : [];
    if (!p || !ids.length) {
      res.status(400).json({ error: 'Pass start, end and employee_ids' });
      return;
    }
    const r = await prisma.timeEntry.updateMany({
      where: {
        employee_id: { in: ids },
        work_date: { gte: dayStart(p.start), lte: dayStart(p.end) },
        status: 'PENDING',
        NOT: { clock_in: { not: null }, clock_out: null },
      },
      data: { status: 'APPROVED', reviewed_at: new Date(), reviewed_by: reviewer(req), review_note: null },
    });
    res.json({ data: { approved: r.count } });
  } catch {
    res.status(500).json({ error: 'Failed to approve time cards' });
  }
});

// Un-approve, unless that time is already in a finalized or paid pay run.
employeesRouter.post('/timecards/unapprove', async (req: AuthRequest, res) => {
  try {
    const p = periodFrom(req.body);
    const ids: string[] = Array.isArray(req.body.employee_ids) ? req.body.employee_ids : [];
    if (!p || !ids.length) {
      res.status(400).json({ error: 'Pass start, end and employee_ids' });
      return;
    }
    const locked = await prisma.payStub.findFirst({
      where: {
        employee_id: { in: ids },
        pay_run: { status: { in: ['FINALIZED', 'PAID'] }, period_start: { lte: dayStart(p.end) }, period_end: { gte: dayStart(p.start) } },
      },
      include: { pay_run: { select: { pay_date: true, status: true } } },
    });
    if (locked) {
      const when = locked.pay_run.pay_date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      res.status(409).json({
        error: `This time is in the ${when} pay run, which is ${locked.pay_run.status === 'PAID' ? 'paid' : 'finalized'}. Reopen that pay run first.`,
      });
      return;
    }
    const r = await prisma.timeEntry.updateMany({
      where: {
        employee_id: { in: ids },
        work_date: { gte: dayStart(p.start), lte: dayStart(p.end) },
        status: 'APPROVED',
      },
      data: { status: 'PENDING', reviewed_at: new Date(), reviewed_by: reviewer(req) },
    });
    res.json({ data: { removed: r.count } });
  } catch {
    res.status(500).json({ error: 'Failed to un-approve' });
  }
});

// Everyone the office can clock in or out right now.
employeesRouter.get('/punchable', async (_req, res) => {
  try {
    const [employees, open] = await Promise.all([
      prisma.employee.findMany({
        where: { deleted_at: null, status: 'ACTIVE' },
        select: { id: true, first_name: true, last_name: true, position: true },
        orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
      }),
      prisma.timeEntry.findMany({
        where: { clock_in: { not: null }, clock_out: null },
        include: { job: { select: { id: true, name: true } } },
      }),
    ]);
    const openBy = new Map(open.map((e) => [e.employee_id, e]));
    res.json({
      data: employees.map((e) => {
        const o = openBy.get(e.id);
        return {
          employee_id: e.id,
          name: `${e.first_name} ${e.last_name}`,
          position: e.position,
          on_clock: !!o,
          since: o?.clock_in?.toISOString() ?? null,
          job: o?.job ?? null,
        };
      }),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load crew' });
  }
});

const QUICK_PUNCH_REASONS: Record<string, string> = {
  missed_punch: 'Missed the punch',
  forgot_clock_out: 'Forgot to clock out',
  left_early: 'Left early',
  no_phone: 'No phone on site',
  paper_sheet_entry: 'From a paper sheet',
  other: 'Other',
};

// The office clocks someone in or out now. Recorded as entered by the office,
// never as a real clock-in.
employeesRouter.post('/quick-punch', async (req: AuthRequest, res) => {
  try {
    const { employee_id, action, job_id, reason, note } = req.body;
    const why = [QUICK_PUNCH_REASONS[reason] || 'Office punch', note].filter(Boolean).join(': ');
    const open = await prisma.timeEntry.findFirst({ where: { employee_id, clock_in: { not: null }, clock_out: null } });
    const now = new Date();
    if (action === 'in') {
      if (open) {
        res.status(409).json({ error: 'Already on the clock' });
        return;
      }
      const entry = await prisma.timeEntry.create({
        data: {
          employee_id, job_id: job_id || null, work_date: dayStart(centralDateIso(now)), hours: 0, clock_in: now,
          source: 'OWNER', status: 'APPROVED', reviewed_at: now, reviewed_by: reviewer(req), notes: `Office clock-in. ${why}`,
        },
      });
      res.status(201).json({ data: entry });
      return;
    }
    if (action === 'out') {
      if (!open || !open.clock_in) {
        res.status(409).json({ error: 'Not on the clock' });
        return;
      }
      const entry = await prisma.timeEntry.update({
        where: { id: open.id },
        data: {
          clock_out: now,
          hours: workedHours(open.clock_in, now, open.break_minutes),
          office_edited: open.source !== 'OWNER' ? true : open.office_edited,
          notes: [open.notes, `Office clock-out. ${why}`].filter(Boolean).join(' · '),
        },
      });
      res.json({ data: entry });
      return;
    }
    res.status(400).json({ error: 'action must be in or out' });
  } catch {
    res.status(500).json({ error: 'Failed to punch' });
  }
});

// ── Time off (from the crew app) ───────────────────────────────────────────

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

employeesRouter.get('/time-off', async (req, res) => {
  try {
    const view = (req.query.view as string) || 'open';
    const today = centralDateIso();
    const where: Prisma.TimeOffRequestWhereInput =
      view === 'open'
        ? { OR: [{ status: 'PENDING' }, { status: 'APPROVED', ends_on: { gte: dayStart(today) } }] }
        : { ends_on: { gte: dayStart(addDays(today, -90)) } };
    const rows = await prisma.timeOffRequest.findMany({
      where,
      orderBy: [{ starts_on: 'asc' }],
      include: { employee: { select: { id: true, first_name: true, last_name: true } } },
    });
    res.json({
      data: {
        today,
        requests: rows.map((r) => ({
          ...r,
          starts_on: isoDay(r.starts_on),
          ends_on: isoDay(r.ends_on),
          days: Math.round((r.ends_on.getTime() - r.starts_on.getTime()) / 86_400_000) + 1,
        })),
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load time off' });
  }
});

employeesRouter.post('/time-off/:id/decide', async (req: AuthRequest, res) => {
  try {
    const decision = req.body.decision;
    if (!['approve', 'deny'].includes(decision)) {
      res.status(400).json({ error: 'decision must be approve or deny' });
      return;
    }
    const row = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    if (row.kind !== 'REQUEST' || row.status === 'CANCELLED') {
      res.status(409).json({ error: row.status === 'CANCELLED' ? 'They withdrew this request' : 'Call-offs are reported, not decided' });
      return;
    }
    const updated = await prisma.timeOffRequest.update({
      where: { id: row.id },
      data: {
        status: decision === 'approve' ? 'APPROVED' : 'DENIED',
        decision_note: req.body.note || null,
        decided_at: new Date(),
        decided_by: reviewer(req),
      },
    });
    res.json({ data: updated });
  } catch {
    res.status(500).json({ error: 'Failed to decide' });
  }
});

// ── Announcements to every crew phone ─────────────────────────────────────

employeesRouter.get('/announcements', async (_req, res) => {
  try {
    const [items, crew] = await Promise.all([
      prisma.announcement.findMany({ orderBy: { published_at: 'desc' }, take: 50 }),
      prisma.employee.findMany({
        where: { deleted_at: null, status: 'ACTIVE', app_access: true },
        select: { news_read_at: true },
      }),
    ]);
    res.json({
      data: items.map((n) => ({
        ...n,
        read_by: crew.filter((c) => c.news_read_at && c.news_read_at >= n.published_at).length,
        crew_count: crew.length,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

employeesRouter.post('/announcements', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    if (!title || !body) {
      res.status(400).json({ error: 'Add a title and a message' });
      return;
    }
    const n = await prisma.announcement.create({
      data: { title: title.slice(0, 200), body: body.slice(0, 4000), created_by: reviewer(req) },
    });
    res.status(201).json({ data: n });
  } catch {
    res.status(500).json({ error: 'Failed to post' });
  }
});

employeesRouter.delete('/announcements/:id', async (req, res) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ── Time entries ───────────────────────────────────────────────────────────
// Registered before /:id so "time-entries" isn't read as an employee id.

employeesRouter.get('/time-entries', async (req, res) => {
  try {
    const { employee_id, job_id, from, to, status, open } = req.query as Record<string, string>;
    const where: Prisma.TimeEntryWhereInput = {};
    if (employee_id) where.employee_id = employee_id;
    if (job_id) where.job_id = job_id;
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status as Prisma.TimeEntryWhereInput['status'];
    if (open === '1') {
      where.clock_in = { not: null };
      where.clock_out = null;
    }
    const gte = parseDate(from);
    const lte = parseDate(to);
    if (gte || lte) {
      where.work_date = {};
      if (gte) where.work_date.gte = gte;
      if (lte) where.work_date.lte = new Date(lte.getTime() + 86_399_999);
    }
    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: [{ work_date: 'desc' }, { created_at: 'desc' }],
      take: 500,
      include: {
        employee: { select: { id: true, first_name: true, last_name: true } },
        job: { select: { id: true, name: true } },
      },
    });
    res.json({ data: entries });
  } catch {
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

employeesRouter.post('/time-entries', async (req, res) => {
  try {
    const { employee_id, job_id, work_date, hours, notes } = req.body;
    const date = parseDate(work_date);
    if (!employee_id || !date || hours === undefined || hours === '') {
      res.status(400).json({ error: 'employee_id, work_date and hours are required' });
      return;
    }
    const h = Number(hours);
    if (!(h > 0 && h <= 24)) {
      res.status(400).json({ error: 'Hours must be between 0 and 24' });
      return;
    }
    const entry = await prisma.timeEntry.create({
      data: { employee_id, job_id: job_id || null, work_date: date, hours: h, notes: notes || null },
    });
    res.status(201).json({ data: entry });
  } catch {
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Approve or reject crew time in bulk. Only approved time is paid.
employeesRouter.post('/time-entries/review', async (req: AuthRequest, res) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids.filter((x: unknown) => typeof x === 'string') : [];
    const action = req.body.action;
    if (!ids.length || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Pass ids and action approve or reject' });
      return;
    }
    // Entries still on the clock can't be reviewed yet.
    const result = await prisma.timeEntry.updateMany({
      where: { id: { in: ids }, NOT: { clock_in: { not: null }, clock_out: null } },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewed_at: new Date(),
        reviewed_by: reviewer(req as AuthRequest),
        review_note: action === 'reject' ? (req.body.note || null) : null,
      },
    });
    res.json({ data: { updated: result.count } });
  } catch {
    res.status(500).json({ error: 'Failed to review time' });
  }
});

employeesRouter.patch('/time-entries/:entryId', async (req, res) => {
  try {
    const data: Prisma.TimeEntryUncheckedUpdateInput = {};
    if ('job_id' in req.body) data.job_id = req.body.job_id || null;
    if ('notes' in req.body) data.notes = req.body.notes || null;
    if (['PENDING', 'APPROVED', 'REJECTED'].includes(req.body.status)) {
      data.status = req.body.status;
      data.reviewed_at = new Date();
    }
    if ('hours' in req.body) {
      const h = Number(req.body.hours);
      if (!(h > 0 && h <= 24)) {
        res.status(400).json({ error: 'Hours must be between 0 and 24' });
        return;
      }
      data.hours = h;
    }
    if ('work_date' in req.body) {
      const d = parseDate(req.body.work_date);
      if (!d) {
        res.status(400).json({ error: 'Invalid work_date' });
        return;
      }
      data.work_date = d;
    }
    // Fix a shift's clock times (Central). Marks it as an office edit.
    if (req.body.start_time || req.body.end_time) {
      const current = await prisma.timeEntry.findUnique({ where: { id: req.params.entryId } });
      if (!current) {
        res.status(404).json({ error: 'Time entry not found' });
        return;
      }
      const day = (data.work_date as Date | undefined ?? current.work_date).toISOString().slice(0, 10);
      const start = centralTime(day, String(req.body.start_time || ''));
      let end = req.body.end_time ? centralTime(day, String(req.body.end_time)) : null;
      if (!start) {
        res.status(400).json({ error: 'Enter a start time' });
        return;
      }
      if (end && end <= start) end = centralTime(addDays(day, 1), String(req.body.end_time));
      const brk = 'break_minutes' in req.body ? Math.max(0, Math.min(240, Math.round(Number(req.body.break_minutes) || 0))) : current.break_minutes;
      const h = end ? workedHours(start, end, brk) : 0;
      if (end && !(h > 0 && h <= 24)) {
        res.status(400).json({ error: 'That shift length does not look right' });
        return;
      }
      Object.assign(data, { clock_in: start, clock_out: end, break_minutes: brk, hours: h, office_edited: true });
    }
    const entry = await prisma.timeEntry.update({ where: { id: req.params.entryId }, data });
    res.json({ data: entry });
  } catch {
    res.status(500).json({ error: 'Failed to update time entry' });
  }
});

employeesRouter.delete('/time-entries/:entryId', async (req, res) => {
  try {
    await prisma.timeEntry.delete({ where: { id: req.params.entryId } });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

// ── Employees ──────────────────────────────────────────────────────────────

employeesRouter.get('/', async (req, res) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    const where: Prisma.EmployeeWhereInput = { deleted_at: null };
    if (status) where.status = status as Prisma.EmployeeWhereInput['status'];
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ];
    }
    const employees = await prisma.employee.findMany({
      where,
      orderBy: [{ status: 'asc' }, { last_name: 'asc' }, { first_name: 'asc' }],
    });
    res.json({ data: employees.map(publicEmployee) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

employeesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const data = pickEmployee(req.body);
    if (!data.first_name || !data.last_name || data.pay_rate === undefined || data.pay_rate === null) {
      res.status(400).json({ error: 'First name, last name and pay rate are required' });
      return;
    }
    const pinErr = await withPin(data, req.body);
    const err = pinErr || accessError(data);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const employee = await prisma.employee.create({ data: data as Prisma.EmployeeCreateInput });
    res.status(201).json({ data: publicEmployee(employee) });
  } catch {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

employeesRouter.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        pay_stubs: {
          orderBy: { pay_run: { pay_date: 'desc' } },
          take: 26,
          include: { pay_run: { select: { id: true, period_start: true, period_end: true, pay_date: true, status: true } } },
        },
      },
    });
    if (!employee || employee.deleted_at) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const ytd = await prisma.payStub.aggregate({
      _sum: { gross_pay: true, net_pay: true, federal_withholding: true, state_withholding: true, social_security: true, medicare: true },
      where: { employee_id: employee.id, pay_run: { pay_date: { gte: yearStart }, status: { not: 'DRAFT' } } },
    });
    const { pay_stubs, ...emp } = employee;
    res.json({ data: { ...publicEmployee(emp as Employee), pay_stubs, ytd: ytd._sum } });
  } catch {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

employeesRouter.patch('/:id', async (req, res) => {
  try {
    const current = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!current) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    const data = pickEmployee(req.body);
    const pinErr = await withPin(data, req.body);
    const err = pinErr || accessError({ ...current, ...data });
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    // Leaving the company ends crew app access.
    if (data.status && data.status !== 'ACTIVE') data.app_access = false;
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
    res.json({ data: publicEmployee(employee) });
  } catch {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

employeesRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { deleted_at: new Date(), status: 'INACTIVE', app_access: false },
    });
    res.json({ data: { success: true } });
  } catch {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { splitHours } from '../lib/payroll';
import {
  centralDateIso, centralTime, dayStart, isIsoDay, addDays, weekStartIso, workedHours,
} from '../lib/time';

// The crew app (/crew in the web app). Employees sign in with their email or
// phone plus a PIN the owner sets, then clock in and out, fix their time card,
// see the jobs they're assigned to, and post progress notes and photos.
// Crew tokens carry { employeeId, kind: 'crew' } and never work on the admin API.
export const crewRouter = Router();

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const OPEN_JOB_STATUSES = ['ESTIMATING', 'ACTIVE', 'INVOICED'] as const;
const MAX_PHOTO_CHARS = 4_000_000;

interface CrewRequest extends Request {
  employee?: { id: string; first_name: string; last_name: string };
}

const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

function crewAuth(req: CrewRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Please sign in' });
    return;
  }
  let payload: { employeeId?: string; kind?: string };
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    return;
  }
  if (payload.kind !== 'crew' || !payload.employeeId) {
    res.status(401).json({ error: 'Please sign in' });
    return;
  }
  prisma.employee
    .findUnique({ where: { id: payload.employeeId }, select: { id: true, first_name: true, last_name: true, app_access: true, status: true, deleted_at: true } })
    .then((emp) => {
      if (!emp || !emp.app_access || emp.status !== 'ACTIVE' || emp.deleted_at) {
        res.status(401).json({ error: 'Your crew app access is turned off. Ask the office.' });
        return;
      }
      req.employee = { id: emp.id, first_name: emp.first_name, last_name: emp.last_name };
      next();
    })
    .catch(() => res.status(500).json({ error: 'Something went wrong' }));
}

// ── Sign in ────────────────────────────────────────────────────────────────

crewRouter.post('/auth/login', async (req, res) => {
  try {
    const login = String(req.body.login || '').trim().toLowerCase();
    const pin = String(req.body.pin || '').trim();
    const fail = () => res.status(401).json({ error: 'That email or phone and PIN did not match' });
    if (!login || !pin) {
      res.status(400).json({ error: 'Enter your email or phone and your PIN' });
      return;
    }
    const candidates = await prisma.employee.findMany({
      where: { app_access: true, status: 'ACTIVE', deleted_at: null, pin_hash: { not: null } },
    });
    const loginDigits = digits(login);
    const emp = candidates.find((e) =>
      (e.email && e.email.toLowerCase() === login) ||
      (loginDigits.length >= 7 && digits(e.phone).slice(-10) === loginDigits.slice(-10)),
    );
    if (!emp) return fail();
    if (emp.pin_locked_until && emp.pin_locked_until > new Date()) {
      res.status(429).json({ error: `Too many tries. Try again in ${LOCK_MINUTES} minutes or ask the office to reset your PIN.` });
      return;
    }
    const ok = await bcrypt.compare(pin, emp.pin_hash!);
    if (!ok) {
      const attempts = emp.failed_pin_attempts + 1;
      await prisma.employee.update({
        where: { id: emp.id },
        data: attempts >= MAX_PIN_ATTEMPTS
          ? { failed_pin_attempts: 0, pin_locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failed_pin_attempts: attempts },
      });
      return fail();
    }
    await prisma.employee.update({
      where: { id: emp.id },
      data: { failed_pin_attempts: 0, pin_locked_until: null, last_app_login_at: new Date() },
    });
    const token = jwt.sign({ employeeId: emp.id, kind: 'crew' }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    res.json({ data: { token, employee: { id: emp.id, first_name: emp.first_name, last_name: emp.last_name } } });
  } catch {
    res.status(500).json({ error: 'Sign in failed' });
  }
});

crewRouter.use(crewAuth);

// ── Helpers ────────────────────────────────────────────────────────────────

const entrySelect = {
  id: true, job_id: true, work_date: true, hours: true, clock_in: true, clock_out: true,
  break_minutes: true, status: true, source: true, review_note: true, notes: true,
  job: { select: { id: true, name: true } },
} satisfies Prisma.TimeEntrySelect;

async function openEntry(employeeId: string) {
  return prisma.timeEntry.findFirst({
    where: { employee_id: employeeId, clock_in: { not: null }, clock_out: null },
    select: entrySelect,
    orderBy: { clock_in: 'desc' },
  });
}

async function assertAssigned(employeeId: string, jobId: string | null | undefined): Promise<string | null> {
  if (!jobId) return null;
  const a = await prisma.jobAssignment.findUnique({
    where: { job_id_employee_id: { job_id: jobId, employee_id: employeeId } },
    include: { job: { select: { deleted_at: true } } },
  });
  if (!a || a.job.deleted_at) throw Object.assign(new Error('You are not assigned to that job'), { status: 400 });
  return jobId;
}

function sendError(res: Response, err: unknown, fallback: string) {
  const e = err as { status?: number; message?: string };
  if (e?.status) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  console.error('[crew]', err);
  res.status(500).json({ error: fallback });
}

async function closeEntry(id: string, clockIn: Date, breakMinutes: number, notes?: string) {
  const now = new Date();
  return prisma.timeEntry.update({
    where: { id },
    data: {
      clock_out: now,
      break_minutes: breakMinutes,
      hours: workedHours(clockIn, now, breakMinutes),
      ...(notes ? { notes } : {}),
    },
    select: entrySelect,
  });
}

function parseBreak(v: unknown): number {
  const n = Math.round(Number(v || 0));
  return Number.isFinite(n) && n >= 0 && n <= 240 ? n : 0;
}

// ── Me / clock ─────────────────────────────────────────────────────────────

crewRouter.get('/me', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const today = centralDateIso();
    const weekStart = weekStartIso(today);
    const [open, week] = await Promise.all([
      openEntry(me.id),
      prisma.timeEntry.findMany({
        where: { employee_id: me.id, work_date: { gte: dayStart(weekStart), lte: dayStart(today) }, status: { not: 'REJECTED' } },
        select: { work_date: true, hours: true },
      }),
    ]);
    const todayHours = week.filter((e) => e.work_date.toISOString().slice(0, 10) === today).reduce((t, e) => t + Number(e.hours), 0);
    const weekHours = week.reduce((t, e) => t + Number(e.hours), 0);
    res.json({ data: { employee: me, open_entry: open, today, today_hours: todayHours, week_hours: weekHours } });
  } catch (err) {
    sendError(res, err, 'Failed to load');
  }
});

crewRouter.post('/clock-in', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    if (await openEntry(me.id)) {
      res.status(409).json({ error: 'You are already clocked in' });
      return;
    }
    const job_id = await assertAssigned(me.id, req.body.job_id);
    const now = new Date();
    const entry = await prisma.timeEntry.create({
      data: {
        employee_id: me.id, job_id, work_date: dayStart(centralDateIso(now)), hours: 0,
        clock_in: now, status: 'PENDING', source: 'CREW', notes: req.body.notes || null,
      },
      select: entrySelect,
    });
    res.status(201).json({ data: entry });
  } catch (err) {
    sendError(res, err, 'Failed to clock in');
  }
});

crewRouter.post('/clock-out', async (req: CrewRequest, res) => {
  try {
    const open = await openEntry(req.employee!.id);
    if (!open || !open.clock_in) {
      res.status(409).json({ error: 'You are not clocked in' });
      return;
    }
    const entry = await closeEntry(open.id, open.clock_in, parseBreak(req.body.break_minutes), req.body.notes);
    res.json({ data: entry });
  } catch (err) {
    sendError(res, err, 'Failed to clock out');
  }
});

// Clock out of the current job and straight into another one.
crewRouter.post('/switch-job', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const open = await openEntry(me.id);
    if (!open || !open.clock_in) {
      res.status(409).json({ error: 'You are not clocked in' });
      return;
    }
    const job_id = await assertAssigned(me.id, req.body.job_id);
    if (job_id === open.job_id) {
      res.status(400).json({ error: 'You are already on that job' });
      return;
    }
    await closeEntry(open.id, open.clock_in, parseBreak(req.body.break_minutes));
    const now = new Date();
    const entry = await prisma.timeEntry.create({
      data: {
        employee_id: me.id, job_id, work_date: dayStart(centralDateIso(now)), hours: 0,
        clock_in: now, status: 'PENDING', source: 'CREW',
      },
      select: entrySelect,
    });
    res.status(201).json({ data: entry });
  } catch (err) {
    sendError(res, err, 'Failed to switch jobs');
  }
});

// ── Time card ──────────────────────────────────────────────────────────────

crewRouter.get('/timecard', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const anchor = isIsoDay(req.query.week) ? (req.query.week as string) : centralDateIso();
    const start = weekStartIso(anchor);
    const end = addDays(start, 6);
    const entries = await prisma.timeEntry.findMany({
      where: { employee_id: me.id, work_date: { gte: dayStart(start), lte: dayStart(end) } },
      select: entrySelect,
      orderBy: [{ work_date: 'asc' }, { clock_in: 'asc' }, { created_at: 'asc' }],
    });
    const counted = entries.filter((e) => e.status !== 'REJECTED');
    const { regular, overtime } = splitHours(counted, true);
    res.json({
      data: {
        week_start: start, week_end: end, today: centralDateIso(), entries,
        total_hours: regular + overtime, regular_hours: regular, overtime_hours: overtime,
        pending: entries.filter((e) => e.status === 'PENDING' && !(e.clock_in && !e.clock_out)).length,
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to load time card');
  }
});

// Manual entry for a shift the employee forgot to clock (needs approval).
async function shiftFromBody(employeeId: string, b: Record<string, unknown>) {
  const work_date = b.work_date as string;
  if (!isIsoDay(work_date)) throw Object.assign(new Error('Pick a date'), { status: 400 });
  if (work_date > centralDateIso()) throw Object.assign(new Error('You cannot log time for a future day'), { status: 400 });
  const clock_in = centralTime(work_date, String(b.start_time || ''));
  let clock_out = centralTime(work_date, String(b.end_time || ''));
  if (!clock_in || !clock_out) throw Object.assign(new Error('Enter a start and end time'), { status: 400 });
  // An end time before the start means the shift ran past midnight.
  if (clock_out <= clock_in) clock_out = centralTime(addDays(work_date, 1), String(b.end_time))!;
  const break_minutes = parseBreak(b.break_minutes);
  const hours = workedHours(clock_in, clock_out, break_minutes);
  if (!(hours > 0) || hours > 24) throw Object.assign(new Error('That shift length does not look right'), { status: 400 });
  const job_id = await assertAssigned(employeeId, b.job_id as string | undefined);
  return { work_date: dayStart(work_date), clock_in, clock_out, break_minutes, hours, job_id, notes: (b.notes as string) || null };
}

crewRouter.post('/time-entries', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const shift = await shiftFromBody(me.id, req.body);
    const entry = await prisma.timeEntry.create({
      data: { employee_id: me.id, ...shift, status: 'PENDING', source: 'CREW_MANUAL' },
      select: entrySelect,
    });
    res.status(201).json({ data: entry });
  } catch (err) {
    sendError(res, err, 'Failed to add time');
  }
});

async function ownEditable(employeeId: string, id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.employee_id !== employeeId) throw Object.assign(new Error('Time entry not found'), { status: 404 });
  if (entry.status === 'APPROVED') throw Object.assign(new Error('This time is already approved. Ask the office to change it.'), { status: 409 });
  if (entry.clock_in && !entry.clock_out) throw Object.assign(new Error('Clock out first'), { status: 409 });
  return entry;
}

crewRouter.patch('/time-entries/:id', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    await ownEditable(me.id, req.params.id);
    const shift = await shiftFromBody(me.id, req.body);
    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: { ...shift, source: 'CREW_MANUAL', status: 'PENDING', reviewed_at: null, reviewed_by: null, review_note: null },
      select: entrySelect,
    });
    res.json({ data: entry });
  } catch (err) {
    sendError(res, err, 'Failed to update time');
  }
});

crewRouter.delete('/time-entries/:id', async (req: CrewRequest, res) => {
  try {
    await ownEditable(req.employee!.id, req.params.id);
    await prisma.timeEntry.delete({ where: { id: req.params.id } });
    res.json({ data: { success: true } });
  } catch (err) {
    sendError(res, err, 'Failed to delete time');
  }
});

// ── Jobs ───────────────────────────────────────────────────────────────────

const crewJobSelect = {
  id: true, name: true, address: true, municipality: true, status: true,
  start_date: true, end_date: true, crew_notes: true,
  customer: { select: { name: true } },
} satisfies Prisma.JobSelect;

crewRouter.get('/jobs', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const includeDone = req.query.all === '1';
    const assignments = await prisma.jobAssignment.findMany({
      where: {
        employee_id: me.id,
        job: { deleted_at: null, ...(includeDone ? {} : { status: { in: [...OPEN_JOB_STATUSES] } }) },
      },
      include: { job: { select: crewJobSelect } },
    });
    const hours = await prisma.timeEntry.groupBy({
      by: ['job_id'],
      where: { employee_id: me.id, job_id: { in: assignments.map((a) => a.job_id) }, status: { not: 'REJECTED' } },
      _sum: { hours: true },
    });
    const byJob = new Map(hours.map((h) => [h.job_id, Number(h._sum.hours || 0)]));
    const jobs = assignments
      .map((a) => ({ ...a.job, my_hours: byJob.get(a.job_id) || 0 }))
      .sort((a, b) => (a.start_date?.getTime() ?? Infinity) - (b.start_date?.getTime() ?? Infinity));
    res.json({ data: jobs });
  } catch (err) {
    sendError(res, err, 'Failed to load jobs');
  }
});

crewRouter.get('/jobs/:id', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    await assertAssigned(me.id, req.params.id).catch(() => {
      throw Object.assign(new Error('Job not found'), { status: 404 });
    });
    const [job, crew, updates, mine] = await Promise.all([
      prisma.job.findUnique({ where: { id: req.params.id }, select: crewJobSelect }),
      prisma.jobAssignment.findMany({
        where: { job_id: req.params.id },
        include: { employee: { select: { id: true, first_name: true, last_name: true, position: true } } },
      }),
      prisma.jobCrewUpdate.findMany({
        where: { job_id: req.params.id },
        orderBy: { created_at: 'desc' },
        take: 30,
        include: { employee: { select: { id: true, first_name: true, last_name: true } } },
      }),
      prisma.timeEntry.aggregate({
        where: { employee_id: me.id, job_id: req.params.id, status: { not: 'REJECTED' } },
        _sum: { hours: true },
      }),
    ]);
    res.json({
      data: {
        ...job,
        crew: crew.map((c) => c.employee),
        updates,
        my_hours: Number(mine._sum.hours || 0),
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to load job');
  }
});

crewRouter.post('/jobs/:id/updates', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    await assertAssigned(me.id, req.params.id);
    const body = String(req.body.body || '').trim();
    const photo = req.body.photo;
    if (!body && !photo) {
      res.status(400).json({ error: 'Write a note or add a photo' });
      return;
    }
    if (photo && (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > MAX_PHOTO_CHARS)) {
      res.status(400).json({ error: 'Photo must be an image under about 3 MB' });
      return;
    }
    const update = await prisma.jobCrewUpdate.create({
      data: { job_id: req.params.id, employee_id: me.id, body: body.slice(0, 4000), photo: photo || null },
      include: { employee: { select: { id: true, first_name: true, last_name: true } } },
    });
    res.status(201).json({ data: update });
  } catch (err) {
    sendError(res, err, 'Failed to post update');
  }
});

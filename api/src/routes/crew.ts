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
    const fail = () => res.status(401).json({ error: 'That email or phone and PIN did not match', code: 'bad_login' });
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
      res.status(429).json({ error: `Too many tries. Try again in ${LOCK_MINUTES} minutes or ask the office to reset your PIN.`, code: 'pin_locked' });
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
  if (!a || a.job.deleted_at) fail(400, 'not_assigned', 'You are not assigned to that job');
  return jobId;
}

// Errors carry a code the phone translates (English / Spanish); the message
// is the English fallback.
export function fail(status: number, code: string, message: string, detail?: unknown): never {
  throw Object.assign(new Error(message), { status, code, detail });
}

function sendError(res: Response, err: unknown, fallback: string) {
  const e = err as { status?: number; message?: string; code?: string; detail?: unknown };
  if (e?.status) {
    res.status(e.status).json({ error: e.message, code: e.code, detail: e.detail });
    return;
  }
  console.error('[crew]', err);
  res.status(500).json({ error: fallback, code: 'generic' });
}

function parseBreak(v: unknown): number {
  const n = Math.round(Number(v || 0));
  return Number.isFinite(n) && n >= 0 && n <= 240 ? n : 0;
}

// Where the phone was, if the crew member let the browser share it.
function parseFix(b: Record<string, unknown>) {
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const acc = Math.round(Number(b.accuracy_m));
  return { lat, lng, acc: Number.isFinite(acc) && acc >= 0 ? Math.min(acc, 100_000) : null };
}

// A punch made with no signal waits in the phone's queue and arrives later
// carrying the time it really happened. Trust that time only within reason.
const MAX_QUEUE_AGE_MS = 48 * 3_600_000;
function punchTime(b: Record<string, unknown>): { at: Date; late: boolean } {
  const now = new Date();
  if (b.queued && typeof b.occurred_at === 'string') {
    const at = new Date(b.occurred_at);
    if (!isNaN(at.getTime()) && at.getTime() <= now.getTime() + 120_000 && now.getTime() - at.getTime() <= MAX_QUEUE_AGE_MS) {
      return { at: at > now ? now : at, late: now.getTime() - at.getTime() > 60_000 };
    }
  }
  return { at: now, late: false };
}

async function clockIn(employeeId: string, b: Record<string, unknown>) {
  if (await openEntry(employeeId)) fail(409, 'already_clocked_in', 'You are already clocked in');
  const job_id = await assertAssigned(employeeId, b.job_id as string | undefined);
  const { at, late } = punchTime(b);
  const fix = parseFix(b);
  return prisma.timeEntry.create({
    data: {
      employee_id: employeeId, job_id, work_date: dayStart(centralDateIso(at)), hours: 0,
      clock_in: at, status: 'PENDING', source: 'CREW', notes: (b.notes as string) || null,
      in_lat: fix?.lat, in_lng: fix?.lng, in_accuracy_m: fix?.acc, synced_late: late,
    },
    select: entrySelect,
  });
}

async function clockOut(employeeId: string, b: Record<string, unknown>) {
  const open = await openEntry(employeeId);
  if (!open || !open.clock_in) fail(409, 'no_open_punch', 'You are not clocked in');
  const { at: when, late } = punchTime(b);
  const at = when < open.clock_in ? open.clock_in : when;
  const brk = parseBreak(b.break_minutes);
  const fix = parseFix(b);
  return prisma.timeEntry.update({
    where: { id: open.id },
    data: {
      clock_out: at, break_minutes: brk, hours: workedHours(open.clock_in, at, brk),
      out_lat: fix?.lat, out_lng: fix?.lng, out_accuracy_m: fix?.acc,
      ...(late ? { synced_late: true } : {}),
      ...(b.notes ? { notes: [open.notes, b.notes].filter(Boolean).join(' · ') } : {}),
    },
    select: entrySelect,
  });
}

// ── Me / clock ─────────────────────────────────────────────────────────────

crewRouter.get('/me', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const today = centralDateIso();
    const weekStart = weekStartIso(today);
    const emp = await prisma.employee.findUnique({ where: { id: me.id }, select: { news_read_at: true, created_at: true } });
    const [open, week, unread, pendingOff] = await Promise.all([
      openEntry(me.id),
      prisma.timeEntry.findMany({
        where: { employee_id: me.id, work_date: { gte: dayStart(weekStart), lte: dayStart(today) }, status: { not: 'REJECTED' } },
        select: { work_date: true, hours: true },
      }),
      prisma.announcement.count({ where: { published_at: { gt: emp?.news_read_at ?? emp?.created_at ?? new Date(0) } } }),
      prisma.timeOffRequest.count({ where: { employee_id: me.id, kind: 'REQUEST', status: 'PENDING' } }),
    ]);
    const todayHours = week.filter((e) => e.work_date.toISOString().slice(0, 10) === today).reduce((t, e) => t + Number(e.hours), 0);
    const weekHours = week.reduce((t, e) => t + Number(e.hours), 0);
    res.json({
      data: {
        employee: me, open_entry: open, today, today_hours: todayHours, week_hours: weekHours,
        badges: { news: unread, off: pendingOff },
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to load');
  }
});

crewRouter.post('/clock-in', async (req: CrewRequest, res) => {
  try {
    res.status(201).json({ data: await clockIn(req.employee!.id, req.body) });
  } catch (err) {
    sendError(res, err, 'Failed to clock in');
  }
});

crewRouter.post('/clock-out', async (req: CrewRequest, res) => {
  try {
    res.json({ data: await clockOut(req.employee!.id, req.body) });
  } catch (err) {
    sendError(res, err, 'Failed to clock out');
  }
});

// Clock out of the current job and straight into another one.
crewRouter.post('/switch-job', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const open = await openEntry(me.id);
    if (!open) fail(409, 'no_open_punch', 'You are not clocked in');
    const job_id = await assertAssigned(me.id, req.body.job_id);
    if (job_id === open.job_id) fail(400, 'same_job', 'You are already on that job');
    await clockOut(me.id, req.body);
    res.status(201).json({ data: await clockIn(me.id, { ...req.body, break_minutes: 0 }) });
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
  if (!isIsoDay(work_date)) fail(400, 'pick_date', 'Pick a date');
  if (work_date > centralDateIso()) fail(400, 'future_day', 'You cannot log time for a future day');
  const clock_in = centralTime(work_date, String(b.start_time || ''));
  let clock_out = centralTime(work_date, String(b.end_time || ''));
  if (!clock_in || !clock_out) fail(400, 'need_times', 'Enter a start and end time');
  // An end time before the start means the shift ran past midnight.
  if (clock_out <= clock_in) clock_out = centralTime(addDays(work_date, 1), String(b.end_time))!;
  const break_minutes = parseBreak(b.break_minutes);
  const hours = workedHours(clock_in, clock_out, break_minutes);
  if (!(hours > 0) || hours > 24) fail(400, 'bad_length', 'That shift length does not look right');
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
  if (!entry || entry.employee_id !== employeeId) fail(404, 'not_found', 'Time entry not found');
  if (entry.status === 'APPROVED') fail(409, 'already_approved', 'This time is already approved. Ask the office to change it.');
  if (entry.clock_in && !entry.clock_out) fail(409, 'clock_out_first', 'Clock out first');
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
      fail(404, 'not_found', 'Job not found');
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

// ── Time off ───────────────────────────────────────────────────────────────
// "Can't make it today" is a call-off: the office is told straight away and
// nobody approves it. Anything from tomorrow on is a request the owner decides.

export const CALL_OFF_REASONS = ['sick', 'family_emergency', 'child_care', 'no_transportation',
  'medical_appointment', 'weather', 'legal', 'personal', 'other'];
export const REQUEST_REASONS = ['vacation', 'medical_appointment', 'family_event', 'child_care',
  'legal', 'sick', 'personal', 'other'];
const MAX_SPAN_DAYS = 30;
const MAX_AHEAD_DAYS = 365;

const dayCount = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function offRow(r: { id: string; kind: string; reason: string; starts_on: Date; ends_on: Date; note: string | null; status: string; decision_note: string | null; created_at: Date }) {
  return {
    id: r.id, kind: r.kind, reason: r.reason, starts_on: iso(r.starts_on), ends_on: iso(r.ends_on),
    days: dayCount(r.starts_on, r.ends_on), note: r.note, status: r.status, decision_note: r.decision_note,
    created_at: r.created_at,
  };
}

crewRouter.get('/time-off', async (req: CrewRequest, res) => {
  try {
    const today = centralDateIso();
    const rows = await prisma.timeOffRequest.findMany({
      where: { employee_id: req.employee!.id, ends_on: { gte: dayStart(addDays(today, -60)) } },
      orderBy: { starts_on: 'desc' },
    });
    res.json({ data: { today, requests: rows.map(offRow) } });
  } catch (err) {
    sendError(res, err, 'Failed to load time off');
  }
});

crewRouter.post('/time-off', async (req: CrewRequest, res) => {
  try {
    const me = req.employee!;
    const today = centralDateIso();
    const kind = req.body.kind === 'call_off' ? 'CALL_OFF' : req.body.kind === 'request' ? 'REQUEST' : fail(400, 'generic', 'Unknown kind');
    let startsOn: string;
    let endsOn: string;
    if (kind === 'CALL_OFF') {
      if (await openEntry(me.id)) fail(409, 'still_clocked_in', 'You are clocked in. Clock out first, then call off if you cannot finish.');
      startsOn = endsOn = today;
    } else {
      startsOn = String(req.body.starts_on || '');
      endsOn = String(req.body.ends_on || startsOn);
      if (!isIsoDay(startsOn) || !isIsoDay(endsOn)) fail(400, 'missing_field', 'Pick the days');
      if (startsOn <= today) fail(400, 'request_must_be_future', 'Requests start tomorrow at the earliest. For today, call off instead.');
      if (endsOn < startsOn) fail(400, 'end_before_start', 'The last day cannot be before the first day.');
      if (dayCount(dayStart(startsOn), dayStart(endsOn)) > MAX_SPAN_DAYS) fail(400, 'span_too_long', 'That is too many days. Check the dates.');
      if (startsOn > addDays(today, MAX_AHEAD_DAYS)) fail(400, 'too_far_ahead', 'That date is too far away.');
    }
    const reasons = kind === 'CALL_OFF' ? CALL_OFF_REASONS : REQUEST_REASONS;
    const reason = reasons.includes(req.body.reason) ? req.body.reason : 'other';
    const clash = await prisma.timeOffRequest.findFirst({
      where: {
        employee_id: me.id, status: { in: ['PENDING', 'APPROVED'] },
        starts_on: { lte: dayStart(endsOn) }, ends_on: { gte: dayStart(startsOn) },
      },
    });
    if (clash) {
      fail(409, 'overlaps_existing', 'You already have time off on those days.', { starts_on: iso(clash.starts_on), ends_on: iso(clash.ends_on) });
    }
    const row = await prisma.timeOffRequest.create({
      data: {
        employee_id: me.id, kind, reason, starts_on: dayStart(startsOn), ends_on: dayStart(endsOn),
        note: req.body.note ? String(req.body.note).slice(0, 1000) : null,
        // A call-off is reported, not approved; it counts as decided.
        status: kind === 'CALL_OFF' ? 'APPROVED' : 'PENDING',
      },
    });
    res.status(201).json({ data: offRow(row) });
  } catch (err) {
    sendError(res, err, 'Failed to send');
  }
});

crewRouter.post('/time-off/:id/cancel', async (req: CrewRequest, res) => {
  try {
    const row = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id } });
    if (!row || row.employee_id !== req.employee!.id) fail(404, 'not_found', 'Not found');
    if (row.status === 'DENIED' || row.status === 'CANCELLED') fail(409, 'already_decided', 'That has already been decided.');
    if (iso(row.ends_on) < centralDateIso()) fail(409, 'already_past', 'Those days have already passed.');
    const updated = await prisma.timeOffRequest.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
    res.json({ data: offRow(updated) });
  } catch (err) {
    sendError(res, err, 'Failed to withdraw');
  }
});

// ── Announcements ──────────────────────────────────────────────────────────

crewRouter.get('/announcements', async (req: CrewRequest, res) => {
  try {
    const emp = await prisma.employee.findUnique({ where: { id: req.employee!.id }, select: { news_read_at: true, created_at: true } });
    const since = emp?.news_read_at ?? emp?.created_at ?? new Date(0);
    const items = await prisma.announcement.findMany({ orderBy: { published_at: 'desc' }, take: 30 });
    res.json({
      data: {
        items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, published_at: n.published_at, unread: n.published_at > since })),
        unread: items.filter((n) => n.published_at > since).length,
      },
    });
  } catch (err) {
    sendError(res, err, 'Failed to load announcements');
  }
});

// Opening the tab is the read receipt.
crewRouter.post('/announcements/read', async (req: CrewRequest, res) => {
  try {
    await prisma.employee.update({ where: { id: req.employee!.id }, data: { news_read_at: new Date() } });
    res.json({ data: { success: true } });
  } catch (err) {
    sendError(res, err, 'Failed');
  }
});

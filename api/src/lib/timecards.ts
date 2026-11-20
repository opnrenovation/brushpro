import { PayFrequency, TimeEntry } from '@prisma/client';
import { prisma } from './prisma';
import { splitHours } from './payroll';
import { addDays, centralDateIso, dayStart, weekStartIso } from './time';

// The owner's Time Cards screen, ported from the Infinite Resources portal's
// Time Capture: pay periods that generate themselves, one row per person with
// day columns and regular/overtime, review flags, and approve / un-approve.
//
// BrushPro approves time entry by entry (crew app shifts start PENDING), so
// approving a timecard approves every closed, pending shift in the period.

export interface Period {
  start: string;
  end: string;
  current: boolean;
}

interface PeriodConfig {
  frequency: PayFrequency;
  anchor: string; // a known period start for WEEKLY / BIWEEKLY
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

// Periods follow the most recent pay run, so time cards line up with payroll.
// With no pay runs yet, a period is the Sunday–Saturday workweek.
export async function periodConfig(): Promise<PeriodConfig> {
  const last = await prisma.payRun.findFirst({ orderBy: { period_end: 'desc' } });
  if (last) return { frequency: last.frequency, anchor: last.period_start.toISOString().slice(0, 10) };
  return { frequency: 'WEEKLY', anchor: weekStartIso(centralDateIso()) };
}

export function periodContaining(iso: string, cfg: PeriodConfig): { start: string; end: string } {
  const [y, m, d] = iso.split('-').map(Number);
  if (cfg.frequency === 'MONTHLY') {
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m - 1))}` };
  }
  if (cfg.frequency === 'SEMIMONTHLY') {
    return d <= 15
      ? { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-15` }
      : { start: `${y}-${pad(m)}-16`, end: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m - 1))}` };
  }
  const len = cfg.frequency === 'BIWEEKLY' ? 14 : 7;
  const diff = Math.round((dayStart(iso).getTime() - dayStart(cfg.anchor).getTime()) / 86_400_000);
  const k = Math.floor(diff / len);
  const start = addDays(cfg.anchor, k * len);
  return { start, end: addDays(start, len - 1) };
}

// The current period first, then earlier ones.
export async function listPeriods(count = 26): Promise<{ frequency: PayFrequency; periods: Period[] }> {
  const cfg = await periodConfig();
  const today = centralDateIso();
  const periods: Period[] = [];
  let p = periodContaining(today, cfg);
  for (let i = 0; i < count; i++) {
    periods.push({ ...p, current: i === 0 });
    p = periodContaining(addDays(p.start, -1), cfg);
  }
  return { frequency: cfg.frequency, periods };
}

// ── Building a period's time cards ──────────────────────────────────────────

const STALE_OPEN_MS = 24 * 3_600_000;
const LONG_SHIFT_HOURS = 12;

export interface Interval {
  id: string;
  start: string | null;
  end: string | null;
  hours: number;
  break_minutes: number;
  source: 'CREW' | 'CREW_MANUAL' | 'OWNER';
  office_edited: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_note: string | null;
  notes: string | null;
  job: { id: string; name: string } | null;
  live: boolean;
}

export interface TimecardRow {
  employee_id: string;
  employee_name: string;
  position: string | null;
  worker_type: string;
  days: Array<{ date: string; hours: number; intervals: Interval[] }>;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  pending: number;
  rejected: number;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  locked_by_payroll: boolean;
  hand_keyed: boolean;
  on_clock: boolean;
  anomalies: string[];
}

const dayName = (d: Date) =>
  d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

const r2 = (n: number) => Math.round(n * 100) / 100;

type EntryWithJob = TimeEntry & { job: { id: string; name: string } | null };

function toInterval(e: EntryWithJob): Interval {
  const live = !!e.clock_in && !e.clock_out;
  return {
    id: e.id,
    start: e.clock_in?.toISOString() ?? null,
    end: e.clock_out?.toISOString() ?? null,
    hours: Number(e.hours),
    break_minutes: e.break_minutes,
    source: e.source,
    office_edited: e.office_edited,
    status: e.status,
    review_note: e.review_note,
    notes: e.notes,
    job: e.job,
    live,
  };
}

// Shifts nobody closed, shifts long enough to be a missed clock-out, and
// overlapping shifts are review items, never guessed at.
function anomaliesFor(entries: EntryWithJob[], now: Date): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.clock_in && !e.clock_out && now.getTime() - e.clock_in.getTime() > STALE_OPEN_MS) {
      out.push(`Clocked in ${dayName(e.clock_in)} and never clocked out.`);
    }
    if (e.clock_out && Number(e.hours) > LONG_SHIFT_HOURS) {
      out.push(`${Number(e.hours).toFixed(2)} hour shift on ${dayName(e.clock_in!).split(',').slice(0, 2).join(',')}. Check for a missed clock-out.`);
    }
  }
  const timed = entries
    .filter((e) => e.clock_in && e.clock_out && e.status !== 'REJECTED')
    .sort((a, b) => a.clock_in!.getTime() - b.clock_in!.getTime());
  for (let i = 1; i < timed.length; i++) {
    if (timed[i].clock_in! < timed[i - 1].clock_out!) {
      out.push(`Shifts overlap on ${dayName(timed[i].clock_in!).split(',').slice(0, 2).join(',')}.`);
    }
  }
  return out;
}

export async function buildTimecards(start: string, end: string) {
  const from = dayStart(start);
  const to = dayStart(end);
  const now = new Date();

  const [employees, entries, lockedStubs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        deleted_at: null,
        OR: [{ status: 'ACTIVE' }, { time_entries: { some: { work_date: { gte: from, lte: to } } } }],
      },
      select: { id: true, first_name: true, last_name: true, position: true, worker_type: true },
      orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
    }),
    prisma.timeEntry.findMany({
      where: { work_date: { gte: from, lte: to } },
      include: { job: { select: { id: true, name: true } } },
      orderBy: [{ work_date: 'asc' }, { clock_in: 'asc' }, { created_at: 'asc' }],
    }),
    // Approved time already in a finalized or paid pay run can't be un-approved.
    prisma.payStub.findMany({
      where: {
        pay_run: { status: { in: ['FINALIZED', 'PAID'] }, period_start: { lte: to }, period_end: { gte: from } },
      },
      select: { employee_id: true },
    }),
  ]);
  const locked = new Set(lockedStubs.map((s) => s.employee_id));

  const byEmployee = new Map<string, EntryWithJob[]>();
  for (const e of entries) {
    const list = byEmployee.get(e.employee_id) || [];
    list.push(e);
    byEmployee.set(e.employee_id, list);
  }

  const rows: TimecardRow[] = employees.map((emp) => {
    const own = byEmployee.get(emp.id) || [];
    const counted = own.filter((e) => e.status !== 'REJECTED' && !(e.clock_in && !e.clock_out));
    const { regular, overtime } = splitHours(counted, true);

    const dayMap = new Map<string, { date: string; hours: number; intervals: Interval[] }>();
    for (const e of own) {
      const key = e.work_date.toISOString().slice(0, 10);
      const day = dayMap.get(key) || { date: key, hours: 0, intervals: [] };
      day.intervals.push(toInterval(e));
      if (e.status !== 'REJECTED' && !(e.clock_in && !e.clock_out)) day.hours = r2(day.hours + Number(e.hours));
      dayMap.set(key, day);
    }

    const approvedEntries = counted.filter((e) => e.status === 'APPROVED');
    const lastReview = approvedEntries
      .filter((e) => e.reviewed_at)
      .sort((a, b) => b.reviewed_at!.getTime() - a.reviewed_at!.getTime())[0];
    const pending = counted.filter((e) => e.status === 'PENDING').length;

    return {
      employee_id: emp.id,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      position: emp.position,
      worker_type: emp.worker_type,
      days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      total_hours: r2(regular + overtime),
      regular_hours: regular,
      overtime_hours: overtime,
      pending,
      rejected: own.filter((e) => e.status === 'REJECTED').length,
      approved: counted.length > 0 && pending === 0,
      approved_at: lastReview?.reviewed_at?.toISOString() ?? null,
      approved_by: lastReview?.reviewed_by ?? null,
      locked_by_payroll: locked.has(emp.id),
      hand_keyed: own.some((e) => e.status !== 'REJECTED' && (e.source !== 'CREW' || e.office_edited)),
      on_clock: own.some((e) => e.clock_in && !e.clock_out),
      anomalies: anomaliesFor(own, now),
    };
  });

  const worked = rows.filter((r) => r.total_hours > 0);
  const warnings: string[] = [];
  const pendingPeople = worked.filter((r) => r.pending > 0).length;
  if (pendingPeople) warnings.push(`${pendingPeople} ${pendingPeople === 1 ? 'time card is' : 'time cards are'} waiting for approval. Only approved time is paid.`);
  const keyed = worked.filter((r) => r.hand_keyed).length;
  if (keyed) warnings.push(`${keyed} ${keyed === 1 ? 'row contains' : 'rows contain'} time entered or changed by hand, with no clock-in behind it.`);
  const anom = rows.filter((r) => r.anomalies.length).length;
  if (anom) warnings.push(`${anom} ${anom === 1 ? 'row has' : 'rows have'} a shift to check (open, overlapping, or over ${LONG_SHIFT_HOURS} hours).`);

  return {
    period_start: start,
    period_end: end,
    rows,
    totals: {
      total_hours: r2(worked.reduce((t, r) => t + r.total_hours, 0)),
      regular_hours: r2(worked.reduce((t, r) => t + r.regular_hours, 0)),
      overtime_hours: r2(worked.reduce((t, r) => t + r.overtime_hours, 0)),
    },
    warnings,
  };
}

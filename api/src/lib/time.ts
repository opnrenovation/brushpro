// Central-time helpers for time cards. Work dates are stored as UTC midnight
// of the Central calendar date, matching how the admin app stores dates.

export const BUSINESS_TZ = 'America/Chicago';

const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// YYYY-MM-DD of an instant, in Central time.
export function centralDateIso(d: Date = new Date()): string {
  return dateFmt.format(d);
}

// UTC-midnight Date for a YYYY-MM-DD string (the stored work_date form).
export function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isIsoDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dayStart(s).getTime());
}

export function addDays(iso: string, n: number): string {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Sunday that starts the workweek containing a YYYY-MM-DD date.
export function weekStartIso(iso: string): string {
  const d = dayStart(iso);
  return addDays(iso, -d.getUTCDay());
}

// Offset (ms) of Central time from UTC at an instant; negative in the US.
function tzOffset(at: Date): number {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// Instant for a Central wall-clock time, e.g. ('2026-11-20', '07:30').
export function centralTime(iso: string, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!isIsoDay(iso) || !m || +m[1] > 23 || +m[2] > 59) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, +m[1], +m[2]);
  let t = guess - tzOffset(new Date(guess));
  t = guess - tzOffset(new Date(t)); // settle across DST changes
  return new Date(t);
}

// Worked hours between two instants less a break, rounded to 0.01.
export function workedHours(start: Date, end: Date, breakMinutes = 0): number {
  const h = (end.getTime() - start.getTime()) / 3_600_000 - breakMinutes / 60;
  return Math.max(0, Math.round(h * 100) / 100);
}

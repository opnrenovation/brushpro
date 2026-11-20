// Formatting for the crew app. Times show in Central, the business time zone.
const TZ = 'America/Chicago';

export const clockTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '';

// work_date values are UTC midnight of the calendar day
export const dayLabel = (v: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(v.length === 10 ? `${v}T00:00:00Z` : v).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

export const hrs = (v: unknown) => {
  const n = Number(v ?? 0);
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m === 60 ? `${h + 1}h` : m ? `${h}h ${m}m` : `${h}h`;
};

export function elapsed(from: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// HH:MM in Central for an instant, for prefilling time inputs
export const hhmm = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }) : '';

export const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: 'rgba(255,149,0,0.14)', fg: '#b35f00', label: 'Waiting for approval' },
  APPROVED: { bg: 'rgba(52,199,89,0.14)', fg: '#1f8a3b', label: 'Approved' },
  REJECTED: { bg: 'rgba(255,59,48,0.12)', fg: '#d70015', label: 'Not approved' },
};

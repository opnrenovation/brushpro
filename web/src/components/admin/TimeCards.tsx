'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, jobsApi } from '@/lib/api';
import { errMsg, todayIso } from './ui';

// The owner's Time Cards screen, ported from the Infinite Resources portal's
// Time Capture. Built so what needs attention shows without adding anything up:
// overtime in its own colour, hand-keyed time and problem shifts flagged on the
// row, and totals at the top before the detail underneath.

const TZ = 'America/Chicago';
const fmt = (n: number) => n.toFixed(2);

interface Interval {
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
  in_loc: { lat: number; lng: number; acc: number | null } | null;
  out_loc: { lat: number; lng: number; acc: number | null } | null;
  synced_late: boolean;
}
interface Day { date: string; hours: number; intervals: Interval[] }
interface Row {
  employee_id: string;
  employee_name: string;
  position: string | null;
  worker_type: string;
  days: Day[];
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
  time_off: Array<{ date: string; kind: 'CALL_OFF' | 'REQUEST'; reason: string }>;
}
interface Report {
  period_start: string;
  period_end: string;
  rows: Row[];
  totals: { total_hours: number; regular_hours: number; overtime_hours: number };
  warnings: string[];
}
interface Period { start: string; end: string; current: boolean }
interface Punchable { employee_id: string; name: string; position: string | null; on_clock: boolean; since: string | null; job: { id: string; name: string } | null }

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }) : '');
const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const periodLabel = (p: Period) =>
  `${dayLabel(p.start, { month: 'short', day: 'numeric' })} – ${dayLabel(p.end, { month: 'short', day: 'numeric', year: 'numeric' })}${p.current ? ' (current)' : ''}`;
const duration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

function dayColumns(start: string, end: string) {
  const out: Array<{ key: string; label: string; num: number }> = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    out.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      num: d.getUTCDate(),
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const SOURCE: Record<string, [string, string]> = {
  CREW: ['CREW APP', 'ok'],
  CREW_MANUAL: ['MISSED TIME', 'unver'],
  OWNER: ['OFFICE ENTRY', 'unver'],
};
function SourceChip({ iv }: { iv: Interval }) {
  const [label, kind] = SOURCE[iv.source] || [iv.source, 'unver'];
  return (
    <>
      <span className={`tc-chip ${kind}`}>{label}</span>
      {iv.office_edited && <span className="tc-chip unver">OFFICE EDIT</span>}
      {iv.synced_late && <span className="tc-chip" title="Punched with no signal; sent when the phone reconnected">SENT LATE</span>}
    </>
  );
}
function StatusChip({ iv }: { iv: Interval }) {
  if (iv.live) return <span className="tc-chip live">ON THE CLOCK</span>;
  if (iv.status === 'APPROVED') return <span className="tc-chip ok">APPROVED</span>;
  if (iv.status === 'REJECTED') return <span className="tc-chip anom">REJECTED</span>;
  return <span className="tc-chip pending">NEEDS APPROVAL</span>;
}

function Drawer({ label, wide, onClose, children }: { label: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <>
      <div className="tc-scrim" onClick={onClose} />
      <aside className={`tc-drawer${wide ? ' wide' : ''}`} role="dialog" aria-label={label}>{children}</aside>
    </>
  );
}

type DrawerState =
  | { kind: 'card'; employeeId: string }
  | { kind: 'onclock' }
  | { kind: 'quick' }
  | { kind: 'add' }
  | null;

export default function TimeCards() {
  const qc = useQueryClient();
  const router = useRouter();
  const [periodIdx, setPeriodIdx] = useState(0);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null);

  const { data: periodsData } = useQuery({ queryKey: ['tc-periods'], queryFn: () => employeesApi.periods() });
  const periods: Period[] = periodsData?.data?.data?.periods || [];
  const frequency: string = periodsData?.data?.data?.frequency || 'WEEKLY';
  const period = periods[periodIdx];

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['timecards', period?.start, period?.end],
    queryFn: () => employeesApi.timecards(period!.start, period!.end),
    enabled: !!period,
    refetchInterval: 60_000,
  });
  const report: Report | undefined = reportData?.data?.data;

  const { data: punchData } = useQuery({ queryKey: ['punchable'], queryFn: () => employeesApi.punchable(), refetchInterval: 60_000 });
  const punchable: Punchable[] = punchData?.data?.data || [];
  const onClock = punchable.filter((p) => p.on_clock);

  useEffect(() => { setPicked(new Set()); }, [period?.start]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['timecards'] });
    qc.invalidateQueries({ queryKey: ['punchable'] });
    qc.invalidateQueries({ queryKey: ['time-entries'] });
  };

  const approve = useMutation({
    mutationFn: (ids: string[]) => employeesApi.approveCards(period!.start, period!.end, ids),
    onSuccess: () => { setPicked(new Set()); refresh(); },
    onError: (e) => setNote({ text: errMsg(e, 'Failed to approve.'), err: true }),
  });

  const cols = useMemo(() => (report ? dayColumns(report.period_start, report.period_end) : []), [report]);
  const worked = report?.rows.filter((r) => r.total_hours > 0) || [];
  const approvedCount = worked.filter((r) => r.approved).length;
  const approvable = (r: Row) => r.pending > 0;

  // Day view opens on the busiest day rather than an empty Sunday.
  const hoursFor = (key: string) => (report?.rows || []).reduce((sum, r) => sum + (r.days.find((d) => d.date === key)?.hours ?? 0), 0);
  const day = activeDay && cols.some((c) => c.key === activeDay)
    ? activeDay
    : cols.reduce((best, c) => (hoursFor(c.key) > hoursFor(best) ? c.key : best), cols[0]?.key || '');

  const pendingRows = (report?.rows || []).filter(approvable);
  const footText = note?.text ?? (pendingRows.length
    ? `${pendingRows.length} awaiting approval`
    : worked.length ? 'Everything here is approved.'
    : report?.rows.length ? 'Nobody logged time this period.' : '');

  function toggle(id: string) {
    setNote(null);
    setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const freqParam = frequency;
  const card = drawer?.kind === 'card' ? report?.rows.find((r) => r.employee_id === drawer.employeeId) : undefined;

  return (
    <div>
      <div className="tc-controls">
        <div className="tc-field">
          <label htmlFor="tc-period">Pay period</label>
          <div className="tc-stepper">
            <button className="tc-step" aria-label="Previous period" title="Previous period" disabled={periodIdx >= periods.length - 1} onClick={() => setPeriodIdx((i) => i + 1)}>‹</button>
            <select id="tc-period" className="glass-input" value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
              {periods.map((p, i) => <option key={p.start} value={i}>{periodLabel(p)}</option>)}
            </select>
            <button className="tc-step" aria-label="Next period" title="Next period" disabled={periodIdx <= 0} onClick={() => setPeriodIdx((i) => i - 1)}>›</button>
          </div>
        </div>
        <div className="tc-field">
          <label>View</label>
          <div className="tc-seg" role="group" aria-label="View">
            <button aria-pressed={view === 'week'} onClick={() => setView('week')}>{cols.length > 7 ? 'Period' : 'Week'}</button>
            <button aria-pressed={view === 'day'} onClick={() => setView('day')}>Day</button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setDrawer({ kind: 'quick' })}>Quick punch</button>
        <button className="btn btn-ghost" onClick={() => setDrawer({ kind: 'add' })}>Add hours</button>
        {period && (
          <button className="btn btn-ghost" title="Start a pay run for this period with approved time"
            onClick={() => router.push(`/admin/payroll?new=1&start=${period.start}&end=${period.end}&frequency=${freqParam}`)}>
            Run payroll
          </button>
        )}
      </div>

      {view === 'day' && cols.length > 0 && (
        <div className="tc-daybar">
          {cols.map((c) => {
            const h = hoursFor(c.key);
            return (
              <button key={c.key} aria-pressed={c.key === day} onClick={() => setActiveDay(c.key)}>
                <span className="d-name">{c.label}</span><span className="d-num">{c.num}</span>
                <span className="d-hrs">{h ? fmt(h) : '—'}</span>
              </button>
            );
          })}
        </div>
      )}

      {report && (
        <div className="tc-tiles">
          <button className="tc-tile live" onClick={() => setDrawer({ kind: 'onclock' })}>
            <div className="k">On the clock now</div>
            <div className="v">{onClock.length}</div>
            <span className="go">See who →</span>
          </button>
          <div className="tc-tile">
            <div className="k">People</div><div className="v">{worked.length}</div>
            {worked.length < report.rows.length && <span className="tc-muted">{report.rows.length - worked.length} with no hours</span>}
          </div>
          <div className="tc-tile"><div className="k">Total hours</div><div className="v">{fmt(report.totals.total_hours)}</div></div>
          <div className="tc-tile"><div className="k">Regular</div><div className="v">{fmt(report.totals.regular_hours)}</div></div>
          <div className="tc-tile ot"><div className="k">Overtime</div><div className="v">{fmt(report.totals.overtime_hours)}</div></div>
          <div className={`tc-tile${approvedCount === worked.length && worked.length ? ' done' : ''}`}>
            <div className="k">Approved</div><div className="v">{approvedCount} / {worked.length}</div>
          </div>
        </div>
      )}

      {report?.warnings.map((w) => <p key={w} className="tc-notice">{w}</p>)}

      <div className="glass tc-scroller">
        <table className="tc-table">
          {isLoading || !report ? (
            <tbody><tr><td className="empty-row">Loading...</td></tr></tbody>
          ) : view === 'day' ? (
            <DayGrid report={report} day={day} onOpen={(id) => setDrawer({ kind: 'card', employeeId: id })} />
          ) : report.rows.length === 0 ? (
            <tbody><tr><td className="empty-row">No employees yet. Add your crew on the Team tab.</td></tr></tbody>
          ) : (
            <>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input type="checkbox" aria-label="Select all" checked={pendingRows.length > 0 && pendingRows.every((r) => picked.has(r.employee_id))}
                      onChange={(e) => setPicked(e.target.checked ? new Set(pendingRows.map((r) => r.employee_id)) : new Set())} />
                  </th>
                  <th>Employee</th>
                  {cols.map((c) => <th key={c.key} className="day">{c.label}<br />{c.num}</th>)}
                  <th className="num">Total</th><th className="num">Reg</th><th className="num">OT</th>
                  <th>Flags</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => {
                  const byDay = new Map(row.days.map((d) => [d.date, d]));
                  return (
                    <tr key={row.employee_id} className={`clickable${row.total_hours === 0 && !row.on_clock ? ' no-hours' : ''}`}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest('input,button,a')) setDrawer({ kind: 'card', employeeId: row.employee_id }); }}>
                      <td>{approvable(row) && <input type="checkbox" checked={picked.has(row.employee_id)} onChange={() => toggle(row.employee_id)} aria-label={`Select ${row.employee_name}`} />}</td>
                      <td className="name"><span className="link">{row.employee_name}</span></td>
                      {cols.map((c) => {
                        const d = byDay.get(c.key);
                        const live = d?.intervals.some((i) => i.live);
                        const off = row.time_off.find((o) => o.date === c.key);
                        if (!d && off) {
                          return <td key={c.key} className="day" title={off.kind === 'CALL_OFF' ? `Called off: ${off.reason.replace(/_/g, ' ')}` : `Time off: ${off.reason.replace(/_/g, ' ')}`}>
                            <span className={`tc-chip ${off.kind === 'CALL_OFF' ? 'anom' : ''}`}>OFF</span></td>;
                        }
                        return <td key={c.key} className={`day${d ? '' : ' empty'}`}>{d ? (d.hours ? fmt(d.hours) : live ? 'on' : '0.00') : '·'}</td>;
                      })}
                      <td className="num">{fmt(row.total_hours)}</td>
                      <td className="num">{fmt(row.regular_hours)}</td>
                      <td className={`num${row.overtime_hours > 0 ? ' ot' : ''}`}>{fmt(row.overtime_hours)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {row.on_clock && <span className="tc-chip live">ON THE CLOCK</span>}
                          {row.hand_keyed && <span className="tc-chip unver">HAND-KEYED</span>}
                          {row.anomalies.length > 0 && <span className="tc-chip anom">{row.anomalies.length} TO CHECK</span>}
                          {row.rejected > 0 && <span className="tc-chip">{row.rejected} REJECTED</span>}
                        </div>
                      </td>
                      <td>
                        {row.total_hours === 0 && !row.pending
                          ? <span className="tc-muted">No hours this period</span>
                          : row.approved
                            ? <><span className="tc-chip ok">APPROVED</span>{row.locked_by_payroll && <> <span className="tc-chip locked">PAID</span></>}
                                {row.approved_by && <div className="tc-muted" style={{ fontSize: 11 }}>{row.approved_by}</div>}</>
                            : <span className="tc-muted">Awaiting approval ({row.pending})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          )}
        </table>
      </div>

      {view === 'week' && (
        <div className="tc-foot">
          <span className="tc-muted" style={note?.err ? { color: '#FF3B30' } : undefined}>{footText}</span>
          <button className="btn btn-primary" disabled={picked.size === 0 || approve.isPending} onClick={() => approve.mutate([...picked])}>
            {picked.size ? `Approve ${picked.size} time card${picked.size === 1 ? '' : 's'}` : 'Approve selected'}
          </button>
        </div>
      )}

      {drawer?.kind === 'card' && card && report && (
        <TimecardDrawer row={card} report={report} onClose={() => setDrawer(null)} onChanged={refresh} />
      )}
      {drawer?.kind === 'onclock' && <OnClockDrawer people={onClock} onClose={() => setDrawer(null)} onRefresh={refresh} />}
      {drawer?.kind === 'quick' && <QuickPunchDrawer people={punchable} onClose={() => setDrawer(null)} onChanged={refresh} />}
      {drawer?.kind === 'add' && <AddHoursDrawer onClose={() => setDrawer(null)} onChanged={refresh} />}
    </div>
  );
}

// ── Day view ────────────────────────────────────────────────────────────────

function DayGrid({ report, day, onOpen }: { report: Report; day: string; onOpen: (id: string) => void }) {
  const worked = report.rows
    .map((row) => ({ row, d: row.days.find((x) => x.date === day) }))
    .filter((x): x is { row: Row; d: Day } => !!x.d);
  if (!worked.length) {
    return <tbody><tr><td className="empty-row">Nobody worked on {dayLabel(day)}.</td></tr></tbody>;
  }
  return (
    <>
      <thead><tr><th>Employee</th><th>In / out</th><th>Job</th><th>Source</th><th>Status</th><th className="num">Hours</th></tr></thead>
      <tbody>
        {worked.flatMap(({ row, d }) => d.intervals.map((iv, i) => (
          <tr key={iv.id} className="clickable" onClick={() => onOpen(row.employee_id)}>
            <td className="name">{i === 0 && <span className="link">{row.employee_name}</span>}</td>
            <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {iv.start ? <>{time(iv.start)} <span className="tc-muted">→</span> {iv.end ? time(iv.end) : 'now'}</> : <span className="tc-muted">Hours only</span>}
            </td>
            <td className="tc-muted">{iv.job?.name || '—'}</td>
            <td><SourceChip iv={iv} /></td>
            <td><StatusChip iv={iv} /></td>
            <td className="num">{iv.live ? '—' : fmt(iv.hours)}</td>
          </tr>
        )))}
        <tr><td colSpan={6} className="tc-muted" style={{ textAlign: 'right' }}>
          {worked.length} worked · {fmt(worked.reduce((n, x) => n + x.d.hours, 0))} hours on {dayLabel(day)}
        </td></tr>
      </tbody>
    </>
  );
}

// ── One person's time card ──────────────────────────────────────────────────

function TimecardDrawer({ row, report, onClose, onChanged }: { row: Row; report: Report; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ start: '', end: '', brk: '0' });
  const [err, setErr] = useState('');

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { setErr(''); setEditing(null); onChanged(); },
    onError: (e) => setErr(errMsg(e, 'Something went wrong.')),
  });

  function startEdit(iv: Interval) {
    setErr('');
    setEditing(iv.id);
    setForm({ start: hhmm(iv.start) || '07:00', end: hhmm(iv.end), brk: String(iv.break_minutes || 0) });
  }
  function reject(iv: Interval) {
    const reason = prompt('Reason (the employee sees this in the crew app):', '');
    if (reason === null) return;
    run.mutate(() => employeesApi.reviewTime([iv.id], 'reject', reason));
  }

  return (
    <Drawer label={`Time card for ${row.employee_name}`} onClose={onClose}>
      <div className="tc-drawer-head">
        <div>
          <h2>{row.employee_name}</h2>
          <span className="tc-muted">{[row.position, row.worker_type === 'W2' ? 'W-2' : '1099'].filter(Boolean).join(' · ')}</span>
          <span className="tc-muted">{dayLabel(report.period_start, { month: 'short', day: 'numeric' })} → {dayLabel(report.period_end, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="tc-drawer-body">
        <div className="tc-totals">
          <div><div className="k">Total</div><div className="v">{fmt(row.total_hours)}</div></div>
          <div><div className="k">Regular</div><div className="v">{fmt(row.regular_hours)}</div></div>
          <div><div className="k">Overtime</div><div className="v" style={row.overtime_hours > 0 ? { color: '#E8590C' } : undefined}>{fmt(row.overtime_hours)}</div></div>
        </div>
        {row.hand_keyed && <p className="tc-notice">Contains time entered or changed by hand, with no clock-in behind it.</p>}
        {row.time_off.length > 0 && (
          <p className="tc-notice" style={{ background: '#F1F5F9', borderColor: '#E2E8F0', borderLeftColor: '#64748b', color: '#334155' }}>
            Time off: {row.time_off.map((o) => `${dayLabel(o.date, { weekday: 'short', month: 'short', day: 'numeric' })} (${o.kind === 'CALL_OFF' ? 'called off' : 'approved'}, ${o.reason.replace(/_/g, ' ')})`).join(', ')}
          </p>
        )}
        {row.anomalies.map((a) => <p key={a} className="tc-notice">{a}</p>)}

        {row.days.length === 0 && <p className="tc-muted">No hours recorded in this period.</p>}
        {row.days.map((d) => (
          <div key={d.date} className="tc-day">
            <header><b>{dayLabel(d.date)}</b><span className="hrs">{fmt(d.hours)} h</span></header>
            {d.intervals.map((iv) => (
              <div key={iv.id} className={`tc-punch${iv.status === 'REJECTED' ? ' rejected' : ''}`}>
                {editing === iv.id ? (
                  <div className="line">
                    <input className="glass-input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Start" style={{ padding: '6px 8px' }} />
                    <span className="arrow">→</span>
                    <input className="glass-input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="End" style={{ padding: '6px 8px' }} />
                    <input className="glass-input" type="number" min="0" max="240" step="5" value={form.brk} onChange={(e) => setForm({ ...form, brk: e.target.value })} aria-label="Break minutes" title="Unpaid break (min)" style={{ padding: '6px 8px', width: 70 }} />
                    <span className="tc-muted">min break</span>
                    <button className="tc-icon-btn" style={{ color: '#1e40af' }} disabled={run.isPending}
                      onClick={() => run.mutate(() => employeesApi.updateTime(iv.id, { start_time: form.start, end_time: form.end || undefined, break_minutes: Number(form.brk) || 0 }))}>Save</button>
                    <button className="tc-icon-btn" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="line">
                      <span className="times">
                        {iv.start ? <>{time(iv.start)} <span className="arrow">→</span> {iv.end ? time(iv.end) : 'now'}</> : 'Hours only'}
                      </span>
                      <SourceChip iv={iv} />
                      <StatusChip iv={iv} />
                      <span className="dur">{iv.live ? '' : `${fmt(iv.hours)} h`}</span>
                    </div>
                    <div className="sub">
                      <LocationLinks iv={iv} />
                      {[iv.job?.name, iv.break_minutes ? `${iv.break_minutes} min break` : null, iv.notes].filter(Boolean).join(' · ')}
                      {iv.status === 'REJECTED' && iv.review_note && <span style={{ color: '#B3261E' }}> · Rejected: {iv.review_note}</span>}
                    </div>
                    {iv.live && (
                      <div className="line" style={{ marginTop: 4, gap: 2 }}>
                        <button className="tc-icon-btn" style={{ color: '#1e40af' }} onClick={() => startEdit(iv)}>Set clock-out</button>
                      </div>
                    )}
                    {!iv.live && (
                      <div className="line" style={{ marginTop: 4, gap: 2 }}>
                        {iv.status !== 'APPROVED' && <button className="tc-icon-btn" style={{ color: '#15803d' }} onClick={() => run.mutate(() => employeesApi.reviewTime([iv.id], 'approve'))}>Approve</button>}
                        {iv.status === 'PENDING' && <button className="tc-icon-btn" style={{ color: '#B3261E' }} onClick={() => reject(iv)}>Reject</button>}
                        {iv.start && !(iv.status === 'APPROVED' && row.locked_by_payroll) && <button className="tc-icon-btn" style={{ color: '#1e40af' }} onClick={() => startEdit(iv)}>Edit times</button>}
                        {!(iv.status === 'APPROVED' && row.locked_by_payroll) && (
                          <button className="tc-icon-btn" style={{ color: 'var(--text-tertiary)' }} onClick={() => { if (confirm('Delete this shift?')) run.mutate(() => employeesApi.deleteTime(iv.id)); }}>Delete</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}

        {err && <p style={{ color: '#FF3B30', fontSize: 13, marginTop: 8 }}>{err}</p>}

        {row.pending > 0 ? (
          <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} disabled={run.isPending}
            onClick={() => run.mutate(() => employeesApi.approveCards(report.period_start, report.period_end, [row.employee_id]))}>
            Approve time card ({row.pending} {row.pending === 1 ? 'shift' : 'shifts'})
          </button>
        ) : row.approved ? (
          <div className="tc-approved">
            <div>
              <b>Approved</b>
              <span className="tc-muted">
                {row.approved_at ? new Date(row.approved_at).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                {row.approved_by ? ` · ${row.approved_by}` : ''}
                {row.locked_by_payroll ? ' · in a finalized pay run' : ''}
              </span>
            </div>
            <button className="btn btn-ghost" disabled={run.isPending || row.locked_by_payroll}
              title={row.locked_by_payroll ? 'Reopen the pay run first' : undefined}
              onClick={() => run.mutate(() => employeesApi.unapproveCards(report.period_start, report.period_end, [row.employee_id]))}>
              Un-approve
            </button>
          </div>
        ) : (
          <p className="tc-muted" style={{ marginTop: 12 }}>Nothing to approve yet.</p>
        )}
      </div>
    </Drawer>
  );
}

// Where the phone was at each punch, as a map link.
function LocationLinks({ iv }: { iv: Interval }) {
  const link = (label: string, l: { lat: number; lng: number; acc: number | null }) => (
    <a href={`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`} target="_blank" rel="noreferrer"
      style={{ color: '#1e40af', marginRight: 8 }} title={l.acc ? `Accurate to about ${l.acc} m` : undefined}>
      {label} location
    </a>
  );
  if (!iv.in_loc && !iv.out_loc) {
    return iv.source === 'CREW' && iv.start ? <span style={{ marginRight: 8 }}>No location shared · </span> : null;
  }
  return <>{iv.in_loc && link('In', iv.in_loc)}{iv.out_loc && link('Out', iv.out_loc)}</>;
}

// ── Who is on the clock ─────────────────────────────────────────────────────

const SHIFT_SORTS: Record<string, [string, (a: Punchable, b: Punchable) => number]> = {
  name: ['Name', (a, b) => a.name.localeCompare(b.name)],
  longest: ['Longest on shift', (a, b) => new Date(a.since!).getTime() - new Date(b.since!).getTime()],
  newest: ['Just clocked in', (a, b) => new Date(b.since!).getTime() - new Date(a.since!).getTime()],
  job: ['Job', (a, b) => (a.job?.name || '').localeCompare(b.job?.name || '') || a.name.localeCompare(b.name)],
};

function OnClockDrawer({ people, onClose, onRefresh }: { people: Punchable[]; onClose: () => void; onRefresh: () => void }) {
  const [sort, setSort] = useState('name');
  const [job, setJob] = useState('');
  const now = Date.now();
  const jobs = [...new Map(people.filter((p) => p.job).map((p) => [p.job!.id, p.job!])).values()];
  const shown = people.filter((p) => !job || p.job?.id === job).sort(SHIFT_SORTS[sort][1]);
  return (
    <Drawer label="Who is on the clock" wide onClose={onClose}>
      <div className="tc-drawer-head">
        <div>
          <h2>On the clock now</h2>
          <span className="tc-muted">{shown.length === people.length ? `${people.length} on the clock` : `${shown.length} of ${people.length} on the clock`}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={onRefresh}>Refresh</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="tc-drawer-body">
        <div className="tc-tools">
          <select className="glass-input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {Object.entries(SHIFT_SORTS).map(([k, [label]]) => <option key={k} value={k}>Sort: {label}</option>)}
          </select>
          <select className="glass-input" value={job} onChange={(e) => setJob(e.target.value)} aria-label="Filter by job">
            <option value="">All jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        {shown.length === 0 ? <p className="tc-muted">Nobody is on the clock{job ? ' on that job' : ''}.</p> : (
          <table className="tc-table">
            <thead><tr><th>Employee</th><th>Job</th><th className="num">Since</th><th className="num">On shift</th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const mins = Math.max(0, Math.floor((now - new Date(p.since!).getTime()) / 60000));
                return (
                  <tr key={p.employee_id} className={mins > 12 * 60 ? 'long' : ''}>
                    <td className="name">{p.name}</td>
                    <td className="tc-muted">{p.job?.name || 'No specific job'}</td>
                    <td className="num">{time(p.since!)}</td>
                    <td className="num dur" style={{ fontWeight: 600 }}>{duration(mins)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="tc-muted" style={{ marginTop: 10 }}>Over 12 hours is usually a missed clock-out, not someone still working.</p>
      </div>
    </Drawer>
  );
}

// ── Quick punch ─────────────────────────────────────────────────────────────

const REASONS: Record<string, string> = {
  missed_punch: 'Missed the punch',
  forgot_clock_out: 'Forgot to clock out',
  left_early: 'Left early',
  no_phone: 'No phone on site',
  paper_sheet_entry: 'From a paper sheet',
  other: 'Other',
};

function useJobs() {
  const { data } = useQuery({ queryKey: ['jobs', 'for-hours'], queryFn: () => jobsApi.list({ limit: '200' }) });
  return ((data?.data?.data || []) as Array<{ id: string; name: string; status: string }>)
    .filter((j) => ['ACTIVE', 'ESTIMATING', 'INVOICED'].includes(j.status));
}

function QuickPunchDrawer({ people, onClose, onChanged }: { people: Punchable[]; onClose: () => void; onChanged: () => void }) {
  const jobs = useJobs();
  const [reason, setReason] = useState('missed_punch');
  const [note, setNote] = useState('');
  const [job, setJob] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const punch = useMutation({
    mutationFn: (p: Punchable) => employeesApi.quickPunch({
      employee_id: p.employee_id, action: p.on_clock ? 'out' : 'in', job_id: job || undefined, reason, note: note.trim() || undefined,
    }),
    onSuccess: () => { setErr(''); onChanged(); },
    onError: (e) => setErr(errMsg(e, 'Failed to punch.')),
  });
  const now = Date.now();
  const shown = people.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Drawer label="Quick punch" wide onClose={onClose}>
      <div className="tc-drawer-head">
        <div>
          <h2>Quick punch</h2>
          <span className="tc-muted">Clock someone in or out now. Recorded as an office entry, never as a real clock-in.</span>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="tc-drawer-body">
        <div className="tc-tools">
          <select className="glass-input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
            {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="glass-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
          <select className="glass-input" value={job} onChange={(e) => setJob(e.target.value)} aria-label="Job for clock-ins">
            <option value="">Clock-ins: no specific job</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>Clock-ins: {j.name}</option>)}
          </select>
        </div>
        <input className="glass-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search"
          style={{ width: '100%', padding: '9px 12px', fontSize: 14, marginBottom: 12 }} />
        {err && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</p>}
        {shown.length === 0 ? <p className="tc-muted">Nobody matches.</p> : (
          <table className="tc-table">
            <thead><tr><th>Employee</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.employee_id}>
                  <td className="name">{p.name}{p.position && <span className="tc-muted" style={{ fontWeight: 400 }}> · {p.position}</span>}</td>
                  <td>{p.on_clock
                    ? <><span className="tc-chip live">ON SHIFT</span> <span className="tc-muted">{duration(Math.floor((now - new Date(p.since!).getTime()) / 60000))}{p.job ? ` · ${p.job.name}` : ''}</span></>
                    : <span className="tc-muted">Off</span>}</td>
                  <td className="num">
                    <button className={`btn ${p.on_clock ? 'btn-ghost' : 'btn-primary'}`} style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={punch.isPending} onClick={() => punch.mutate(p)}>
                      {p.on_clock ? 'Clock out' : 'Clock in'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Drawer>
  );
}

// ── Add hours by hand ───────────────────────────────────────────────────────

function AddHoursDrawer({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const jobs = useJobs();
  const { data } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() });
  const employees = ((data?.data?.data || []) as Array<{ id: string; first_name: string; last_name: string; status: string }>).filter((e) => e.status === 'ACTIVE');
  const [f, setF] = useState({ employee_id: '', work_date: todayIso(), hours: '', job_id: '', notes: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const add = useMutation({
    mutationFn: () => employeesApi.addTime({ ...f, hours: Number(f.hours), job_id: f.job_id || undefined }),
    onSuccess: () => {
      const who = employees.find((e) => e.id === f.employee_id);
      setDone(`Added ${f.hours} h for ${who?.first_name ?? ''} on ${dayLabel(f.work_date, { weekday: 'short', month: 'short', day: 'numeric' })}.`);
      setF((x) => ({ ...x, hours: '', notes: '' }));
      setErr('');
      onChanged();
    },
    onError: (e) => setErr(errMsg(e, 'Failed to add hours.')),
  });
  const field = { width: '100%', padding: '9px 12px', fontSize: 14 } as const;
  return (
    <Drawer label="Add hours" onClose={onClose}>
      <div className="tc-drawer-head">
        <div>
          <h2>Add hours</h2>
          <span className="tc-muted">For time with no clock-in, like a paper sheet. Approved right away and marked as an office entry.</span>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="tc-drawer-body">
        <label className="tc-muted" style={{ display: 'block', marginBottom: 6 }}>Employee</label>
        <select className="glass-input" style={{ ...field, marginBottom: 12 }} value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
          <option value="">Select...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="tc-muted" style={{ display: 'block', marginBottom: 6 }}>Date</label>
            <input className="glass-input" style={field} type="date" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} />
          </div>
          <div>
            <label className="tc-muted" style={{ display: 'block', marginBottom: 6 }}>Hours</label>
            <input className="glass-input" style={field} type="number" min="0" max="24" step="0.25" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} placeholder="8" />
          </div>
        </div>
        <label className="tc-muted" style={{ display: 'block', marginBottom: 6 }}>Job (optional)</label>
        <select className="glass-input" style={{ ...field, marginBottom: 12 }} value={f.job_id} onChange={(e) => setF({ ...f, job_id: e.target.value })}>
          <option value="">No job</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
        <label className="tc-muted" style={{ display: 'block', marginBottom: 6 }}>Note</label>
        <input className="glass-input" style={{ ...field, marginBottom: 16 }} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {err && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</p>}
        {done && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 10 }}>{done}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={add.isPending}
          onClick={() => {
            if (!f.employee_id) return setErr('Pick an employee.');
            if (!(Number(f.hours) > 0)) return setErr('Enter the hours worked.');
            add.mutate();
          }}>
          {add.isPending ? 'Adding...' : 'Add hours'}
        </button>
      </div>
    </Drawer>
  );
}

'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';
import { FilterChips, errMsg } from './ui';

// Time off from the crew app. Call-offs ("can't make it today") are reported
// and need nothing from the office; requests for later days wait for an answer.

const REASONS: Record<string, string> = {
  sick: 'Sick', family_emergency: 'Family emergency', child_care: 'Child care',
  no_transportation: 'No ride / car trouble', medical_appointment: 'Doctor or medical appointment',
  weather: 'Weather / roads', legal: 'Court or legal appointment', vacation: 'Vacation',
  family_event: 'Family event', personal: 'Personal', other: 'Other',
};

interface Req {
  id: string;
  kind: 'CALL_OFF' | 'REQUEST';
  reason: string;
  starts_on: string;
  ends_on: string;
  days: number;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  decision_note: string | null;
  decided_by: string | null;
  created_at: string;
  employee: { id: string; first_name: string; last_name: string };
}

const VIEWS = ['open', 'all'] as const;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const when = (r: Req) => (r.starts_on === r.ends_on ? day(r.starts_on) : `${day(r.starts_on)} – ${day(r.ends_on)}`);

export default function CrewTimeOff() {
  const qc = useQueryClient();
  const [view, setView] = useState<(typeof VIEWS)[number]>('open');
  const [err, setErr] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['crew-time-off', view], queryFn: () => employeesApi.timeOff(view), refetchInterval: 60_000 });
  const rows: Req[] = data?.data?.data?.requests || [];
  const today: string = data?.data?.data?.today || '';

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approve' | 'deny'; note?: string }) => employeesApi.decideTimeOff(id, decision, note),
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['crew-time-off'] }); qc.invalidateQueries({ queryKey: ['timecards'] }); },
    onError: (e) => setErr(errMsg(e, 'Failed to save.')),
  });

  const pending = rows.filter((r) => r.status === 'PENDING');
  const callOffsToday = rows.filter((r) => r.kind === 'CALL_OFF' && r.status === 'APPROVED' && r.starts_on <= today && r.ends_on >= today);
  const rest = rows.filter((r) => r.status !== 'PENDING' && !callOffsToday.includes(r));

  function deny(r: Req) {
    const note = prompt(`Reason for ${r.employee.first_name} (they see this in the crew app):`, '');
    if (note === null) return;
    decide.mutate({ id: r.id, decision: 'deny', note });
  }

  const chip = (r: Req) => {
    if (r.kind === 'CALL_OFF') return <span className={`tc-chip ${r.status === 'CANCELLED' ? '' : 'anom'}`}>{r.status === 'CANCELLED' ? 'WITHDRAWN' : 'CALLED OFF'}</span>;
    const map: Record<string, [string, string]> = { PENDING: ['pending', 'NEEDS ANSWER'], APPROVED: ['ok', 'APPROVED'], DENIED: ['anom', 'DENIED'], CANCELLED: ['', 'WITHDRAWN'] };
    const [cls, label] = map[r.status];
    return <span className={`tc-chip ${cls}`}>{label}</span>;
  };

  const table = (list: Req[], actions: boolean) => (
    <div className="glass tc-scroller" style={{ marginBottom: 20 }}>
      <table className="tc-table">
        <thead><tr><th>Employee</th><th>When</th><th>Reason</th><th>Note</th><th>Status</th>{actions && <th />}</tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td className="name">{r.employee.first_name} {r.employee.last_name}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{when(r)} <span className="tc-muted">· {r.days} {r.days === 1 ? 'day' : 'days'}</span></td>
              <td>{REASONS[r.reason] || r.reason}</td>
              <td className="tc-muted" style={{ maxWidth: 260 }}>{[r.note, r.decision_note && `Office: ${r.decision_note}`].filter(Boolean).join(' · ') || '—'}</td>
              <td>{chip(r)}{r.decided_by && <div className="tc-muted" style={{ fontSize: 11 }}>{r.decided_by}</div>}</td>
              {actions && (
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, color: '#B3261E' }} disabled={decide.isPending} onClick={() => deny(r)}>Deny</button>{' '}
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'approve' })}>Approve</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <FilterChips options={VIEWS} value={view} onChange={setView} labels={{ open: 'Upcoming', all: 'Last 90 days' }} />
        <span className="tc-muted">Crew send these from the Time off tab in the crew app. Approved days show as OFF on the time cards.</span>
      </div>
      {err && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</p>}
      {isLoading ? <p className="tc-muted">Loading...</p> : rows.length === 0 ? (
        <div className="glass" style={{ padding: 40, textAlign: 'center' }}><span className="tc-muted">No time off {view === 'open' ? 'coming up' : 'in the last 90 days'}.</span></div>
      ) : (
        <>
          {callOffsToday.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#B3261E' }}>Called off today</h3>
              {table(callOffsToday, false)}
            </>
          )}
          {pending.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Waiting for your answer ({pending.length})</h3>
              {table(pending, true)}
            </>
          )}
          {rest.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{view === 'open' ? 'Coming up' : 'Everything'}</h3>
              {table(rest, false)}
            </>
          )}
        </>
      )}
    </div>
  );
}

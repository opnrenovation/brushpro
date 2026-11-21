'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewApi } from '@/lib/crewApi';
import { useT, errorText } from '@/components/crew/i18n';

// Time off, from the Infinite Resources app: "can't make it today" tells the
// office at once and needs no approval; a request for later days waits for
// the owner's answer.

const CALL_OFF_REASONS = ['sick', 'family_emergency', 'child_care', 'no_transportation',
  'medical_appointment', 'weather', 'legal', 'personal', 'other'];
const REQUEST_REASONS = ['vacation', 'medical_appointment', 'family_event', 'child_care',
  'legal', 'sick', 'personal', 'other'];

interface Off {
  id: string;
  kind: 'CALL_OFF' | 'REQUEST';
  reason: string;
  starts_on: string;
  ends_on: string;
  days: number;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  decision_note: string | null;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

type Sheet = { kind: 'call_off' } | { kind: 'request' } | { kind: 'withdraw'; id: string } | null;

export default function CrewTimeOffPage() {
  const qc = useQueryClient();
  const { t, locale } = useT();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState('sick');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['crew', 'time-off'], queryFn: () => crewApi.timeOff() });
  const today: string = data?.data?.data?.today || '';
  const rows: Off[] = data?.data?.data?.requests || [];

  const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

  const close = () => { setSheet(null); setErr(''); };
  const done = () => { close(); qc.invalidateQueries({ queryKey: ['crew'] }); };

  const send = useMutation({
    mutationFn: () => sheet?.kind === 'call_off'
      ? crewApi.requestTimeOff({ kind: 'call_off', reason, note: note.trim() || undefined })
      : crewApi.requestTimeOff({ kind: 'request', reason, starts_on: from, ends_on: to || from, note: note.trim() || undefined }),
    onSuccess: done,
    onError: (e) => setErr(errorText(t, e, locale)),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => crewApi.cancelTimeOff(id),
    onSuccess: done,
    onError: (e) => setErr(errorText(t, e, locale)),
  });

  function open(kind: 'call_off' | 'request') {
    setErr('');
    setNote('');
    setReason(kind === 'call_off' ? 'sick' : 'vacation');
    const first = addDays(today, 1);
    setFrom(first);
    setTo(first);
    setSheet({ kind });
  }

  // A call-off was never up for approval, so it reads "Reported", not "Approved".
  function chip(r: Off) {
    if (r.kind === 'CALL_OFF') return <span className="crew-chip off">{r.status === 'CANCELLED' ? t.stCancelled : t.stReported}</span>;
    const map: Record<string, [string, string]> = {
      PENDING: ['wait', t.stPending], APPROVED: ['ok', t.stApproved], DENIED: ['no', t.stDenied], CANCELLED: ['off', t.stCancelled],
    };
    const [cls, label] = map[r.status];
    return <span className={`crew-chip ${cls}`}>{label}</span>;
  }

  const reasons = sheet?.kind === 'call_off' ? CALL_OFF_REASONS : REQUEST_REASONS;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>{t.timeOff}</h1>

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        <button className="crew-action danger" onClick={() => open('call_off')} disabled={!today}>
          <span className="crew-action-k">{t.cantMakeIt}</span>
          <span className="crew-action-s">{t.cantMakeItSub}</span>
        </button>
        <button className="crew-action" onClick={() => open('request')} disabled={!today}>
          <span className="crew-action-k">{t.requestOff}</span>
          <span className="crew-action-s">{t.requestOffSub}</span>
        </button>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{t.yourRequests}</h2>
      {isLoading ? <p className="crew-muted">{t.loading}</p> : rows.length === 0 ? (
        <div className="crew-card"><p className="crew-muted" style={{ textAlign: 'center' }}>{t.noRequests}</p></div>
      ) : (
        <div className="crew-card" style={{ padding: 0 }}>
          {rows.map((r) => {
            const canWithdraw = r.status !== 'DENIED' && r.status !== 'CANCELLED' && r.ends_on >= today;
            return (
              <div key={r.id} className="crew-off-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {r.starts_on === r.ends_on ? dayLabel(r.starts_on) : `${dayLabel(r.starts_on)} – ${dayLabel(r.ends_on)}`}
                  </div>
                  <div className="crew-muted">{t.reasons[r.reason] || r.reason} · {t.dayCount(r.days)}</div>
                  {r.note && <div className="crew-muted" style={{ fontStyle: 'italic', marginTop: 4 }}>{r.note}</div>}
                  {r.decision_note && <div className="crew-muted" style={{ fontStyle: 'italic', marginTop: 4 }}>{r.decision_note}</div>}
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end', alignContent: 'start' }}>
                  {chip(r)}
                  {canWithdraw && <button className="crew-link-btn" style={{ padding: 0, fontSize: 13 }} onClick={() => { setErr(''); setSheet({ kind: 'withdraw', id: r.id }); }}>{t.withdraw}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sheet && (
        <div className="crew-sheet-wrap">
          <div className="crew-sheet-scrim" onClick={close} />
          <div className="crew-sheet" role="dialog" aria-modal="true">
            <div className="crew-grab" />
            {sheet.kind === 'withdraw' ? (
              <>
                <h2>{t.withdrawQ}</h2>
                {err && <p className="crew-err">{err}</p>}
                <div className="crew-sheet-actions">
                  <button className="crew-btn danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate(sheet.id)}>{t.yes}</button>
                  <button className="crew-btn quiet" onClick={close}>{t.no}</button>
                </div>
              </>
            ) : (
              <>
                <h2>{sheet.kind === 'call_off' ? t.callOffTitle : t.requestTitle}</h2>
                <p className="crew-lede">{sheet.kind === 'call_off' ? t.callOffLede : t.requestLede}</p>
                <div className="crew-field">
                  <span>{t.reason}</span>
                  <div className="crew-choices">
                    {reasons.map((k) => (
                      <button key={k} type="button" className="crew-choice" aria-pressed={reason === k} onClick={() => setReason(k)}>{t.reasons[k]}</button>
                    ))}
                  </div>
                </div>
                {sheet.kind === 'request' && (
                  <>
                    <label className="crew-field"><span>{t.firstDay}</span>
                      <input className="crew-input" type="date" min={addDays(today, 1)} value={from}
                        onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
                    </label>
                    <label className="crew-field"><span>{t.lastDay}</span>
                      <input className="crew-input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                  </>
                )}
                <label className="crew-field"><span>{t.note}</span>
                  <textarea className="crew-input" rows={3} placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                {err && <p className="crew-err">{err}</p>}
                <div className="crew-sheet-actions">
                  <button className={`crew-btn${sheet.kind === 'call_off' ? ' danger' : ''}`} disabled={send.isPending} onClick={() => send.mutate()}>
                    {sheet.kind === 'call_off' ? t.sendCallOff : t.sendRequest}
                  </button>
                  <button className="crew-btn quiet" onClick={close}>{t.cancel}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

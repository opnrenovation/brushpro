'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Check, AlertCircle } from 'lucide-react';
import { crewApi } from '@/lib/crewApi';
import { useT, errorText } from '@/components/crew/i18n';
import { useQueue, useOnline, enqueue, position, isNetworkError, QueuedPunch } from '@/components/crew/punch';
import { hrs } from '@/components/crew/format';

// The punch is a press-and-hold, not a tap (from the Infinite Resources app).
// A phone in a pocket or a hand pulling open a door will brush a button;
// nothing brushes a button for three straight seconds. Letting go early
// cancels, and the ring shows exactly how much longer to hold.
const HOLD_MS = 3000;
const RING = 301; // 2πr for r=48
const BREAKS = [0, 15, 30, 45, 60];

interface Job { id: string; name: string; address: string }
interface OpenEntry { id: string; clock_in: string; job: { id: string; name: string } | null }
interface Result { ok: boolean; wasOut: boolean; at: Date; note?: string }

export default function CrewClockPage() {
  const qc = useQueryClient();
  const { t, locale } = useT();
  const queue = useQueue();
  const online = useOnline();
  const [jobId, setJobId] = useState('');
  const [breakMin, setBreakMin] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const ringRef = useRef<SVGCircleElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const started = useRef(0);

  const { data: meData, isLoading } = useQuery({ queryKey: ['crew', 'me'], queryFn: () => crewApi.me(), refetchInterval: 60_000 });
  const { data: jobsData } = useQuery({ queryKey: ['crew', 'jobs'], queryFn: () => crewApi.jobs() });
  const me = meData?.data?.data;
  const jobs: Job[] = jobsData?.data?.data || [];
  const jobName = (id?: string | null) => jobs.find((j) => j.id === id)?.name;

  // Punches waiting to send decide the state until they reach the office.
  const last: QueuedPunch | undefined = queue[queue.length - 1];
  const serverOpen: OpenEntry | null = me?.open_entry || null;
  const isIn = last ? last.type === 'in' : !!serverOpen;
  const since = last ? (last.type === 'in' ? last.occurred_at : null) : serverOpen?.clock_in ?? null;
  const currentJob = last ? (last.type === 'in' ? jobName(last.job_id) : null) : serverOpen?.job?.name;
  const currentJobId = last ? (last.type === 'in' ? last.job_id : undefined) : serverOpen?.job?.id;

  useEffect(() => {
    if (!jobId && jobs.length === 1) setJobId(jobs[0].id);
  }, [jobs, jobId]);

  const clock = (d: Date | string) => new Date(d).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

  const ringTo = (fraction: number) => {
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING * (1 - fraction));
  };

  async function punch() {
    const at = new Date();
    const out = isIn;
    setBusy(true);
    setError('');
    const p: QueuedPunch = {
      type: out ? 'out' : 'in',
      occurred_at: at.toISOString(),
      ...(out ? { break_minutes: breakMin } : { job_id: jobId || undefined }),
    };
    const fix = await position();
    if (fix) Object.assign(p, fix);
    try {
      if (!navigator.onLine) throw new Error('offline');
      await (out ? crewApi.clockOut(p) : crewApi.clockIn(p));
      setResult({ ok: true, wasOut: out, at });
      if (out) setBreakMin(0);
      qc.invalidateQueries({ queryKey: ['crew'] });
    } catch (e) {
      if (isNetworkError(e)) {
        enqueue(p);
        setResult({ ok: true, wasOut: out, at, note: t.savedOffline });
        if (out) setBreakMin(0);
      } else {
        setResult({ ok: false, wasOut: out, at, note: errorText(t, e, locale) });
      }
    } finally {
      setBusy(false);
    }
  }

  function endHold(completed: boolean) {
    if (timer.current) clearTimeout(timer.current);
    if (frame.current) cancelAnimationFrame(frame.current);
    timer.current = null;
    setHolding(false);
    ringTo(0);
    if (!completed && started.current) {
      setHint(t.released);
      setTimeout(() => setHint(null), 2200);
    } else {
      setHint(null);
    }
    started.current = 0;
  }

  function beginHold(e: React.PointerEvent) {
    if (busy) return;
    e.preventDefault();
    started.current = Date.now();
    setHolding(true);
    setHint(t.keepHolding);
    const step = () => {
      const f = Math.min(1, (Date.now() - started.current) / HOLD_MS);
      ringTo(f);
      if (f < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    timer.current = setTimeout(() => {
      // Only a completed hold punches. A short press never reaches here.
      if (navigator.vibrate) navigator.vibrate(40);
      endHold(true);
      punch();
    }, HOLD_MS);
  }

  const switchJob = useMutation({
    mutationFn: () => crewApi.switchJob({ job_id: jobId || undefined, break_minutes: breakMin }),
    onSuccess: () => {
      setSwitching(false);
      setBreakMin(0);
      qc.invalidateQueries({ queryKey: ['crew'] });
      setResult({ ok: true, wasOut: false, at: new Date(), note: t.switched });
    },
    onError: (e) => setError(errorText(t, e, locale)),
  });

  if (result) {
    return (
      <div className="crew-result">
        <div className={`crew-mark${result.ok ? '' : ' bad'}`}>
          {result.ok ? <Check size={46} strokeWidth={2.5} /> : <AlertCircle size={46} strokeWidth={2.5} />}
        </div>
        <div className="crew-stamp">{clock(result.at)}</div>
        {result.ok && <h2>{result.wasOut ? t.clockedOut : t.clockedIn}</h2>}
        <p>{result.note || (result.wasOut ? t.seeYouNext : t.haveAGoodShift)}</p>
        <button className="crew-link-btn" style={{ fontSize: 16, padding: 8 }} onClick={() => setResult(null)}>{t.done}</button>
      </div>
    );
  }

  if (isLoading && !me) return <p className="crew-muted">{t.loading}</p>;

  const jobPicker = (
    <div style={{ width: '100%', marginBottom: 4 }}>
      <label className="crew-label" htmlFor="job">{t.job}</label>
      <select id="job" className="crew-input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
        <option value="">{t.noJob}</option>
        {jobs.filter((j) => !switching || j.id !== currentJobId).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <div className="crew-whoami">
        <div className="crew-whoami-name">{t.hi(me?.employee?.first_name || '')}</div>
        <div className="crew-whoami-site">
          {new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}
        </div>
      </div>

      <div className="crew-stage">
        <div className="crew-status">
          {isIn
            ? <>{t.working}<strong>{since ? t.since(clock(since)) : ''}</strong>{currentJob && <span className="crew-status-job">{currentJob}</span>}</>
            : <strong>{t.notWorking}</strong>}
        </div>

        {!isIn && jobs.length > 0 && jobPicker}

        <div className={`crew-holder${isIn ? ' out' : ''}${holding ? ' holding' : ''}`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="track" cx="50" cy="50" r="48" />
            <circle className="fill" ref={ringRef} cx="50" cy="50" r="48" />
          </svg>
          <button
            className="crew-hold"
            disabled={busy || switching}
            onPointerDown={beginHold}
            onPointerUp={() => { if (timer.current) endHold(false); }}
            onPointerCancel={() => { if (timer.current) endHold(false); }}
            onPointerLeave={() => { if (timer.current) endHold(false); }}
            onContextMenu={(e) => e.preventDefault()}
            aria-describedby="hold-hint"
          >
            {(isIn ? t.holdOut : t.holdIn).split('\n').map((l, i) => <span key={i}>{l}</span>)}
          </button>
        </div>
        <p className="crew-hint" id="hold-hint">{hint ?? t.holdHint}</p>

        <span className={`crew-pill${online ? '' : ' offline'}`}>
          {online ? t.online : t.offline}{queue.length > 0 && ` · ${t.waitingToSend(queue.length)}`}
        </span>
      </div>

      {isIn && (
        <div className="crew-card">
          <div className="crew-label">{t.breakLabel}</div>
          <div className="crew-choices" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {BREAKS.map((m) => (
              <button key={m} type="button" className="crew-choice" aria-pressed={breakMin === m} onClick={() => setBreakMin(m)}>
                {t.minutes(m)}
              </button>
            ))}
          </div>
          {jobs.length > 0 && online && queue.length === 0 && (
            switching ? (
              <div style={{ marginTop: 14 }}>
                {jobPicker}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="crew-btn quiet" onClick={() => setSwitching(false)}>{t.cancel}</button>
                  <button className="crew-btn" disabled={switchJob.isPending} onClick={() => switchJob.mutate()}>{t.switchTo}</button>
                </div>
              </div>
            ) : (
              <button className="crew-link-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setJobId(''); setSwitching(true); }}>
                {t.switchJob}
              </button>
            )
          )}
        </div>
      )}

      {!isIn && jobs.length === 0 && <p className="crew-muted" style={{ textAlign: 'center', marginBottom: 12 }}>{t.noJobsYet}</p>}
      {error && <p style={{ color: '#D6392B', fontSize: 14, margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="crew-card" style={{ marginBottom: 0 }}>
          <div className="crew-muted">{t.today}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{hrs(me?.today_hours)}</div>
        </div>
        <Link href="/crew/timecard" className="crew-card" style={{ marginBottom: 0, textDecoration: 'none', color: 'inherit' }}>
          <div className="crew-muted">{t.thisWeek}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{hrs(me?.week_hours)}</div>
        </Link>
      </div>

      {jobs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{t.yourJobs}</h2>
          {jobs.slice(0, 3).map((j) => (
            <Link key={j.id} href={`/crew/jobs/${j.id}`} className="crew-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontWeight: 600 }}>{j.name}</div>
              <div className="crew-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={13} strokeWidth={1.5} /> {j.address}
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="crew-muted" style={{ marginTop: 14, fontSize: 12, textAlign: 'center' }}>{t.locationNote}</p>
    </div>
  );
}

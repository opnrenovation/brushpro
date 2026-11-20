'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, MapPin, Repeat } from 'lucide-react';
import { crewApi } from '@/lib/crewApi';
import { clockTime, elapsed, hrs, errText } from '@/components/crew/format';

interface Job { id: string; name: string; address: string; municipality: string }
interface OpenEntry { id: string; clock_in: string; job: { id: string; name: string } | null }

export default function CrewClockPage() {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [jobId, setJobId] = useState('');
  const [breakMin, setBreakMin] = useState('0');
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  const { data: meData, isLoading } = useQuery({ queryKey: ['crew', 'me'], queryFn: () => crewApi.me(), refetchInterval: 60_000 });
  const { data: jobsData } = useQuery({ queryKey: ['crew', 'jobs'], queryFn: () => crewApi.jobs() });
  const me = meData?.data?.data;
  const jobs: Job[] = jobsData?.data?.data || [];
  const open: OpenEntry | null = me?.open_entry || null;

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Default the job picker to the only assigned job, if there is just one.
  useEffect(() => {
    if (!jobId && jobs.length === 1) setJobId(jobs[0].id);
  }, [jobs, jobId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['crew'] });
    setError('');
  };
  const clockIn = useMutation({
    mutationFn: () => crewApi.clockIn({ job_id: jobId || undefined }),
    onSuccess: refresh,
    onError: (e) => setError(errText(e, 'Could not clock in. Check your connection.')),
  });
  const clockOut = useMutation({
    mutationFn: () => crewApi.clockOut({ break_minutes: Number(breakMin) || 0 }),
    onSuccess: () => { refresh(); setBreakMin('0'); },
    onError: (e) => setError(errText(e, 'Could not clock out. Check your connection.')),
  });
  const switchJob = useMutation({
    mutationFn: () => crewApi.switchJob({ job_id: jobId || undefined, break_minutes: Number(breakMin) || 0 }),
    onSuccess: () => { refresh(); setSwitching(false); setBreakMin('0'); },
    onError: (e) => setError(errText(e, 'Could not switch jobs.')),
  });

  if (isLoading) return <p className="crew-muted">Loading...</p>;

  const jobPicker = (
    <div style={{ marginBottom: 14 }}>
      <label className="crew-label" htmlFor="job">Job</label>
      <select id="job" className="crew-input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
        <option value="">No specific job (shop, errands)</option>
        {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Hi {me?.employee?.first_name}</h1>
      <p className="crew-muted" style={{ marginBottom: 16 }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}
      </p>

      {open ? (
        <div className="crew-card" style={{ borderColor: 'rgba(52,199,89,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: '#34C759', display: 'inline-block' }} />
            <span style={{ fontWeight: 600, color: '#1f8a3b' }}>On the clock since {clockTime(open.clock_in)}</span>
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, fontVariantNumeric: 'tabular-nums', margin: '4px 0 6px' }}>{elapsed(open.clock_in, now)}</div>
          <div style={{ marginBottom: 16 }}>
            {open.job ? (
              <Link href={`/crew/jobs/${open.job.id}`} style={{ color: '#007AFF', fontWeight: 600, textDecoration: 'none' }}>{open.job.name}</Link>
            ) : <span className="crew-muted">No specific job</span>}
          </div>

          {switching && jobPicker}

          <label className="crew-label" htmlFor="break">Unpaid break (minutes)</label>
          <input id="break" className="crew-input" type="number" inputMode="numeric" min="0" max="240" step="5"
            value={breakMin} onChange={(e) => setBreakMin(e.target.value)} style={{ marginBottom: 14 }} />

          {switching ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="crew-big-btn" style={{ background: '#94a3b8', flex: 1, fontSize: 16, padding: 16 }} onClick={() => setSwitching(false)}>Cancel</button>
              <button className="crew-big-btn" style={{ background: '#1e40af', flex: 2, fontSize: 16, padding: 16 }} disabled={switchJob.isPending} onClick={() => switchJob.mutate()}>
                <Repeat size={18} strokeWidth={1.5} /> Switch Job
              </button>
            </div>
          ) : (
            <>
              <button className="crew-big-btn" style={{ background: '#FF3B30' }} disabled={clockOut.isPending} onClick={() => clockOut.mutate()}>
                <LogOut size={22} strokeWidth={1.5} /> {clockOut.isPending ? 'Clocking out...' : 'Clock Out'}
              </button>
              {jobs.length > 0 && (
                <button className="crew-link-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setJobId(''); setSwitching(true); }}>
                  Moving to another job? Switch job
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="crew-card">
          <p style={{ fontWeight: 600, marginBottom: 12 }}>You are clocked out</p>
          {jobPicker}
          <button className="crew-big-btn" style={{ background: '#34C759' }} disabled={clockIn.isPending} onClick={() => clockIn.mutate()}>
            <LogIn size={22} strokeWidth={1.5} /> {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
          </button>
          {jobs.length === 0 && <p className="crew-muted" style={{ marginTop: 10 }}>You are not assigned to any jobs yet. You can still clock in for shop time.</p>}
        </div>
      )}

      {error && <p style={{ color: '#FF3B30', fontSize: 14, margin: '0 0 12px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="crew-card" style={{ marginBottom: 0 }}>
          <div className="crew-muted">Today</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{hrs(me?.today_hours)}</div>
        </div>
        <Link href="/crew/timecard" className="crew-card" style={{ marginBottom: 0, textDecoration: 'none', color: 'inherit' }}>
          <div className="crew-muted">This week</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{hrs(me?.week_hours)}</div>
        </Link>
      </div>
      <p className="crew-muted" style={{ marginTop: 10 }}>Totals count finished shifts. The shift you are on now is added when you clock out.</p>

      {jobs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Your jobs</h2>
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
    </div>
  );
}

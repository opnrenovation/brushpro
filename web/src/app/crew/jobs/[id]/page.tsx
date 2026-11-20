'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Navigation, Users, Camera, Send, LogIn, CalendarDays } from 'lucide-react';
import { crewApi } from '@/lib/crewApi';
import { downscaleImage } from '@/lib/image';
import { dayLabel, hrs, errText } from '@/components/crew/format';

interface Update {
  id: string;
  body: string;
  photo: string | null;
  created_at: string;
  employee: { id: string; first_name: string; last_name: string };
}

const when = (v: string) =>
  new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

export default function CrewJobPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['crew', 'job', id], queryFn: () => crewApi.job(id) });
  const { data: meData } = useQuery({ queryKey: ['crew', 'me'], queryFn: () => crewApi.me() });
  const job = data?.data?.data;
  const open = meData?.data?.data?.open_entry;

  const post = useMutation({
    mutationFn: () => crewApi.postUpdate(id, { body: note, photo: photo || undefined }),
    onSuccess: () => {
      setNote('');
      setPhoto(null);
      setError('');
      qc.invalidateQueries({ queryKey: ['crew', 'job', id] });
    },
    onError: (e) => setError(errText(e, 'Could not post. Check your connection.')),
  });
  const clockIn = useMutation({
    mutationFn: () => (open ? crewApi.switchJob({ job_id: id }) : crewApi.clockIn({ job_id: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew'] }),
    onError: (e) => setError(errText(e, 'Could not clock in.')),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await downscaleImage(file, 1280));
    } catch {
      setError('That photo could not be read.');
    }
  }

  if (isLoading) return <p className="crew-muted">Loading...</p>;
  if (isError || !job) return <p className="crew-muted">This job is not on your list.</p>;

  const fullAddress = [job.address, job.municipality].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
  const onThisJob = open?.job?.id === id;

  return (
    <div>
      <Link href="/crew/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#007AFF', textDecoration: 'none', fontSize: 14, marginBottom: 10 }}>
        <ArrowLeft size={16} strokeWidth={1.5} /> Jobs
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>{job.name}</h1>
      {job.customer?.name && <p className="crew-muted" style={{ marginBottom: 12 }}>For {job.customer.name}</p>}

      <div className="crew-card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <MapPin size={18} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>{fullAddress}</div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="crew-big-btn" style={{ background: '#007AFF', fontSize: 15, padding: 12, marginTop: 12, textDecoration: 'none' }}>
          <Navigation size={18} strokeWidth={1.5} /> Directions
        </a>
        {(job.start_date || job.end_date) && (
          <div className="crew-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <CalendarDays size={15} strokeWidth={1.5} />
            {job.start_date ? dayLabel(job.start_date, { weekday: 'short', month: 'short', day: 'numeric' }) : '?'}
            {job.end_date ? ` – ${dayLabel(job.end_date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
          </div>
        )}
      </div>

      {onThisJob ? (
        <div className="crew-card" style={{ color: '#1f8a3b', fontWeight: 600 }}>You are clocked in on this job</div>
      ) : (
        <button className="crew-big-btn" style={{ background: '#34C759', fontSize: 16, padding: 16, marginBottom: 12 }} disabled={clockIn.isPending}
          onClick={() => { if (!open || confirm('Clock out of your current job and into this one?')) clockIn.mutate(); }}>
          <LogIn size={18} strokeWidth={1.5} /> {open ? 'Switch to This Job' : 'Clock In Here'}
        </button>
      )}

      {job.crew_notes && (
        <div className="crew-card" style={{ background: 'rgba(232,168,56,0.10)', borderColor: 'rgba(232,168,56,0.4)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Instructions</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>{job.crew_notes}</div>
        </div>
      )}

      <div className="crew-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 8 }}>
          <Users size={16} strokeWidth={1.5} /> Crew
        </div>
        {job.crew.map((c: { id: string; first_name: string; last_name: string; position: string | null }) => (
          <div key={c.id} className="crew-row" style={{ padding: '4px 0' }}>
            <span>{c.first_name} {c.last_name}</span>
            <span className="crew-muted">{c.position || ''}</span>
          </div>
        ))}
        <div className="crew-muted" style={{ marginTop: 8 }}>Your hours on this job: {hrs(job.my_hours)}</div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 10px' }}>Job updates</h2>
      <div className="crew-card">
        <textarea className="crew-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="What got done? Anything the office should know?" style={{ resize: 'vertical', marginBottom: 10 }} />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
        {photo && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Photo to post" style={{ width: '100%', borderRadius: 12 }} />
            <button onClick={() => setPhoto(null)} className="crew-link-btn" style={{ color: '#FF3B30' }}>Remove photo</button>
          </div>
        )}
        {error && <p style={{ color: '#FF3B30', fontSize: 14, marginBottom: 10 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crew-big-btn" style={{ background: '#64748b', fontSize: 15, padding: 12, flex: 1 }} onClick={() => fileRef.current?.click()}>
            <Camera size={18} strokeWidth={1.5} /> Photo
          </button>
          <button className="crew-big-btn" style={{ background: '#1e40af', fontSize: 15, padding: 12, flex: 2 }}
            disabled={post.isPending || (!note.trim() && !photo)} onClick={() => post.mutate()}>
            <Send size={18} strokeWidth={1.5} /> {post.isPending ? 'Posting...' : 'Post Update'}
          </button>
        </div>
      </div>

      {(job.updates as Update[]).map((u) => (
        <div key={u.id} className="crew-card">
          <div className="crew-row" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{u.employee.first_name} {u.employee.last_name}</span>
            <span className="crew-muted">{when(u.created_at)}</span>
          </div>
          {u.body && <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>{u.body}</div>}
          {u.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.photo} alt="Job site photo" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
          )}
        </div>
      ))}
    </div>
  );
}

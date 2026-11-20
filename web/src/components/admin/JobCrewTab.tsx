'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Trash2 } from 'lucide-react';
import { jobCrewApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { hours, errMsg } from './ui';

interface Person { id: string; first_name: string; last_name: string; position: string | null; app_access: boolean }
interface Update { id: string; body: string; photo: string | null; created_at: string; employee: { first_name: string; last_name: string } }

const when = (v: string) =>
  new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

// "Crew" tab on the job page: who works this job, what the crew app shows
// them, their hours here, and the notes and photos they post from the site.
export default function JobCrewTab({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const isOwner = useAuthStore((s) => s.user?.role === 'OWNER');
  const { data, isLoading } = useQuery({ queryKey: ['job-crew', jobId], queryFn: () => jobCrewApi.get(jobId) });
  const crew = data?.data?.data;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!crew) return;
    setPicked(new Set((crew.assigned as Person[]).map((p) => p.id)));
    setNotes(crew.crew_notes || '');
    setDirty(false);
  }, [crew]);

  const save = useMutation({
    mutationFn: () => jobCrewApi.set(jobId, { employee_ids: [...picked], crew_notes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-crew', jobId] });
      setMsg('Saved');
      setTimeout(() => setMsg(''), 2000);
    },
    onError: (e) => setMsg(errMsg(e, 'Failed to save')),
  });
  const removeUpdate = useMutation({
    mutationFn: (id: string) => jobCrewApi.deleteUpdate(jobId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-crew', jobId] }),
  });

  if (isLoading || !crew) return <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>;

  const employees: Person[] = crew.employees;
  // Keep showing assigned people who are no longer active so they can be removed.
  const everyone = [...employees, ...(crew.assigned as Person[]).filter((a) => !employees.some((e) => e.id === a.id))];
  const hoursFor = (id: string) => crew.hours[id] || { approved: 0, pending: 0 };
  const toggle = (id: string) => {
    setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setDirty(true);
  };
  const updates: Update[] = crew.updates;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Users size={16} strokeWidth={1.5} color="#007AFF" />
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Assigned crew</span>
        </div>
        {everyone.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            No employees yet. {isOwner ? <Link href="/admin/employees" style={{ color: '#007AFF' }}>Add your crew</Link> : 'The owner can add employees.'}
          </p>
        )}
        {everyone.map((p) => {
          const h = hoursFor(p.id);
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: picked.has(p.id) ? 'rgba(0,122,255,0.06)' : 'transparent' }}>
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.first_name} {p.last_name}</span>
                {p.position && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}> · {p.position}</span>}
                {!p.app_access && picked.has(p.id) && <div style={{ fontSize: 11, color: '#b35f00' }}>Crew app is off for them</div>}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                {h.approved > 0 && <div>{hours(h.approved)} h</div>}
                {h.pending > 0 && <div style={{ color: '#b35f00' }}>{hours(h.pending)} h pending</div>}
              </span>
            </label>
          );
        })}

        <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: '16px 0 6px' }}>
          Instructions for the crew (shown in the crew app; never put prices here)
        </label>
        <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 110, resize: 'vertical' }}
          value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          placeholder={'Gate code, parking, colors and sheens, rooms in scope, homeowner preferences...'} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save Crew'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg === 'Saved' ? '#1f8a3b' : '#FF3B30' }}>{msg}</span>}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 10 }}>Updates from the site</div>
        {updates.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Notes and photos the crew posts from the crew app show up here.</p>}
        {updates.map((u) => (
          <div key={u.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{u.employee.first_name} {u.employee.last_name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{when(u.created_at)}</span>
                <button title="Delete update" onClick={() => { if (confirm('Delete this update?')) removeUpdate.mutate(u.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 2 }}>
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </span>
            </div>
            {u.body && <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', marginTop: 4, color: 'var(--text-primary)' }}>{u.body}</p>}
            {u.photo && (
              <a href={u.photo} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.photo} alt="Job site photo" style={{ width: '100%', maxWidth: 360, borderRadius: 8, marginTop: 6 }} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

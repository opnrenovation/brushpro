'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { employeesApi } from '@/lib/api';
import { errMsg } from './ui';

// Announcements to every crew phone (the News tab in the crew app).

interface Item { id: string; title: string; body: string; published_at: string; created_by: string | null; read_by: number; crew_count: number }

export default function CrewAnnouncements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['crew-news'], queryFn: () => employeesApi.announcements() });
  const items: Item[] = data?.data?.data || [];

  const post = useMutation({
    mutationFn: () => employeesApi.postAnnouncement({ title: title.trim(), body: body.trim() }),
    onSuccess: () => { setTitle(''); setBody(''); setErr(''); qc.invalidateQueries({ queryKey: ['crew-news'] }); },
    onError: (e) => setErr(errMsg(e, 'Failed to post.')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => employeesApi.deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crew-news'] }),
  });

  const field = { width: '100%', padding: '9px 12px', fontSize: 14 } as const;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, alignItems: 'start' }}>
      <div className="glass" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>New announcement</h3>
        <p className="tc-muted" style={{ marginBottom: 14 }}>Shows on every crew phone under News, with a badge until they open it.</p>
        <input className="glass-input" style={{ ...field, marginBottom: 10 }} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. No work Thursday: Thanksgiving" />
        <textarea className="glass-input" style={{ ...field, minHeight: 130, resize: 'vertical', marginBottom: 12 }} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="The message. Write it in English and Spanish if part of the crew reads Spanish." />
        {err && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 10 }}>{err}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={post.isPending || !title.trim() || !body.trim()} onClick={() => post.mutate()}>
          {post.isPending ? 'Posting...' : 'Post to the crew'}
        </button>
      </div>

      <div>
        {isLoading ? <p className="tc-muted">Loading...</p> : items.length === 0 ? (
          <div className="glass" style={{ padding: 32, textAlign: 'center' }}><span className="tc-muted">Nothing posted yet.</span></div>
        ) : items.map((n) => (
          <div key={n.id} className="glass" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="tc-muted">
                {new Date(n.published_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}
                {n.created_by ? ` · ${n.created_by}` : ''} · read by {n.read_by} of {n.crew_count}
              </span>
              <button title="Delete" onClick={() => { if (confirm('Delete this announcement? It disappears from every phone.')) remove.mutate(n.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: 4 }}>
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

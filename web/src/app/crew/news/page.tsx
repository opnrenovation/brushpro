'use client';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crewApi } from '@/lib/crewApi';
import { useT } from '@/components/crew/i18n';

interface Item { id: string; title: string; body: string; published_at: string; unread: boolean }

export default function CrewNewsPage() {
  const qc = useQueryClient();
  const { t, locale } = useT();
  const { data, isLoading } = useQuery({ queryKey: ['crew', 'news'], queryFn: () => crewApi.announcements() });
  const items: Item[] = data?.data?.data?.items || [];
  const unread: number = data?.data?.data?.unread || 0;

  // Opening the tab is the read receipt; the badge clears on the next load.
  useEffect(() => {
    if (unread > 0) {
      crewApi.markNewsRead().then(() => qc.invalidateQueries({ queryKey: ['crew', 'me'] })).catch(() => {});
    }
  }, [unread, qc]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>{t.news}</h1>
      {isLoading ? <p className="crew-muted">{t.loading}</p> : items.length === 0 ? (
        <div className="crew-card"><p className="crew-muted" style={{ textAlign: 'center' }}>{t.noNews}</p></div>
      ) : items.map((n) => (
        <div key={n.id} className="crew-card">
          <div className="crew-row" style={{ marginBottom: 4 }}>
            <span className="crew-muted">{new Date(n.published_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })}</span>
            {n.unread && <span className="crew-chip wait">{t.newTag}</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{n.title}</div>
          <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.body}</div>
        </div>
      ))}
    </div>
  );
}

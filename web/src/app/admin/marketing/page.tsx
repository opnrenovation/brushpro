'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Plus, Send, BarChart2 } from 'lucide-react';
import { campaignsApi, emailTemplatesApi } from '@/lib/api';

const STATUS_PILL: Record<string, string> = { DRAFT: 'pill-muted', SCHEDULED: 'pill-blue', SENDING: 'pill-orange', SENT: 'pill-green', CANCELLED: 'pill-muted' };

export default function MarketingPage() {
  const [tab, setTab] = useState<'campaigns' | 'templates'>('campaigns');
  const { data: campData } = useQuery({ queryKey: ['campaigns'], queryFn: () => campaignsApi.list() });
  const { data: tmplData } = useQuery({ queryKey: ['email-templates'], queryFn: () => emailTemplatesApi.list() });

  const campaigns = campData?.data?.data || campData?.data || [];
  const templates = tmplData?.data?.data || tmplData?.data || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={20} color="#007AFF" strokeWidth={1.5} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Marketing</h1>
        </div>
        <button className="btn btn-primary"><Plus size={16} strokeWidth={2} /> New Campaign</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {(['campaigns', 'templates'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', background: 'transparent', border: 'none', color: tab === t ? '#007AFF' : 'rgba(255,255,255,0.5)', borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`, marginBottom: -1 }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {campaigns.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No campaigns yet. Create your first campaign to reach your audience.</div>
            : <table className="data-table">
                <thead><tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Sent</th></tr></thead>
                <tbody>
                  {(campaigns as { id: string; name: string; subject: string; status: string; total_recipients: number; sent_at: string | null }[]).map((c) => (
                    <tr key={c.id}>
                      <td><div style={{ fontWeight: 500, color: '#fff' }}>{c.name}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.subject}</div></td>
                      <td><span className={`pill ${STATUS_PILL[c.status] || 'pill-muted'}`}>{c.status}</span></td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>{c.total_recipients}</td>
                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}

      {tab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {templates.length === 0 && <div className="glass" style={{ padding: 40, textAlign: 'center', gridColumn: '1/-1', color: 'rgba(255,255,255,0.4)' }}>No templates yet.</div>}
          {(templates as { id: string; name: string; subject: string; thumbnail_url: string | null; updated_at: string }[]).map((t) => (
            <div key={t.id} className="glass" style={{ padding: 20, cursor: 'pointer' }}>
              {t.thumbnail_url
                ? <img src={t.thumbnail_url} alt={t.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
                : <div style={{ width: '100%', height: 100, borderRadius: 8, background: 'rgba(255,255,255,0.05)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={28} color="rgba(255,255,255,0.2)" strokeWidth={1} />
                  </div>}
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t.subject}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Plus, BarChart2, TrendingUp, MousePointer, Eye, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { campaignsApi, emailTemplatesApi } from '@/lib/api';

const STATUS_PILL: Record<string, string> = {
  DRAFT: 'pill-muted',
  SCHEDULED: 'pill-blue',
  SENDING: 'pill-orange',
  SENT: 'pill-green',
  CANCELLED: 'pill-muted',
};

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_at: string | null;
  open_rate?: number;
  click_rate?: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  thumbnail_url: string | null;
  updated_at: string;
}

const ANALYTICS_PLACEHOLDER = [
  { name: 'Jan', opens: 65, clicks: 28 },
  { name: 'Feb', opens: 72, clicks: 31 },
  { name: 'Mar', opens: 80, clicks: 42 },
  { name: 'Apr', opens: 55, clicks: 22 },
  { name: 'May', opens: 90, clicks: 50 },
  { name: 'Jun', opens: 77, clicks: 38 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="glass" style={{ padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
};

const emptyCampaignForm = { name: '', subject: '', preview_text: '', html_body: '' };
const emptyTemplateForm = { name: '', subject: '', preview_text: '', html_body: '' };

export default function MarketingPage() {
  const [tab, setTab] = useState<'campaigns' | 'templates' | 'analytics'>('campaigns');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignForm, setCampaignForm] = useState(emptyCampaignForm);
  const [campaignError, setCampaignError] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [templateError, setTemplateError] = useState('');
  const qc = useQueryClient();

  const { data: campData } = useQuery({ queryKey: ['campaigns'], queryFn: () => campaignsApi.list() });
  const { data: tmplData } = useQuery({ queryKey: ['email-templates'], queryFn: () => emailTemplatesApi.list() });

  const campaigns: Campaign[] = campData?.data?.data || campData?.data || [];
  const templates: EmailTemplate[] = tmplData?.data?.data || tmplData?.data || [];

  const createCampaignMutation = useMutation({
    mutationFn: (f: typeof emptyCampaignForm) => campaignsApi.create({
      name: f.name, subject: f.subject,
      preview_text: f.preview_text || undefined,
      html_body: f.html_body || '<p>Campaign content goes here.</p>',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setShowCampaignModal(false);
      setCampaignForm(emptyCampaignForm);
      setCampaignError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCampaignError(msg || 'Failed to create campaign.');
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (f: typeof emptyTemplateForm) => emailTemplatesApi.create({
      name: f.name, subject: f.subject,
      preview_text: f.preview_text || undefined,
      html_body: f.html_body || '<p>Template content goes here.</p>',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      setShowTemplateModal(false);
      setTemplateForm(emptyTemplateForm);
      setTemplateError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setTemplateError(msg || 'Failed to create template.');
    },
  });

  function handleCampaignSubmit() {
    if (!campaignForm.name || !campaignForm.subject) {
      setCampaignError('Name and subject are required.');
      return;
    }
    setCampaignError('');
    createCampaignMutation.mutate(campaignForm);
  }

  function handleTemplateSubmit() {
    if (!templateForm.name || !templateForm.subject) {
      setTemplateError('Name and subject are required.');
      return;
    }
    setTemplateError('');
    createTemplateMutation.mutate(templateForm);
  }

  const totalSent = campaigns.filter((c) => c.status === 'SENT').length;
  const avgOpenRate =
    campaigns.filter((c) => c.open_rate != null).length > 0
      ? campaigns.reduce((s, c) => s + (c.open_rate || 0), 0) / campaigns.filter((c) => c.open_rate != null).length
      : 0;
  const avgClickRate =
    campaigns.filter((c) => c.click_rate != null).length > 0
      ? campaigns.reduce((s, c) => s + (c.click_rate || 0), 0) / campaigns.filter((c) => c.click_rate != null).length
      : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={20} color="#007AFF" strokeWidth={1.5} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Marketing</h1>
        </div>
        {tab === 'campaigns' && (
          <button className="btn btn-primary" onClick={() => { setShowCampaignModal(true); setCampaignError(''); }}>
            <Plus size={16} strokeWidth={1.5} /> New Campaign
          </button>
        )}
        {tab === 'templates' && (
          <button className="btn btn-primary" onClick={() => { setShowTemplateModal(true); setTemplateError(''); }}>
            <Plus size={16} strokeWidth={1.5} /> New Template
          </button>
        )}
      </div>

      {showCampaignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>New Campaign</h2>
              <button onClick={() => { setShowCampaignModal(false); setCampaignForm(emptyCampaignForm); setCampaignError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Campaign Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} placeholder="Spring Promo 2026" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Subject Line *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={campaignForm.subject} onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Get 10% off exterior painting this spring" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Preview Text</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={campaignForm.preview_text} onChange={(e) => setCampaignForm((f) => ({ ...f, preview_text: e.target.value }))} placeholder="Limited time offer for our valued customers..." />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>HTML Body</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, fontFamily: 'Menlo, monospace', minHeight: 120, resize: 'vertical' }} value={campaignForm.html_body} onChange={(e) => setCampaignForm((f) => ({ ...f, html_body: e.target.value }))} placeholder="<p>Your email content here...</p>" />
            </div>
            {campaignError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{campaignError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowCampaignModal(false); setCampaignForm(emptyCampaignForm); setCampaignError(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCampaignSubmit} disabled={createCampaignMutation.isPending}>
                {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>New Template</h2>
              <button onClick={() => { setShowTemplateModal(false); setTemplateForm(emptyTemplateForm); setTemplateError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Template Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Welcome Email" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Subject Line *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Welcome to OPN Renovation!" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Preview Text</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={templateForm.preview_text} onChange={(e) => setTemplateForm((f) => ({ ...f, preview_text: e.target.value }))} placeholder="Thanks for choosing us..." />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>HTML Body</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, fontFamily: 'Menlo, monospace', minHeight: 120, resize: 'vertical' }} value={templateForm.html_body} onChange={(e) => setTemplateForm((f) => ({ ...f, html_body: e.target.value }))} placeholder="<p>Your template content here...</p>" />
            </div>
            {templateError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{templateError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowTemplateModal(false); setTemplateForm(emptyTemplateForm); setTemplateError(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleTemplateSubmit} disabled={createTemplateMutation.isPending}>
                {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {(['campaigns', 'templates', 'analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: tab === t ? '#007AFF' : 'rgba(255,255,255,0.5)',
              borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* CAMPAIGNS TAB */}
      {tab === 'campaigns' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {campaigns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
              No campaigns yet. Create your first campaign to reach your audience.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Open Rate</th>
                  <th>Click Rate</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: '#fff' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.subject}</div>
                    </td>
                    <td><span className={`pill ${STATUS_PILL[c.status] || 'pill-muted'}`}>{c.status}</span></td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{c.total_recipients}</td>
                    <td style={{ color: '#34C759', fontFamily: 'Menlo, monospace', fontSize: 13 }}>
                      {c.open_rate != null ? `${c.open_rate.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ color: '#007AFF', fontFamily: 'Menlo, monospace', fontSize: 13 }}>
                      {c.click_rate != null ? `${c.click_rate.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {templates.length === 0 && (
            <div className="glass" style={{ padding: 40, textAlign: 'center', gridColumn: '1/-1', color: 'rgba(255,255,255,0.4)' }}>
              No templates yet. Create an email template to use in campaigns.
            </div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="glass" style={{ padding: 20, cursor: 'pointer' }}>
              {t.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.thumbnail_url}
                  alt={t.name}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 100,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Mail size={28} color="rgba(255,255,255,0.2)" strokeWidth={1} />
                </div>
              )}
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t.subject}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                Updated {new Date(t.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
            {[
              { icon: <Mail size={20} strokeWidth={1.5} />, label: 'Campaigns Sent', value: String(totalSent), color: '#007AFF' },
              { icon: <Eye size={20} strokeWidth={1.5} />, label: 'Avg Open Rate', value: `${avgOpenRate.toFixed(1)}%`, color: '#34C759' },
              { icon: <MousePointer size={20} strokeWidth={1.5} />, label: 'Avg Click Rate', value: `${avgClickRate.toFixed(1)}%`, color: '#E8A838' },
              { icon: <TrendingUp size={20} strokeWidth={1.5} />, label: 'Total Contacts', value: String(campaigns.reduce((s, c) => s + c.total_recipients, 0)), color: '#5856D6' },
            ].map((stat) => (
              <div key={stat.label} className="glass" style={{ flex: 1, padding: '20px 24px' }}>
                <div style={{ color: stat.color, marginBottom: 12 }}>{stat.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color, fontFamily: 'Menlo, monospace', marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <BarChart2 size={18} strokeWidth={1.5} style={{ color: '#007AFF' }} />
              <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Email Performance (Last 6 Months)</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ANALYTICS_PLACEHOLDER} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="opens" name="Open Rate" fill="#34C759" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="Click Rate" fill="#007AFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 12 }}>
              {[{ color: '#34C759', label: 'Open Rate' }, { color: '#007AFF', label: 'Click Rate' }].map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Search, X } from 'lucide-react';
import { leadsApi, contactsApi } from '@/lib/api';

const STAGES = ['NEW', 'CONTACTED', 'APPOINTMENT', 'ESTIMATE_SENT', 'NEGOTIATING', 'WON', 'LOST'];

const STAGE_COLORS: Record<string, string> = {
  NEW: '#007AFF', CONTACTED: '#FF9500', APPOINTMENT: '#5856D6',
  ESTIMATE_SENT: '#007AFF', NEGOTIATING: '#FF9500', WON: '#34C759', LOST: '#FF3B30',
};

interface Lead {
  id: string;
  stage: string;
  source: string;
  service_needed: string | null;
  created_at: string;
  updated_at: string;
  contact: { first_name: string; last_name: string; email: string; phone: string | null };
  estimate: { estimate_number: string; status: string } | null;
}

function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

const FALLBACK: Lead[] = [
  { id: '1', stage: 'NEW', source: 'WEBSITE_FORM', service_needed: 'Residential Painting', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), contact: { first_name: 'Sarah', last_name: 'Mitchell', email: 'sarah@example.com', phone: '(515) 555-0101' }, estimate: null },
  { id: '2', stage: 'APPOINTMENT', source: 'REFERRAL', service_needed: 'Interior Painting', created_at: new Date(Date.now() - 86400000 * 2).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), contact: { first_name: 'Daniel', last_name: 'Park', email: 'dpark@example.com', phone: '(515) 555-0202' }, estimate: null },
  { id: '3', stage: 'ESTIMATE_SENT', source: 'MANUAL', service_needed: 'Cabinet Painting', created_at: new Date(Date.now() - 86400000 * 5).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), contact: { first_name: 'Kim', last_name: 'Nguyen', email: 'kim@example.com', phone: null }, estimate: { estimate_number: 'EST-0041', status: 'SENT' } },
  { id: '4', stage: 'WON', source: 'WEBSITE_FORM', service_needed: 'Exterior Painting', created_at: new Date(Date.now() - 86400000 * 10).toISOString(), updated_at: new Date(Date.now() - 86400000 * 3).toISOString(), contact: { first_name: 'Tom', last_name: 'Eriksen', email: 'tom@example.com', phone: '(515) 555-0404' }, estimate: { estimate_number: 'EST-0039', status: 'APPROVED' } },
];

const SERVICES = ['Residential Painting', 'Commercial Painting', 'Interior Painting', 'Exterior Painting', 'Cabinet Painting', 'Deck Staining', 'Accent Walls', 'Color Consultation'];
const SOURCES = ['MANUAL', 'WEBSITE_FORM', 'REFERRAL', 'GOOGLE', 'FACEBOOK', 'INSTAGRAM', 'YELP', 'OTHER'];

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', service_needed: '', source: 'MANUAL', project_address: '', notes: '' };

export default function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsApi.list(),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => leadsApi.update(id, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      const contact = await contactsApi.create({
        first_name: f.first_name, last_name: f.last_name,
        email: f.email, phone: f.phone || undefined, type: 'PROSPECT',
      });
      const contactId = contact.data?.id || contact.data?.data?.id;
      return leadsApi.create({
        contact_id: contactId,
        source: f.source,
        service_needed: f.service_needed || undefined,
        project_address: f.project_address || undefined,
        notes: f.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowModal(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to create lead. Please try again.');
    },
  });

  function handleSubmit() {
    if (!form.first_name || !form.last_name || !form.email) {
      setFormError('First name, last name, and email are required.');
      return;
    }
    setFormError('');
    createMutation.mutate(form);
  }

  const leads: Lead[] = data?.data?.data || data?.data || FALLBACK;
  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${l.contact.first_name} ${l.contact.last_name}`.toLowerCase().includes(q) ||
      l.service_needed?.toLowerCase().includes(q) || l.contact.email.toLowerCase().includes(q);
  });

  const total = leads.length;
  const won = leads.filter((l) => l.stage === 'WON').length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Target size={20} color="#007AFF" strokeWidth={1.5} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Lead Pipeline</h1>
          </div>
          <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
            {total} leads · {winRate}% win rate
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); }}><Plus size={16} strokeWidth={2} /> New Lead</button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>New Lead</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13, marginBottom: 20 }}>Contact details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>First Name *</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Alex" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Last Name *</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Johnson" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Email *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="alex@example.com" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Phone</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(515) 555-0100" />
            </div>

            <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13, marginBottom: 12 }}>Lead details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Service</label>
                <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.service_needed} onChange={(e) => setForm((f) => ({ ...f, service_needed: e.target.value }))}>
                  <option value="">Select service...</option>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Source</label>
                <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Project Address</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.project_address} onChange={(e) => setForm((f) => ({ ...f, project_address: e.target.value }))} placeholder="123 Main St, Des Moines, IA" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
            </div>

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="glass-input"
            style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: 3 }}>
          {(['kanban', 'list'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className="btn"
              style={{ padding: '6px 14px', fontSize: 13,
                background: view === v ? 'rgba(0,122,255,0.15)' : 'transparent',
                color: view === v ? '#007AFF' : 'rgba(0,0,0,0.5)',
              }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {STAGES.filter((s) => s !== 'LOST').map((stage) => {
            const col = filtered.filter((l) => l.stage === stage);
            const color = STAGE_COLORS[stage];
            return (
              <div key={stage} style={{ minWidth: 240, maxWidth: 280, flex: '0 0 240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', background: 'rgba(0,0,0,0.08)', padding: '1px 7px', borderRadius: 6 }}>
                    {col.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.map((lead) => (
                    <Link key={lead.id} href={`/admin/leads/${lead.id}`} style={{ textDecoration: 'none' }}>
                      <div className="glass" style={{ padding: '14px', cursor: 'pointer', transition: 'background 0.15s' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                          {lead.contact.first_name} {lead.contact.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 10 }}>
                          {lead.service_needed || 'General'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.08)', borderRadius: 6, padding: '2px 7px', color: 'rgba(0,0,0,0.5)' }}>
                            {lead.source.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
                            {daysSince(lead.updated_at)}d
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {col.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(0,0,0,0.2)', fontSize: 13 }}>Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Contact</th><th>Service</th><th>Stage</th><th>Source</th><th>Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/admin/leads/${lead.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {lead.contact.first_name} {lead.contact.last_name}
                    </Link>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{lead.contact.email}</div>
                  </td>
                  <td style={{ color: 'rgba(0,0,0,0.7)' }}>{lead.service_needed || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STAGE_COLORS[lead.stage], background: STAGE_COLORS[lead.stage] + '20', padding: '3px 9px', borderRadius: 20 }}>
                      {lead.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{lead.source.replace(/_/g, ' ')}</td>
                  <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>{daysSince(lead.updated_at)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

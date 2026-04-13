'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Search, Plus, X } from 'lucide-react';
import { jobsApi, customersApi, contactsApi } from '@/lib/api';

const STATUSES = ['ALL', 'ESTIMATING', 'ACTIVE', 'INVOICED', 'COMPLETE', 'CANCELLED'];
const STATUS_PILL: Record<string, string> = {
  ESTIMATING: 'pill-blue', ACTIVE: 'pill-green', INVOICED: 'pill-orange',
  COMPLETE: 'pill-muted', CANCELLED: 'pill-muted',
};

interface Job { id: string; name: string; address: string; status: string; municipality: string; customer?: { name: string }; created_at: string; }
interface Contact { id: string; first_name: string; last_name: string; email?: string; phone?: string; address?: string; }
interface CustomerRecord { id: string; contact_id?: string; name: string; }

const FALLBACK: Job[] = [
  { id: '1', name: 'Henderson Exterior', address: '142 Maple Ave', status: 'ACTIVE', municipality: 'Des Moines', customer: { name: 'Mark Henderson' }, created_at: new Date().toISOString() },
  { id: '2', name: 'Downtown Office Suite', address: '800 Commerce Blvd', status: 'ESTIMATING', municipality: 'Des Moines', customer: { name: 'Apex Realty' }, created_at: new Date().toISOString() },
  { id: '3', name: 'Garcia Residence Interior', address: '55 Birchwood Ct', status: 'COMPLETE', municipality: 'Ankeny', customer: { name: 'Elena Garcia' }, created_at: new Date().toISOString() },
];

const emptyForm = { contact_id: '', name: '', address: '', municipality: '', labor_rate: '', start_date: '', notes: '' };

export default function JobsPage() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list() });
  const { data: contactsData } = useQuery({ queryKey: ['contacts', 'all'], queryFn: () => contactsApi.list({ limit: '500' }) });
  const { data: customersData } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list({ limit: '500' }) });
  const jobs: Job[] = data?.data?.data || data?.data || FALLBACK;
  const contacts: Contact[] = contactsData?.data?.data || contactsData?.data || [];
  const existingCustomers: CustomerRecord[] = customersData?.data?.data || customersData?.data || [];
  // Map contact_id → customer id for contacts that are already customers
  const contactToCustomerId = new Map(existingCustomers.filter(c => c.contact_id).map(c => [c.contact_id!, c.id]));

  const createMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      // Resolve contact → customer (create customer record if needed)
      let customerId = contactToCustomerId.get(f.contact_id);
      if (!customerId) {
        const contact = contacts.find(c => c.id === f.contact_id);
        if (!contact) throw new Error('Contact not found');
        const res = await customersApi.create({
          contact_id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`.trim(),
          email: contact.email,
          phone: contact.phone,
          address: contact.address || '',
        });
        customerId = (res.data?.data || res.data)?.id;
      }
      return jobsApi.create({
        customer_id: customerId,
        name: f.name,
        address: f.address,
        municipality: f.municipality,
        labor_rate: parseFloat(f.labor_rate),
        start_date: f.start_date || undefined,
        notes: f.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      setShowModal(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to create job. Please try again.');
    },
  });

  function handleSubmit() {
    if (!form.contact_id || !form.name || !form.address || !form.municipality || !form.labor_rate) {
      setFormError('Customer, job name, address, municipality, and labor rate are required.');
      return;
    }
    if (isNaN(parseFloat(form.labor_rate)) || parseFloat(form.labor_rate) <= 0) {
      setFormError('Labor rate must be a positive number.');
      return;
    }
    setFormError('');
    createMutation.mutate(form);
  }

  const filtered = jobs.filter((j) => {
    const matchStatus = status === 'ALL' || j.status === status;
    const q = search.toLowerCase();
    const matchSearch = !q || j.name.toLowerCase().includes(q) || j.address.toLowerCase().includes(q) || j.customer?.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={20} color="#007AFF" strokeWidth={1.5} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Jobs</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); }}><Plus size={16} strokeWidth={2} /> New Job</button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>New Job</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Customer *</label>
              <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.contact_id} onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}>
                <option value="">Select contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.first_name} ${c.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Job Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Henderson Exterior" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Address *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Municipality *</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.municipality} onChange={(e) => setForm((f) => ({ ...f, municipality: e.target.value }))} placeholder="Des Moines" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Labor Rate ($/hr) *</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="number" min="0" step="0.01" value={form.labor_rate} onChange={(e) => setForm((f) => ({ ...f, labor_rate: e.target.value }))} placeholder="65.00" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Start Date</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
            </div>

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.12)',
              background: status === s ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.05)',
              color: status === s ? '#007AFF' : 'rgba(0,0,0,0.5)',
            }}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
        <Search size={15} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." className="glass-input"
          style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }} />
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Job</th><th>Customer</th><th>Address</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id}>
                <td><Link href={`/admin/jobs/${j.id}`} style={{ color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>{j.name}</Link></td>
                <td style={{ color: 'rgba(0,0,0,0.6)' }}>{j.customer?.name || '—'}</td>
                <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{j.address}, {j.municipality}</td>
                <td><span className={`pill ${STATUS_PILL[j.status] || 'pill-muted'}`}>{j.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

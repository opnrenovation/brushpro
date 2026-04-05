'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Search, Plus, X } from 'lucide-react';
import { vendorsApi } from '@/lib/api';

const CATEGORIES = ['ALL', 'PAINT_SUPPLIER', 'EQUIPMENT', 'SUBCONTRACTOR', 'MATERIALS', 'OTHER'];
const CATEGORY_LABELS: Record<string, string> = {
  PAINT_SUPPLIER: 'Paint Supplier', EQUIPMENT: 'Equipment',
  SUBCONTRACTOR: 'Subcontractor', MATERIALS: 'Materials', OTHER: 'Other',
};

interface Vendor {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

const emptyForm = { name: '', category: 'OTHER', contact_name: '', email: '', phone: '', address: '', notes: '' };

export default function VendorsPage() {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['vendors'], queryFn: () => vendorsApi.list() });
  const vendors: Vendor[] = data?.data?.data || data?.data || [];

  const createMutation = useMutation({
    mutationFn: (f: typeof emptyForm) => vendorsApi.create({
      name: f.name,
      category: f.category,
      contact_name: f.contact_name || undefined,
      email: f.email || undefined,
      phone: f.phone || undefined,
      address: f.address || undefined,
      notes: f.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setShowModal(false);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to create vendor. Please try again.');
    },
  });

  function handleSubmit() {
    if (!form.name) {
      setFormError('Vendor name is required.');
      return;
    }
    setFormError('');
    createMutation.mutate(form);
  }

  const filtered = vendors.filter((v) => {
    const matchCat = categoryFilter === 'ALL' || v.category === categoryFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) ||
      v.contact_name?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={20} color="#007AFF" strokeWidth={1.5} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Vendors</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); }}>
          <Plus size={16} strokeWidth={1.5} /> New Vendor
        </button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 480, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>New Vendor</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Vendor Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sherwin-Williams" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Category</label>
              <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter((c) => c !== 'ALL').map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Contact Name</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Email</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Phone</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(515) 555-0100" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Address</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St, Des Moines, IA" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Notes</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Account numbers, terms, etc." />
            </div>

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} strokeWidth={1.5} color="rgba(255,255,255,0.3)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..."
            className="glass-input" style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.12)',
                background: categoryFilter === c ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)',
                color: categoryFilter === c ? '#007AFF' : 'rgba(255,255,255,0.5)',
              }}>
              {c === 'ALL' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Vendor</th><th>Category</th><th>Contact</th><th>Email</th><th>Phone</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>No vendors found</td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id}>
                <td style={{ fontWeight: 500, color: '#fff' }}>{v.name}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(0,122,255,0.12)', color: '#007AFF', padding: '3px 9px', borderRadius: 20 }}>
                    {CATEGORY_LABELS[v.category] || v.category}
                  </span>
                </td>
                <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{v.contact_name || '—'}</td>
                <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{v.email || '—'}</td>
                <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{v.phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

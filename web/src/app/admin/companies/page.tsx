'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, Plus, X, Users } from 'lucide-react';
import { companiesApi } from '@/lib/api';

interface Contact { id: string; first_name: string; last_name: string; email?: string; phone?: string; }
interface Company { id: string; name: string; phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string; notes?: string; contacts: Contact[]; }

const emptyForm = { name: '', phone: '', email: '', address: '', city: '', state: '', zip: '', notes: '' };

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['companies', search],
    queryFn: () => companiesApi.list(search ? { search } : {}),
  });

  const companies: Company[] = data?.data?.data || data?.data || [];

  const saveMutation = useMutation({
    mutationFn: (f: typeof emptyForm) =>
      editCompany ? companiesApi.update(editCompany.id, f) : companiesApi.create(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      closeModal();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to save company.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  function openNew() {
    setEditCompany(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(c: Company) {
    setEditCompany(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', city: c.city || '', state: c.state || '', zip: c.zip || '', notes: c.notes || '' });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditCompany(null);
    setForm(emptyForm);
    setFormError('');
  }

  function handleSubmit() {
    if (!form.name.trim()) { setFormError('Company name is required.'); return; }
    setFormError('');
    saveMutation.mutate(form);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={20} color="#007AFF" strokeWidth={1.5} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Companies</h1>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} strokeWidth={2} /> New Company</button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 20 }}>
        <Search size={15} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies..."
          className="glass-input" style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }} />
      </div>

      {/* Table */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Location</th>
              <th>Contacts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 40 }}>No companies yet.</td></tr>
            )}
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, padding: 0, textAlign: 'left' }}>
                    {c.name}
                  </button>
                </td>
                <td style={{ color: 'rgba(0,0,0,0.55)', fontSize: 13 }}>{c.phone || '—'}</td>
                <td style={{ color: 'rgba(0,0,0,0.55)', fontSize: 13 }}>{c.email || '—'}</td>
                <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>
                  {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td>
                  {c.contacts.length > 0 ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#007AFF', fontSize: 13 }}>
                      <Users size={13} strokeWidth={1.5} />{c.contacts.length}
                    </span>
                  ) : <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>—</span>}
                </td>
                <td>
                  <button onClick={() => { if (confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 4 }}>
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>{editCompany ? 'Edit Company' : 'New Company'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Company Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Phone</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(515) 000-0000" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Email</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@company.com" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Address</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>City</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Des Moines" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>State</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} placeholder="IA" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Zip</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.zip} onChange={(e) => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="50309" />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
            </div>

            {/* Linked contacts (edit mode) */}
            {editCompany && editCompany.contacts.length > 0 && (
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Linked Contacts</div>
                {editCompany.contacts.map(ct => (
                  <div key={ct.id} style={{ fontSize: 13, color: 'var(--text-primary)', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {ct.first_name} {ct.last_name} {ct.email ? `· ${ct.email}` : ''}
                  </div>
                ))}
              </div>
            )}

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editCompany ? 'Save Changes' : 'Create Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

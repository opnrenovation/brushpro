'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Users, Search, Plus, CheckCircle, XCircle, Upload, X, MoreHorizontal, Pencil, Trash2, Briefcase } from 'lucide-react';
import { contactsApi } from '@/lib/api';

const TYPES = ['ALL', 'PROSPECT', 'CUSTOMER', 'BOTH'];
const SOURCES = ['MANUAL', 'WEBSITE_FORM', 'REFERRAL', 'GOOGLE', 'FACEBOOK', 'INSTAGRAM', 'YELP', 'OTHER'];
const emptyForm = {
  first_name: '', last_name: '', company: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '',
  type: 'PROSPECT', source: '', subscribed: false,
};

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  company_rel?: { id: string; name: string } | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  type: string;
  tags: string[];
  subscribed: boolean;
  source: string | null;
  created_at: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'contacts' | 'lists' | 'import'>('contacts');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [listsNotice, setListsNotice] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.list() });
  const contacts: Contact[] = data?.data?.data || data?.data || [];

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (f: typeof emptyForm) =>
      editContact
        ? contactsApi.update(editContact.id, f)
        : contactsApi.create({ ...f, company: f.company || undefined, phone: f.phone || undefined, source: f.source || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      closeModal();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to save contact. Please try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  function openNew() {
    setEditContact(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(c: Contact) {
    setEditContact(c);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name,
      company: c.company || '',
      email: c.email,
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      zip: c.zip || '',
      type: c.type,
      source: c.source || '',
      subscribed: c.subscribed,
    });
    setFormError('');
    setShowModal(true);
    setOpenMenu(null);
  }

  function closeModal() {
    setShowModal(false);
    setEditContact(null);
    setForm(emptyForm);
    setFormError('');
  }

  function handleSubmit() {
    if (!form.first_name || !form.last_name || !form.email) {
      setFormError('First name, last name, and email are required.');
      return;
    }
    setFormError('');
    saveMutation.mutate(form);
  }

  function handleDelete(c: Contact) {
    setOpenMenu(null);
    if (confirm(`Delete ${c.first_name} ${c.last_name}? This cannot be undone.`)) {
      deleteMutation.mutate(c.id);
    }
  }

  function handleNewJob(c: Contact) {
    setOpenMenu(null);
    const params = new URLSearchParams({
      new: '1',
      contact_id: c.id,
      contact_name: `${c.first_name} ${c.last_name}`,
      address: c.address || '',
      city: c.city || '',
    });
    router.push(`/admin/jobs?${params.toString()}`);
  }

  const filtered = contacts.filter((c) => {
    const matchType = typeFilter === 'ALL' || c.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const subscribed = contacts.filter((c) => c.subscribed).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Users size={20} color="#007AFF" strokeWidth={1.5} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Contacts</h1>
          </div>
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>
            {contacts.length} total &middot; {subscribed} subscribed
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} strokeWidth={1.5} /> New Contact
        </button>
      </div>

      {/* Modal — create or edit */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 520, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>
                {editContact ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

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
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Company</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Email *</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="alex@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Phone</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(515) 555-0100" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Address</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>City</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Des Moines" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>State</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="IA" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Zip</label>
                <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} placeholder="50309" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Type</label>
                <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="PROSPECT">Prospect</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Source</label>
                <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">Select source...</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.subscribed} onChange={(e) => setForm((f) => ({ ...f, subscribed: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#007AFF' }} />
              <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.7)' }}>Subscribe to email marketing</span>
            </label>

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editContact ? 'Save Changes' : 'Create Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {(['contacts', 'lists', 'import'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px', fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer', background: 'transparent', border: 'none',
              color: tab === t ? '#007AFF' : 'rgba(0,0,0,0.5)',
              borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ALL CONTACTS TAB */}
      {tab === 'contacts' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search size={15} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..."
                className="glass-input" style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TYPES.map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: typeFilter === t ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.05)',
                    color: typeFilter === t ? '#007AFF' : 'rgba(0,0,0,0.5)',
                  }}
                >
                  {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="glass" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Type</th><th>Subscribed</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.3)', padding: 40 }}>No contacts found</td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</td>
                    <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{c.company_rel?.name || c.company || '—'}</td>
                    <td style={{ color: 'rgba(0,0,0,0.6)', fontSize: 13 }}>{c.email}</td>
                    <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{c.phone || '—'}</td>
                    <td><span className="pill pill-blue" style={{ fontSize: 10 }}>{c.type}</span></td>
                    <td>
                      {c.subscribed
                        ? <CheckCircle size={15} color="#34C759" strokeWidth={1.5} />
                        : <XCircle size={15} color="rgba(0,0,0,0.2)" strokeWidth={1.5} />}
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                      >
                        <MoreHorizontal size={16} strokeWidth={1.5} />
                      </button>
                      {openMenu === c.id && (
                        <div ref={menuRef} style={{
                          position: 'absolute', right: 8, top: '100%', zIndex: 50,
                          background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden',
                        }}>
                          <button onClick={() => openEdit(c)} style={menuItemStyle}>
                            <Pencil size={14} strokeWidth={1.5} /> Edit
                          </button>
                          <button onClick={() => handleNewJob(c)} style={menuItemStyle}>
                            <Briefcase size={14} strokeWidth={1.5} /> New Job
                          </button>
                          <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />
                          <button onClick={() => handleDelete(c)} style={{ ...menuItemStyle, color: '#FF3B30' }}>
                            <Trash2 size={14} strokeWidth={1.5} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LISTS TAB */}
      {tab === 'lists' && (
        <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
          <Users size={36} strokeWidth={1} style={{ color: 'rgba(0,0,0,0.15)', marginBottom: 16 }} />
          <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: 8 }}>Contact lists appear here.</p>
          <p style={{ color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>Create lists to segment your contacts for targeted email campaigns.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setListsNotice(true)}>
            <Plus size={15} strokeWidth={1.5} /> Create List
          </button>
          {listsNotice && <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13, marginTop: 12 }}>Contact lists are coming in a future update.</p>}
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === 'import' && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
            style={{
              border: `2px dashed ${dragOver ? '#007AFF' : 'rgba(0,0,0,0.15)'}`,
              borderRadius: 16, padding: '64px 40px', textAlign: 'center',
              background: dragOver ? 'rgba(0,122,255,0.05)' : 'rgba(0,0,0,0.02)',
              transition: 'all 0.2s', marginBottom: 24,
            }}
          >
            <Upload size={40} strokeWidth={1} style={{ color: 'rgba(0,0,0,0.2)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Drop a CSV file here</p>
            <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14, marginBottom: 24 }}>or click to browse. Required columns: first_name, last_name, email</p>
            <label style={{ cursor: 'pointer' }}>
              <div className="btn btn-ghost" style={{ display: 'inline-flex' }}>
                <Upload size={15} strokeWidth={1.5} /> Choose CSV File
              </div>
              <input type="file" accept=".csv" style={{ display: 'none' }} />
            </label>
          </div>
          <div className="glass" style={{ padding: '20px 24px' }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>CSV Format Guide</h3>
            <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13, lineHeight: 1.7 }}>The CSV file should have a header row with these columns (in any order):</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {['first_name *', 'last_name *', 'email *', 'phone', 'tags', 'source'].map((col) => (
                <span key={col} style={{
                  fontSize: 12,
                  background: col.includes('*') ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.07)',
                  border: col.includes('*') ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(0,0,0,0.1)',
                  color: col.includes('*') ? '#007AFF' : 'rgba(0,0,0,0.5)',
                  padding: '4px 10px', borderRadius: 6, fontFamily: 'Menlo, monospace',
                }}>{col}</span>
              ))}
            </div>
            <p style={{ color: 'rgba(0,0,0,0.3)', fontSize: 12, marginTop: 10 }}>* Required fields</p>
          </div>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '9px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
};

'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Search, Plus, X, Building2, User } from 'lucide-react';
import { jobsApi, customersApi, contactsApi, companiesApi } from '@/lib/api';

const STATUSES = ['ALL', 'ESTIMATING', 'ACTIVE', 'INVOICED', 'COMPLETE', 'CANCELLED'];
const STATUS_PILL: Record<string, string> = {
  ESTIMATING: 'pill-blue', ACTIVE: 'pill-green', INVOICED: 'pill-orange',
  COMPLETE: 'pill-muted', CANCELLED: 'pill-muted',
};

interface Job { id: string; name: string; address: string; status: string; municipality: string; customer?: { name: string }; created_at: string; }
interface Contact { id: string; first_name: string; last_name: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zip?: string; company?: string; }
interface Company { id: string; name: string; phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string; }
interface CustomerRecord { id: string; contact_id?: string; name: string; }

type SearchResult = { kind: 'contact'; data: Contact } | { kind: 'company'; data: Company };

const emptyForm = { contact_id: '', company_id: '', selected_label: '', name: '', address: '', municipality: '', tax_exempt: false, notes: '' };

function JobsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list() });
  const { data: contactsData } = useQuery({ queryKey: ['contacts', 'all'], queryFn: () => contactsApi.list({ limit: '500' }) });
  const { data: companiesData } = useQuery({ queryKey: ['companies', 'all'], queryFn: () => companiesApi.list({ limit: '500' }) });
  const { data: customersData } = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list({ limit: '500' }) });

  const jobs: Job[] = data?.data?.data || data?.data || [];
  const contacts: Contact[] = contactsData?.data?.data || contactsData?.data || [];
  const companies: Company[] = companiesData?.data?.data || companiesData?.data || [];
  const existingCustomers: CustomerRecord[] = customersData?.data?.data || customersData?.data || [];
  const contactToCustomerId = new Map(existingCustomers.filter(c => c.contact_id).map(c => [c.contact_id!, c.id]));

  // Filter contacts + companies by search query
  const searchResults: SearchResult[] = customerQuery.trim().length < 1 ? [] : [
    ...contacts
      .filter(c => `${c.first_name} ${c.last_name} ${c.company || ''}`.toLowerCase().includes(customerQuery.toLowerCase()))
      .slice(0, 6)
      .map(c => ({ kind: 'contact' as const, data: c })),
    ...companies
      .filter(c => c.name.toLowerCase().includes(customerQuery.toLowerCase()))
      .slice(0, 6)
      .map(c => ({ kind: 'company' as const, data: c })),
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-open modal when navigated from Contacts with ?new=1&contact_id=...
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const contactId = searchParams.get('contact_id');
    const contactName = searchParams.get('contact_name') || '';
    const address = searchParams.get('address') || '';
    const city = searchParams.get('city') || '';
    if (contactId) {
      setForm(f => ({ ...f, contact_id: contactId, selected_label: contactName, address, municipality: city }));
      setShowModal(true);
      // Clean up URL params
      router.replace('/admin/jobs');
    }
  }, [searchParams, router]);

  function selectResult(result: SearchResult) {
    if (result.kind === 'contact') {
      const c = result.data;
      setForm(f => ({
        ...f,
        contact_id: c.id,
        company_id: '',
        selected_label: `${c.first_name} ${c.last_name}`.trim(),
        address: c.address || f.address,
        municipality: c.city || f.municipality,
      }));
    } else {
      const c = result.data;
      setForm(f => ({
        ...f,
        contact_id: '',
        company_id: c.id,
        selected_label: c.name,
        address: c.address || f.address,
        municipality: c.city || f.municipality,
      }));
    }
    setCustomerQuery('');
    setShowDropdown(false);
  }

  function clearSelection() {
    setForm(f => ({ ...f, contact_id: '', company_id: '', selected_label: '', address: '', municipality: '' }));
    setCustomerQuery('');
  }

  const createMutation = useMutation({
    mutationFn: async (f: typeof emptyForm) => {
      let customerId: string | undefined;

      if (f.contact_id) {
        // Resolve contact → customer
        customerId = contactToCustomerId.get(f.contact_id);
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
      } else if (f.company_id) {
        // Resolve company → customer (find or create via company contact)
        const company = companies.find(c => c.id === f.company_id);
        if (!company) throw new Error('Company not found');
        // Check if there's already a customer for this company name
        const existingCust = existingCustomers.find(c => c.name === company.name);
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const res = await customersApi.create({
            name: company.name,
            phone: company.phone,
            address: company.address || '',
          });
          customerId = (res.data?.data || res.data)?.id;
        }
      }

      if (!customerId) throw new Error('Could not resolve customer');

      return jobsApi.create({
        customer_id: customerId,
        name: f.name,
        address: f.address,
        municipality: f.municipality,
        tax_exempt: f.tax_exempt,
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
    if (!form.contact_id && !form.company_id) {
      setFormError('Please select a contact or company.');
      return;
    }
    if (!form.name || !form.address || !form.municipality) {
      setFormError('Job name, address, and municipality are required.');
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
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormError(''); setForm(emptyForm); setCustomerQuery(''); }}><Plus size={16} strokeWidth={2} /> New Job</button>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 520, padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>New Job</h2>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); setCustomerQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Customer search */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Customer *</label>

              {form.selected_label ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.25)', borderRadius: 8 }}>
                  {form.company_id
                    ? <Building2 size={15} color="#007AFF" strokeWidth={1.5} />
                    : <User size={15} color="#007AFF" strokeWidth={1.5} />}
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{form.selected_label}</span>
                  <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: 0 }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div ref={searchRef} style={{ position: 'relative' }}>
                  <Search size={14} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    className="glass-input"
                    style={{ width: '100%', padding: '9px 12px 9px 34px', fontSize: 14 }}
                    placeholder="Search contacts or companies..."
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, marginTop: 4, overflow: 'hidden' }}>
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onMouseDown={() => selectResult(r)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: i < searchResults.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {r.kind === 'company'
                            ? <Building2 size={14} color="#007AFF" strokeWidth={1.5} />
                            : <User size={14} color="rgba(0,0,0,0.4)" strokeWidth={1.5} />}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                              {r.kind === 'contact' ? `${r.data.first_name} ${r.data.last_name}` : r.data.name}
                            </div>
                            {r.kind === 'contact' && r.data.company && (
                              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>{r.data.company}</div>
                            )}
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(0,0,0,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {r.kind}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && customerQuery.length > 0 && searchResults.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, marginTop: 4, padding: '12px 14px', fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>
                      No results for &ldquo;{customerQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Job Name *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Henderson Exterior" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Address *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Municipality *</label>
              <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }} value={form.municipality} onChange={(e) => setForm((f) => ({ ...f, municipality: e.target.value }))} placeholder="Des Moines" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Sales Tax</label>
              <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }}
                value={form.tax_exempt ? 'exempt' : 'taxable'}
                onChange={(e) => setForm((f) => ({ ...f, tax_exempt: e.target.value === 'exempt' }))}>
                <option value="taxable">Taxable</option>
                <option value="exempt">Tax Exempt</option>
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 72, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
            </div>

            {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(''); setCustomerQuery(''); }}>Cancel</button>
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
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 40 }}>No jobs found.</td></tr>
            )}
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

export default function JobsPage() {
  return <Suspense fallback={null}><JobsPageInner /></Suspense>;
}

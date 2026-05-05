'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, X, Send, Clock, Search, Trash2, List, Eye, Pencil } from 'lucide-react';
import { invoicesApi, customersApi, taxProfilesApi } from '@/lib/api';

function fmt(n: number) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'rgba(0,0,0,0.35)',
  SENT: '#007AFF',
  PARTIAL: '#FF9500',
  PAID: '#34C759',
  OVERDUE: '#FF3B30',
  VOID: 'rgba(0,0,0,0.25)',
};

const ALL_STATUSES = ['ALL', 'DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];

interface LineItem { description: string; qty: number; unit_price: number; }
interface Customer { id: string; name: string; email?: string; }
interface TaxProfile { id: string; name: string; }
interface Payment { id: string; amount: number; method: string; notes?: string; paid_at: string; }
interface Invoice {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  due_date: string;
  created_at: string;
  line_items: LineItem[];
  payments: Payment[];
  job?: { id: string; name: string; address: string; customer?: Customer } | null;
  customer?: Customer | null;
  notes?: string;
  tax_profile_id?: string;
}

const emptyItem: LineItem = { description: '', qty: 1, unit_price: 0 };

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_id: '', type: 'FINAL', due_days: '7', notes: '', tax_profile_id: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [formError, setFormError] = useState('');

  // Payment modal state
  const [paymentInv, setPaymentInv] = useState<{ id: string; invoice_number: string; balance: number } | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CHECK', notes: '' });
  const [paymentError, setPaymentError] = useState('');

  // Payments list modal state
  const [paymentsListInv, setPaymentsListInv] = useState<Invoice | null>(null);

  // Edit modal state
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ type: 'FINAL', due_date: '', notes: '', tax_profile_id: '' });
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [editError, setEditError] = useState('');

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });
  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list({ limit: '500' }),
  });
  const { data: taxProfilesData } = useQuery({
    queryKey: ['tax-profiles'],
    queryFn: () => taxProfilesApi.list(),
  });

  const allInvoices: Invoice[] = invoicesData?.data?.data || invoicesData?.data || [];
  const customers: Customer[] = customersData?.data?.data || customersData?.data || [];
  const taxProfiles: TaxProfile[] = taxProfilesData?.data?.data || taxProfilesData?.data || [];

  const invoices = allInvoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const recipientName = (inv.job?.customer?.name || inv.customer?.name || '').toLowerCase();
      const jobAddr = (inv.job?.address || '').toLowerCase();
      if (!inv.invoice_number.toLowerCase().includes(q) && !recipientName.includes(q) && !jobAddr.includes(q)) return false;
    }
    return true;
  });

  const createInvoice = useMutation({
    mutationFn: (payload: unknown) => invoicesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setShowModal(false);
      setLineItems([{ ...emptyItem }]);
      setForm({ customer_id: '', type: 'FINAL', due_days: '7', notes: '', tax_profile_id: '' });
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg || 'Failed to create invoice.');
    },
  });

  const sendInvoice = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    onError: () => alert('Failed to send invoice.'),
  });

  const recordPayment = useMutation({
    mutationFn: ({ invId, payload }: { invId: string; payload: unknown }) => invoicesApi.addPayment(invId, payload),
    onSuccess: (_, { invId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      window.open(`/invoices/${invId}`, '_blank');
      setPaymentInv(null);
      setPaymentForm({ amount: '', method: 'CHECK', notes: '' });
      setPaymentError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPaymentError(msg || 'Failed to record payment.');
    },
  });

  const deletePayment = useMutation({
    mutationFn: ({ invId, payId }: { invId: string; payId: string }) => invoicesApi.deletePayment(invId, payId),
    onSuccess: (_, { invId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      // Refresh the payments list modal
      setPaymentsListInv(prev => {
        if (!prev || prev.id !== invId) return prev;
        return null;
      });
    },
    onError: () => alert('Failed to delete payment.'),
  });

  const voidInvoice = useMutation({
    mutationFn: (id: string) => invoicesApi.void(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    onError: () => alert('Failed to delete invoice.'),
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) => invoicesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setEditInv(null);
      setEditError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEditError(msg || 'Failed to update invoice.');
    },
  });

  function handleCreate() {
    const valid = lineItems.filter(li => li.description.trim() && li.unit_price > 0);
    if (valid.length === 0) { setFormError('Add at least one line item.'); return; }
    if (!form.tax_profile_id) { setFormError('Select a tax profile.'); return; }
    const due_date = new Date();
    due_date.setDate(due_date.getDate() + (parseInt(form.due_days) || 7));
    createInvoice.mutate({
      customer_id: form.customer_id || undefined,
      type: form.type,
      line_items: valid.map(li => ({ description: li.description, qty: li.qty || 1, unit_price: li.unit_price, taxable: true })),
      tax_profile_id: form.tax_profile_id,
      due_date: due_date.toISOString(),
      notes: form.notes || undefined,
    });
  }

  function openEdit(inv: Invoice) {
    const d = new Date(inv.due_date);
    const due_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setEditInv(inv);
    setEditForm({
      type: inv.type,
      due_date,
      notes: inv.notes || '',
      tax_profile_id: inv.tax_profile_id || taxProfiles[0]?.id || '',
    });
    setEditLineItems(inv.line_items.length > 0 ? [...inv.line_items] : [{ ...emptyItem }]);
    setEditError('');
  }

  function handleEdit() {
    if (!editInv) return;
    const valid = editLineItems.filter(li => li.description.trim() && li.unit_price > 0);
    if (valid.length === 0) { setEditError('Add at least one line item.'); return; }
    if (!editForm.tax_profile_id) { setEditError('Select a tax profile.'); return; }
    updateInvoice.mutate({
      id: editInv.id,
      payload: {
        type: editForm.type,
        due_date: new Date(editForm.due_date + 'T12:00:00').toISOString(),
        notes: editForm.notes || undefined,
        tax_profile_id: editForm.tax_profile_id,
        line_items: valid.map(li => ({ description: li.description, qty: li.qty || 1, unit_price: li.unit_price, taxable: true })),
      },
    });
  }

  function openPayment(inv: Invoice) {
    const total = inv.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    setPaymentInv({ id: inv.id, invoice_number: inv.invoice_number, balance: total - paid });
    setPaymentForm({ amount: String((total - paid).toFixed(2)), method: 'CHECK', notes: '' });
    setPaymentError('');
  }

  function handlePayment() {
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) { setPaymentError('Enter a valid amount.'); return; }
    if (!paymentInv) return;
    recordPayment.mutate({ invId: paymentInv.id, payload: { amount, method: paymentForm.method, notes: paymentForm.notes || undefined, paid_at: new Date().toISOString() } });
  }

  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'PAID' && inv.status !== 'VOID')
    .reduce((s, inv) => {
      const total = inv.line_items.reduce((t, li) => t + li.qty * li.unit_price, 0);
      const paid = inv.payments.reduce((t, p) => t + Number(p.amount), 0);
      return s + (total - paid);
    }, 0);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} color="#007AFF" strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Invoices</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>{allInvoices.length} total</p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormError('');
            if (taxProfiles.length > 0) setForm(f => ({ ...f, tax_profile_id: taxProfiles[0].id }));
            setShowModal(true);
          }}
        >
          <Plus size={16} strokeWidth={1.5} /> New Invoice
        </button>
      </div>

      {/* Summary card */}
      <div className="glass" style={{ padding: '18px 24px', marginBottom: 24, display: 'flex', gap: 40 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Menlo,monospace', color: '#FF9500' }}>{fmt(totalOutstanding)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Invoices</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{allInvoices.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Paid</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#34C759' }}>{allInvoices.filter(i => i.status === 'PAID').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.35)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by number, customer, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: statusFilter === s ? '#007AFF' : 'rgba(0,0,0,0.06)',
                color: statusFilter === s ? '#fff' : 'rgba(0,0,0,0.5)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(0,0,0,0.3)' }}>
          <FileText size={36} strokeWidth={1} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0 }}>No invoices found.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Job / Address</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => {
              const total = inv.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0);
              const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
              const recipient = inv.job?.customer ?? inv.customer;
              return (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoice_number}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{recipient?.name ?? <span style={{ color: 'rgba(0,0,0,0.3)' }}>—</span>}</td>
                  <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{inv.job?.address ?? <span style={{ color: 'rgba(0,0,0,0.3)' }}>Standalone</span>}</td>
                  <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{inv.type}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: `${STATUS_COLOR[inv.status] || '#007AFF'}20`, color: STATUS_COLOR[inv.status] || '#007AFF' }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td style={{ fontFamily: 'Menlo,monospace' }}>
                    {fmt(total)}
                    {paid > 0 && paid < total && <span style={{ color: '#34C759', fontSize: 12, marginLeft: 6 }}>+{fmt(paid)}</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => window.open(`/invoices/${inv.id}`, '_blank')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', padding: 6 }}
                        title="View invoice"
                      >
                        <Eye size={14} strokeWidth={1.5} />
                      </button>
                      {inv.status !== 'VOID' && (
                        <button
                          onClick={() => openEdit(inv)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 6 }}
                          title="Edit invoice"
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                      )}
                      {(inv.status === 'DRAFT' || inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                        <button
                          onClick={() => { if (confirm(`Send invoice ${inv.invoice_number}?`)) sendInvoice.mutate(inv.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34C759', padding: 6 }}
                          title="Send invoice"
                        >
                          <Send size={14} strokeWidth={1.5} />
                        </button>
                      )}
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <button
                          onClick={() => openPayment(inv)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF9500', padding: 6 }}
                          title="Record payment"
                        >
                          <Clock size={14} strokeWidth={1.5} />
                        </button>
                      )}
                      {inv.payments.length > 0 && (
                        <button
                          onClick={() => setPaymentsListInv(inv)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', padding: 6 }}
                          title="View payments"
                        >
                          <List size={14} strokeWidth={1.5} />
                        </button>
                      )}
                      {inv.status !== 'VOID' && (
                        <button
                          onClick={() => { if (confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) voidInvoice.mutate(inv.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', padding: 6 }}
                          title="Delete invoice"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 540, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>New Invoice</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Customer (optional)</label>
                <select className="input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                  <option value="">No customer / standalone</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="DEPOSIT">Deposit</option>
                    <option value="PROGRESS">Progress</option>
                    <option value="FINAL">Final</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Due (days)</label>
                  <input className="input" type="number" min="1" value={form.due_days} onChange={e => setForm(f => ({ ...f, due_days: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Tax Profile</label>
                <select className="input" value={form.tax_profile_id} onChange={e => setForm(f => ({ ...f, tax_profile_id: e.target.value }))}>
                  <option value="">Select...</option>
                  {taxProfiles.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>Line Items</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 6 }}>
                  {['Description', 'Qty', 'Price', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>
                {lineItems.map((li, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input className="input" value={li.description} onChange={e => setLineItems(items => items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" />
                    <input className="input" type="number" min="1" value={li.qty} onChange={e => setLineItems(items => items.map((x, idx) => idx === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} />
                    <input className="input" type="number" min="0" step="0.01" value={li.unit_price || ''} onChange={e => setLineItems(items => items.map((x, idx) => idx === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} placeholder="0.00" />
                    <button onClick={() => setLineItems(items => items.filter((_, idx) => idx !== i))} disabled={lineItems.length === 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 4 }}>
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setLineItems(items => [...items, { ...emptyItem }])}
                  style={{ background: 'none', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'rgba(0,0,0,0.4)', width: '100%', marginTop: 4 }}
                >
                  + Add line item
                </button>
                <div style={{ textAlign: 'right', marginTop: 8, fontFamily: 'Menlo,monospace', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Total: {fmt(lineItems.reduce((s, li) => s + (li.qty || 1) * (li.unit_price || 0), 0))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment instructions, etc." />
              </div>
              {formError && <p style={{ color: '#FF3B30', fontSize: 13, margin: 0 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payments List Modal */}
      {paymentsListInv && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 480, padding: 32, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Payments — {paymentsListInv.invoice_number}</h2>
              <button onClick={() => setPaymentsListInv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            {paymentsListInv.payments.length === 0 ? (
              <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>No payments recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paymentsListInv.payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.04)' }}>
                    <div>
                      <div style={{ fontFamily: 'Menlo,monospace', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(Number(p.amount))}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>
                        {p.method}{p.notes ? ` — ${p.notes}` : ''} · {new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this payment? The invoice status will be updated.')) deletePayment.mutate({ invId: paymentsListInv.id, payId: p.id }); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', padding: 6 }}
                      title="Delete payment"
                      disabled={deletePayment.isPending}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPaymentsListInv(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editInv && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 540, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Edit Invoice — {editInv.invoice_number}</h2>
              <button onClick={() => setEditInv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="DEPOSIT">Deposit</option>
                    <option value="PROGRESS">Progress</option>
                    <option value="FINAL">Final</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Due Date</label>
                  <input className="input" type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Tax Profile</label>
                <select className="input" value={editForm.tax_profile_id} onChange={e => setEditForm(f => ({ ...f, tax_profile_id: e.target.value }))}>
                  <option value="">Select...</option>
                  {taxProfiles.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>Line Items</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 6 }}>
                  {['Description', 'Qty', 'Price', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>
                {editLineItems.map((li, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input className="input" value={li.description} onChange={e => setEditLineItems(items => items.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" />
                    <input className="input" type="number" min="1" value={li.qty} onChange={e => setEditLineItems(items => items.map((x, idx) => idx === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} />
                    <input className="input" type="number" min="0" step="0.01" value={li.unit_price || ''} onChange={e => setEditLineItems(items => items.map((x, idx) => idx === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} placeholder="0.00" />
                    <button onClick={() => setEditLineItems(items => items.filter((_, idx) => idx !== i))} disabled={editLineItems.length === 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 4 }}>
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditLineItems(items => [...items, { ...emptyItem }])}
                  style={{ background: 'none', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'rgba(0,0,0,0.4)', width: '100%', marginTop: 4 }}
                >
                  + Add line item
                </button>
                <div style={{ textAlign: 'right', marginTop: 8, fontFamily: 'Menlo,monospace', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  Total: {fmt(editLineItems.reduce((s, li) => s + (li.qty || 1) * (li.unit_price || 0), 0))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <input className="input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment instructions, etc." />
              </div>
              {editError && <p style={{ color: '#FF3B30', fontSize: 13, margin: 0 }}>{editError}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditInv(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleEdit} disabled={updateInvoice.isPending}>
                  {updateInvoice.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInv && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 400, padding: 32, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Record Payment</h2>
              <button onClick={() => setPaymentInv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, marginBottom: 20 }}>
              Invoice {paymentInv.invoice_number} — Balance: <strong style={{ color: 'var(--text-primary)' }}>{fmt(paymentInv.balance)}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Amount ($)</label>
                <input className="input" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Method</label>
                <select className="input" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="CHECK">Check</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <input className="input" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Check #, reference..." />
              </div>
              {paymentError && <p style={{ color: '#FF3B30', fontSize: 13, margin: 0 }}>{paymentError}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPaymentInv(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePayment} disabled={recordPayment.isPending}>
                  {recordPayment.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

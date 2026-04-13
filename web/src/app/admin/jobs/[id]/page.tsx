'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, Trash2, Send, Eye, Pencil, Clock, MoreHorizontal, AlertTriangle, Link } from 'lucide-react';
import { jobsApi, estimatesApi, settingsApi } from '@/lib/api';

const TABS = ['Overview', 'Estimates', 'Labor', 'Expenses', 'Invoices'];

function fmt(n: number) { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

interface LineItem { description: string; qty: number; unit_price: number; }
interface EstimateRow {
  id: string; estimate_number: string; status: string;
  line_items: { qty: number; unit_price: number; description: string; taxable: boolean }[];
  notes?: string; created_at: string; approval_token_expires_at?: string; approval_token?: string | null;
  email_delivered_at?: string | null; email_opened_at?: string | null; email_clicked_at?: string | null;
}

const emptyItem: LineItem = { description: '', qty: 1, unit_price: 0 };

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'rgba(0,0,0,0.3)',
  SENT: '#007AFF',
  APPROVED: '#34C759',
  DECLINED: '#FF3B30',
  EXPIRED: '#FF9500',
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // New estimate modal state
  const [showEstModal, setShowEstModal] = useState(false);
  const [estMode, setEstMode] = useState<'flat' | 'itemized'>('flat');
  const [flatDesc, setFlatDesc] = useState('');
  const [flatAmount, setFlatAmount] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [estNotes, setEstNotes] = useState('');
  const [estError, setEstError] = useState('');

  // Edit estimate modal state
  const [editEst, setEditEst] = useState<EstimateRow | null>(null);
  const [editMode, setEditMode] = useState<'flat' | 'itemized'>('flat');
  const [editFlatDesc, setEditFlatDesc] = useState('');
  const [editFlatAmount, setEditFlatAmount] = useState('');
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');

  // Labor modal state
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [laborForm, setLaborForm] = useState({ description: '', hours: '', rate: '', work_date: new Date().toISOString().slice(0, 10) });
  const [laborError, setLaborError] = useState('');

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ vendor: '', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), category: 'MATERIALS', notes: '' });
  const [expenseError, setExpenseError] = useState('');

  // Edit job modal state
  const [showEditJob, setShowEditJob] = useState(false);
  const [editJobForm, setEditJobForm] = useState({ name: '', address: '', municipality: '', status: '', tax_exempt: false, notes: '' });
  const [editJobError, setEditJobError] = useState('');

  // Delete job confirm
  const [showDeleteJob, setShowDeleteJob] = useState(false);

  // Preview modal state
  const [previewEst, setPreviewEst] = useState<EstimateRow | null>(null);

  const { data: jobData } = useQuery({ queryKey: ['jobs', id], queryFn: () => jobsApi.get(id) });
  const { data: profitData } = useQuery({ queryKey: ['jobs', id, 'profitability'], queryFn: () => jobsApi.profitability(id) });
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });

  const job = jobData?.data?.data || jobData?.data;
  const profit = profitData?.data?.data || profitData?.data;
  const settings = settingsData?.data?.data || settingsData?.data;

  // Close action menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openMenuId]);

  const createEstimate = useMutation({
    mutationFn: (payload: unknown) => estimatesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      closeEstModal();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEstError(msg || 'Failed to create estimate.');
    },
  });

  const sendEstimate = useMutation({
    mutationFn: (estId: string) => estimatesApi.send(estId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      const d = res.data?.data || res.data;
      if (d?.email_sent === false && d?.approval_url) {
        const copy = confirm(`Email delivery failed. Copy the approval link to share manually?\n\n${d.approval_url}`);
        if (copy) navigator.clipboard.writeText(d.approval_url).catch(() => {});
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed to send estimate. Check that Resend is configured.');
    },
  });

  const updateEstimate = useMutation({
    mutationFn: ({ estId, payload }: { estId: string; payload: unknown }) => estimatesApi.update(estId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      setEditEst(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEditError(msg || 'Failed to update estimate.');
    },
  });

  const deleteEstimate = useMutation({
    mutationFn: (estId: string) => estimatesApi.delete(estId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', id] }),
    onError: () => alert('Failed to delete estimate.'),
  });

  const expireEstimate = useMutation({
    mutationFn: (estId: string) => estimatesApi.update(estId, { status: 'EXPIRED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', id] }),
    onError: () => alert('Failed to expire estimate.'),
  });

  const updateJob = useMutation({
    mutationFn: (payload: unknown) => jobsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      setShowEditJob(false);
    },
    onError: () => setEditJobError('Failed to update job.'),
  });

  const deleteJob = useMutation({
    mutationFn: () => jobsApi.delete(id),
    onSuccess: () => router.push('/admin/jobs'),
    onError: () => alert('Failed to delete job.'),
  });

  const addLabor = useMutation({
    mutationFn: (payload: unknown) => jobsApi.addLabor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs', id, 'profitability'] });
      setShowLaborModal(false);
      setLaborForm({ description: '', hours: '', rate: '', work_date: new Date().toISOString().slice(0, 10) });
      setLaborError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setLaborError(msg || 'Failed to add labor entry.');
    },
  });

  const deleteLabor = useMutation({
    mutationFn: (entryId: string) => jobsApi.deleteLabor(id, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs', id, 'profitability'] });
    },
    onError: () => alert('Failed to delete labor entry.'),
  });

  const addExpense = useMutation({
    mutationFn: (payload: unknown) => jobsApi.addExpense(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs', id, 'profitability'] });
      setShowExpenseModal(false);
      setExpenseForm({ vendor: '', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), category: 'MATERIALS', notes: '' });
      setExpenseError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setExpenseError(msg || 'Failed to add expense.');
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (expenseId: string) => jobsApi.deleteExpense(id, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs', id, 'profitability'] });
    },
    onError: () => alert('Failed to delete expense.'),
  });

  function handleAddLabor() {
    const hours = parseFloat(laborForm.hours);
    const rate = parseFloat(laborForm.rate);
    if (!laborForm.description.trim()) { setLaborError('Description is required.'); return; }
    if (isNaN(hours) || hours <= 0) { setLaborError('Enter valid hours.'); return; }
    if (isNaN(rate) || rate <= 0) { setLaborError('Enter valid rate.'); return; }
    if (!laborForm.work_date) { setLaborError('Work date is required.'); return; }
    addLabor.mutate({ description: laborForm.description, hours, rate, work_date: laborForm.work_date });
  }

  function handleAddExpense() {
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.vendor.trim()) { setExpenseError('Vendor is required.'); return; }
    if (!expenseForm.description.trim()) { setExpenseError('Description is required.'); return; }
    if (isNaN(amount) || amount <= 0) { setExpenseError('Enter a valid amount.'); return; }
    if (!expenseForm.expense_date) { setExpenseError('Date is required.'); return; }
    addExpense.mutate({ vendor: expenseForm.vendor, description: expenseForm.description, amount, expense_date: expenseForm.expense_date, category: expenseForm.category, notes: expenseForm.notes || undefined });
  }

  function closeEstModal() {
    setShowEstModal(false);
    setEstMode('flat');
    setFlatDesc('');
    setFlatAmount('');
    setLineItems([{ ...emptyItem }]);
    setEstNotes('');
    setEstError('');
  }

  function openEdit(est: EstimateRow) {
    setOpenMenuId(null);
    const items = est.line_items || [];
    if (items.length === 1 && items[0].qty === 1) {
      setEditMode('flat');
      setEditFlatDesc(items[0].description || '');
      setEditFlatAmount(String(items[0].unit_price || ''));
    } else {
      setEditMode('itemized');
      setEditLineItems(items.map(li => ({ description: li.description, qty: li.qty, unit_price: li.unit_price })));
    }
    setEditNotes(est.notes || '');
    setEditError('');
    setEditEst(est);
  }

  function handleSaveEdit() {
    if (!editEst) return;
    const taxable = !job.tax_exempt;
    if (editMode === 'flat') {
      if (!editFlatAmount || isNaN(parseFloat(editFlatAmount)) || parseFloat(editFlatAmount) <= 0) {
        setEditError('Enter a valid amount.');
        return;
      }
      const items = [{
        description: editFlatDesc || 'Painting services',
        type: 'LABOR', qty: 1, unit: 'flat',
        unit_price: parseFloat(editFlatAmount),
        taxable,
      }];
      updateEstimate.mutate({ estId: editEst.id, payload: { line_items: items, notes: editNotes || undefined } });
    } else {
      const valid = editLineItems.filter(li => li.description.trim() && li.unit_price > 0);
      if (valid.length === 0) {
        setEditError('Add at least one service with a description and price.');
        return;
      }
      const items = valid.map(li => ({
        description: li.description,
        type: 'LABOR', qty: li.qty || 1, unit: 'flat',
        unit_price: li.unit_price,
        taxable,
      }));
      updateEstimate.mutate({ estId: editEst.id, payload: { line_items: items, notes: editNotes || undefined } });
    }
  }

  function handleCreateEstimate() {
    const taxable = !job.tax_exempt;
    if (estMode === 'flat') {
      if (!flatAmount || isNaN(parseFloat(flatAmount)) || parseFloat(flatAmount) <= 0) {
        setEstError('Enter a valid amount.');
        return;
      }
      const items = [{
        description: flatDesc || 'Painting services',
        type: 'LABOR', qty: 1, unit: 'flat',
        unit_price: parseFloat(flatAmount),
        taxable,
      }];
      createEstimate.mutate({ job_id: id, line_items: items, notes: estNotes || undefined });
    } else {
      const valid = lineItems.filter(li => li.description.trim() && li.unit_price > 0);
      if (valid.length === 0) {
        setEstError('Add at least one service with a description and price.');
        return;
      }
      const items = valid.map(li => ({
        description: li.description,
        type: 'LABOR', qty: li.qty || 1, unit: 'flat',
        unit_price: li.unit_price,
        taxable,
      }));
      createEstimate.mutate({ job_id: id, line_items: items, notes: estNotes || undefined });
    }
  }

  function openEditJob() {
    setEditJobForm({
      name: job.name || '',
      address: job.address || '',
      municipality: job.municipality || '',
      status: job.status || 'ESTIMATING',
      tax_exempt: job.tax_exempt || false,
      notes: job.notes || '',
    });
    setEditJobError('');
    setShowEditJob(true);
  }

  function handleSaveJob() {
    if (!editJobForm.name.trim()) { setEditJobError('Job name is required.'); return; }
    if (!editJobForm.address.trim()) { setEditJobError('Address is required.'); return; }
    updateJob.mutate(editJobForm);
  }

  function addLineItem() { setLineItems(l => [...l, { ...emptyItem }]); }
  function removeLineItem(i: number) { setLineItems(l => l.filter((_, idx) => idx !== i)); }
  function updateLineItem(i: number, patch: Partial<LineItem>) {
    setLineItems(l => l.map((item, idx) => idx === i ? { ...item, ...patch } : item));
  }

  function addEditLineItem() { setEditLineItems(l => [...l, { ...emptyItem }]); }
  function removeEditLineItem(i: number) { setEditLineItems(l => l.filter((_, idx) => idx !== i)); }
  function updateEditLineItem(i: number, patch: Partial<LineItem>) {
    setEditLineItems(l => l.map((item, idx) => idx === i ? { ...item, ...patch } : item));
  }

  const itemizedTotal = lineItems.reduce((s, li) => s + (li.qty || 1) * (li.unit_price || 0), 0);
  const editItemizedTotal = editLineItems.reduce((s, li) => s + (li.qty || 1) * (li.unit_price || 0), 0);

  if (!job) return <div style={{ padding: 40, color: 'rgba(0,0,0,0.4)' }}>Loading...</div>;

  const margin = profit?.margin ?? 0;
  const marginColor = margin >= 35 ? '#34C759' : margin >= 25 ? '#FF9500' : '#FF3B30';

  // Shared line items form used in both create and edit modals
  function LineItemsForm({
    mode, items, onAddItem, onRemoveItem, onUpdateItem, total,
  }: {
    mode: 'flat' | 'itemized';
    items: LineItem[];
    onAddItem: () => void;
    onRemoveItem: (i: number) => void;
    onUpdateItem: (i: number, p: Partial<LineItem>) => void;
    total: number;
  }) {
    return mode === 'itemized' ? (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8 }}>
          {['Service / Description', 'Qty', 'Price', ''].map((h) => (
            <div key={h} style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>
        {items.map((li, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input className="glass-input" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              value={li.description} onChange={(e) => onUpdateItem(i, { description: e.target.value })}
              placeholder="e.g. Exterior painting" />
            <input className="glass-input" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              type="number" min="1" step="1"
              value={li.qty} onChange={(e) => onUpdateItem(i, { qty: parseInt(e.target.value) || 1 })} />
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>$</span>
              <input className="glass-input" style={{ width: '100%', padding: '8px 8px 8px 18px', fontSize: 13 }}
                type="number" min="0" step="0.01"
                value={li.unit_price || ''} onChange={(e) => onUpdateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00" />
            </div>
            <button onClick={() => onRemoveItem(i)} disabled={items.length === 1}
              style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'default' : 'pointer', color: items.length === 1 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <button onClick={onAddItem} className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 12px', marginBottom: 12 }}>
          <Plus size={13} strokeWidth={1.5} /> Add Line
        </button>
        <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Menlo,monospace', marginBottom: 4 }}>
          Total: {fmt(total)}
        </div>
      </div>
    ) : null;
  }

  return (
    <div>
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }}>
        <ArrowLeft size={15} strokeWidth={1.5} /> Jobs
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{job.name}</h1>
          <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>{job.address}, {job.municipality} · {job.customer?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={openEditJob} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>
            <Pencil size={14} strokeWidth={1.5} /> Edit
          </button>
          <button onClick={() => setShowDeleteJob(true)} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13, color: '#FF3B30' }}>
            <Trash2 size={14} strokeWidth={1.5} /> Delete
          </button>
        </div>
      </div>

      {/* Profitability cards */}
      {profit && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Revenue', value: fmt(profit.revenue ?? 0), color: '#34C759' },
            { label: 'Labor Cost', value: fmt(profit.labor_cost ?? 0), color: '#FF9500' },
            { label: 'Expenses', value: fmt(profit.expense_cost ?? 0), color: '#FF9500' },
            { label: 'Net Margin', value: `${margin.toFixed(1)}%`, color: marginColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass" style={{ flex: 1, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Menlo,monospace', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: tab === t ? '#007AFF' : 'rgba(0,0,0,0.5)',
              borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
              marginBottom: -1,
            }}>{t}</button>
        ))}
      </div>

      {/* New Estimate Modal */}
      {showEstModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 560, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>New Estimate</h2>
              <button onClick={closeEstModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>

            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 4 }}>
              {(['flat', 'itemized'] as const).map((m) => (
                <button key={m} onClick={() => setEstMode(m)}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
                    borderRadius: 8, transition: 'all 0.15s',
                    background: estMode === m ? '#fff' : 'transparent',
                    color: estMode === m ? 'var(--text-primary)' : 'rgba(0,0,0,0.45)',
                    boxShadow: estMode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {m === 'flat' ? 'Flat Amount' : 'Itemized'}
                </button>
              ))}
            </div>

            {estMode === 'flat' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Description</label>
                  <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }}
                    value={flatDesc} onChange={(e) => setFlatDesc(e.target.value)}
                    placeholder="e.g. Interior painting — living room and hallway" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Total Amount *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>$</span>
                    <input className="glass-input" style={{ width: '100%', padding: '9px 12px 9px 24px', fontSize: 14 }}
                      type="number" min="0" step="0.01"
                      value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)}
                      placeholder="0.00" />
                  </div>
                </div>
              </div>
            )}

            {estMode === 'itemized' && (
              <LineItemsForm mode="itemized" items={lineItems} onAddItem={addLineItem} onRemoveItem={removeLineItem} onUpdateItem={updateLineItem} total={itemizedTotal} />
            )}

            <div style={{ marginTop: 16, marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes (optional)</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 64, resize: 'vertical' }}
                value={estNotes} onChange={(e) => setEstNotes(e.target.value)}
                placeholder="Any notes for this estimate..." />
            </div>

            {estError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{estError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeEstModal}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateEstimate} disabled={createEstimate.isPending}>
                {createEstimate.isPending ? 'Creating...' : 'Create Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Estimate Modal */}
      {editEst && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 560, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Edit {editEst.estimate_number}</h2>
              <button onClick={() => setEditEst(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>

            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 4 }}>
              {(['flat', 'itemized'] as const).map((m) => (
                <button key={m} onClick={() => setEditMode(m)}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
                    borderRadius: 8, transition: 'all 0.15s',
                    background: editMode === m ? '#fff' : 'transparent',
                    color: editMode === m ? 'var(--text-primary)' : 'rgba(0,0,0,0.45)',
                    boxShadow: editMode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {m === 'flat' ? 'Flat Amount' : 'Itemized'}
                </button>
              ))}
            </div>

            {editMode === 'flat' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Description</label>
                  <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14 }}
                    value={editFlatDesc} onChange={(e) => setEditFlatDesc(e.target.value)}
                    placeholder="e.g. Interior painting — living room and hallway" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Total Amount *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>$</span>
                    <input className="glass-input" style={{ width: '100%', padding: '9px 12px 9px 24px', fontSize: 14 }}
                      type="number" min="0" step="0.01"
                      value={editFlatAmount} onChange={(e) => setEditFlatAmount(e.target.value)}
                      placeholder="0.00" />
                  </div>
                </div>
              </div>
            )}

            {editMode === 'itemized' && (
              <LineItemsForm mode="itemized" items={editLineItems} onAddItem={addEditLineItem} onRemoveItem={removeEditLineItem} onUpdateItem={updateEditLineItem} total={editItemizedTotal} />
            )}

            <div style={{ marginTop: 16, marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>Notes (optional)</label>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 14, minHeight: 64, resize: 'vertical' }}
                value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any notes for this estimate..." />
            </div>

            {editError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16 }}>{editError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditEst(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={updateEstimate.isPending}>
                {updateEstimate.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Estimate Modal */}
      {previewEst && (() => {
        const items = previewEst.line_items || [];
        const subtotal = items.reduce((s, li) => s + li.qty * li.unit_price, 0);
        const taxableSubtotal = items.filter(li => li.taxable).reduce((s, li) => s + li.qty * li.unit_price, 0);
        // Use 7% Iowa default for preview (6% state + 1% local)
        const taxRate = 0.07;
        const taxAmount = job.tax_exempt ? 0 : taxableSubtotal * taxRate;
        const total = subtotal + taxAmount;
        const expiryDate = previewEst.approval_token_expires_at
          ? new Date(previewEst.approval_token_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : null;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
            <div className="glass" style={{ width: '100%', maxWidth: 620, padding: 0, background: '#fff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }}>
              {/* Header */}
              <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {settings?.company_name || 'BrushPro'}
                  </div>
                  {settings?.company_address && (
                    <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>{settings.company_address}</div>
                  )}
                  {settings?.company_phone && (
                    <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>{settings.company_phone}</div>
                  )}
                </div>
                <button onClick={() => setPreviewEst(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', padding: 4 }}>
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              {/* Estimate info */}
              <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Estimate</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{previewEst.estimate_number}</div>
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                    Prepared for: {job.customer?.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
                    Property: {job.address}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    {new Date(previewEst.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  {expiryDate && (
                    <>
                      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 4 }}>Expires</div>
                      <div style={{ fontSize: 14, color: '#FF9500' }}>{expiryDate}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div style={{ padding: '20px 32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                        <th key={h} style={{
                          fontSize: 11, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px',
                          fontWeight: 600, padding: '0 0 10px', textAlign: i > 0 ? 'right' : 'left',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((li, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '12px 0', fontSize: 14, color: 'var(--text-primary)' }}>{li.description}</td>
                        <td style={{ padding: '12px 0', fontSize: 14, color: 'rgba(0,0,0,0.6)', textAlign: 'right' }}>{li.qty}</td>
                        <td style={{ padding: '12px 0', fontSize: 14, color: 'rgba(0,0,0,0.6)', textAlign: 'right', fontFamily: 'Menlo,monospace' }}>
                          ${li.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 0', fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'Menlo,monospace', fontWeight: 600 }}>
                          ${(li.qty * li.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: 240 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>Subtotal</span>
                        <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Menlo,monospace' }}>
                          ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {!job.tax_exempt && taxAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>Sales Tax (7%)</span>
                          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Menlo,monospace' }}>
                            ${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {job.tax_exempt && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)' }}>Sales Tax</span>
                          <span style={{ fontSize: 14, color: '#34C759', fontFamily: 'Menlo,monospace' }}>Exempt</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#007AFF', fontFamily: 'Menlo,monospace' }}>
                          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {previewEst.notes && (
                  <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.03)', borderRadius: 10, borderLeft: '3px solid #007AFF' }}>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Notes</div>
                    <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.65)', lineHeight: 1.6, margin: 0 }}>{previewEst.notes}</p>
                  </div>
                )}

                {/* CTA button (visual only) */}
                <div style={{ marginTop: 28, textAlign: 'center', paddingBottom: 8 }}>
                  <div style={{ display: 'inline-block', background: '#007AFF', color: '#fff', padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600, opacity: 0.7 }}>
                    Review &amp; Approve
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>Customer approval button (preview only)</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab content */}
      <div className="glass" style={{ padding: 24 }}>
        {tab === 'Overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Status', value: job.status },
                { label: 'Sales Tax', value: job.tax_exempt ? 'Exempt' : 'Taxable' },
                { label: 'Start Date', value: job.start_date ? new Date(job.start_date).toLocaleDateString() : '—' },
                { label: 'End Date', value: job.end_date ? new Date(job.end_date).toLocaleDateString() : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
            {job.notes && <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
              <p style={{ color: 'rgba(0,0,0,0.7)', fontSize: 14, lineHeight: 1.6 }}>{job.notes}</p>
            </div>}
          </div>
        )}

        {tab === 'Estimates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => setShowEstModal(true)}>
                <Plus size={15} strokeWidth={1.5} /> New Estimate
              </button>
            </div>
            {(job.estimates || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No estimates yet.</p>
              : (
                <table className="data-table">
                  <thead><tr><th>Number</th><th>Status</th><th>Total</th><th>Created</th><th>Tracking</th><th></th></tr></thead>
                  <tbody>
                    {(job.estimates as EstimateRow[]).map((e) => {
                      const items = e.line_items || [];
                      const total = items.reduce((s, li) => s + li.qty * li.unit_price, 0);
                      const canSend = e.status === 'DRAFT' || e.status === 'SENT';
                      const canExpire = e.status === 'SENT' || e.status === 'DRAFT';
                      const canEdit = e.status === 'DRAFT' || e.status === 'SENT';
                      const statusColor = STATUS_COLORS[e.status] || 'rgba(0,0,0,0.3)';
                      return (
                        <tr key={e.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.estimate_number}</td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                              background: `${statusColor}18`, color: statusColor,
                            }}>{e.status}</span>
                          </td>
                          <td style={{ fontFamily: 'Menlo,monospace', color: 'var(--text-primary)' }}>{fmt(total)}</td>
                          <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>{new Date(e.created_at).toLocaleDateString()}</td>
                          <td>
                            {e.status === 'SENT' || e.status === 'APPROVED' ? (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {e.email_delivered_at ? (
                                  <span title={`Delivered ${new Date(e.email_delivered_at).toLocaleString()}`} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(52,199,89,0.12)', color: '#34C759', fontWeight: 500 }}>Delivered</span>
                                ) : (
                                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>Sent</span>
                                )}
                                {e.email_opened_at && (
                                  <span title={`Opened ${new Date(e.email_opened_at).toLocaleString()}`} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,122,255,0.12)', color: '#007AFF', fontWeight: 500 }}>Opened</span>
                                )}
                                {e.email_clicked_at && (
                                  <span title={`Clicked ${new Date(e.email_clicked_at).toLocaleString()}`} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,149,0,0.12)', color: '#FF9500', fontWeight: 500 }}>Clicked</span>
                                )}
                              </div>
                            ) : <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 12 }}>—</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                              {e.status === 'SENT' && e.approval_token && (
                                <button
                                  onClick={() => {
                                    const url = `${window.location.origin}/approve/${e.approval_token}`;
                                    navigator.clipboard.writeText(url).then(() => alert('Approval link copied!')).catch(() => prompt('Copy this link:', url));
                                  }}
                                  className="btn btn-ghost"
                                  style={{ padding: '5px 12px', fontSize: 12 }}
                                  title="Copy approval link"
                                >
                                  <Link size={12} strokeWidth={1.5} />
                                  Copy Link
                                </button>
                              )}
                              {canSend && (
                                <button
                                  onClick={() => sendEstimate.mutate(e.id)}
                                  disabled={sendEstimate.isPending}
                                  className="btn btn-primary"
                                  style={{ padding: '5px 12px', fontSize: 12 }}
                                >
                                  <Send size={12} strokeWidth={1.5} />
                                  {e.status === 'SENT' ? 'Resend' : 'Send'}
                                </button>
                              )}
                              {/* 3-dot action menu */}
                              <div style={{ position: 'relative' }} ref={openMenuId === e.id ? menuRef : undefined}>
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === e.id ? null : e.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                                >
                                  <MoreHorizontal size={16} strokeWidth={1.5} />
                                </button>
                                {openMenuId === e.id && (
                                  <div style={{
                                    position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff',
                                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                    zIndex: 50, minWidth: 160, overflow: 'hidden',
                                  }}>
                                    <button
                                      onClick={() => { setOpenMenuId(null); setPreviewEst(e); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', textAlign: 'left' }}
                                    >
                                      <Eye size={14} strokeWidth={1.5} /> Preview
                                    </button>
                                    {canEdit && (
                                      <button
                                        onClick={() => openEdit(e)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', textAlign: 'left' }}
                                      >
                                        <Pencil size={14} strokeWidth={1.5} /> Edit
                                      </button>
                                    )}
                                    {canExpire && (
                                      <button
                                        onClick={() => { setOpenMenuId(null); expireEstimate.mutate(e.id); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#FF9500', textAlign: 'left' }}
                                      >
                                        <Clock size={14} strokeWidth={1.5} /> Mark Expired
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        if (confirm(`Delete ${e.estimate_number}? This cannot be undone.`)) {
                                          deleteEstimate.mutate(e.id);
                                        }
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#FF3B30', textAlign: 'left', borderTop: '1px solid rgba(0,0,0,0.06)' }}
                                    >
                                      <Trash2 size={14} strokeWidth={1.5} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        )}

        {tab === 'Labor' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setLaborError(''); setLaborForm(f => ({ ...f, rate: String(job.labor_rate || '') })); setShowLaborModal(true); }}>
                <Plus size={16} strokeWidth={1.5} /> Add Labor
              </button>
            </div>
            {(job.labor || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No labor entries.</p>
              : <table className="data-table"><thead><tr><th>Description</th><th>Date</th><th>Hours</th><th>Rate</th><th>Total</th><th></th></tr></thead>
                  <tbody>{(job.labor as { id: string; description: string; hours: number; rate: number; work_date: string }[]).map((l) => (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{l.description}</td>
                      <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{new Date(l.work_date).toLocaleDateString()}</td>
                      <td style={{ color: 'rgba(0,0,0,0.7)' }}>{l.hours}h</td>
                      <td style={{ color: 'rgba(0,0,0,0.7)' }}>{fmt(l.rate)}/hr</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'var(--text-primary)' }}>{fmt(Number(l.hours) * Number(l.rate))}</td>
                      <td><button onClick={() => { if (confirm('Delete this labor entry?')) deleteLabor.mutate(l.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 4 }}><Trash2 size={14} strokeWidth={1.5} /></button></td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}

        {tab === 'Expenses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setExpenseError(''); setShowExpenseModal(true); }}>
                <Plus size={16} strokeWidth={1.5} /> Add Expense
              </button>
            </div>
            {(job.expenses || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No expenses yet.</p>
              : <table className="data-table"><thead><tr><th>Vendor</th><th>Description</th><th>Category</th><th>Date</th><th>Amount</th><th></th></tr></thead>
                  <tbody>{(job.expenses as { id: string; vendor: string; description: string; category: string; amount: number; expense_date: string }[]).map((e) => (
                    <tr key={e.id}>
                      <td style={{ color: 'var(--text-primary)' }}>{e.vendor}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{e.description}</td>
                      <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{e.category.replace(/_/g, ' ')}</td>
                      <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{new Date(e.expense_date).toLocaleDateString()}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#FF9500' }}>{fmt(e.amount)}</td>
                      <td><button onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(e.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)', padding: 4 }}><Trash2 size={14} strokeWidth={1.5} /></button></td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}

        {tab === 'Invoices' && (
          <div>
            {(job.invoices || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No invoices yet.</p>
              : <table className="data-table"><thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Due</th></tr></thead>
                  <tbody>{(job.invoices as { id: string; invoice_number: string; type: string; status: string; due_date: string }[]).map((inv) => (
                    <tr key={inv.id}><td style={{ color: 'var(--text-primary)' }}>{inv.invoice_number}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{inv.type}</td>
                      <td><span className="pill pill-blue">{inv.status}</span></td>
                      <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>{new Date(inv.due_date).toLocaleDateString()}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}
      </div>

      {/* Add Labor Modal */}
      {showLaborModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 440, padding: 32, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Add Labor Entry</h2>
              <button onClick={() => setShowLaborModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Description</label>
                <input className="input" value={laborForm.description} onChange={e => setLaborForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Prep and prime exterior" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Hours</label>
                  <input className="input" type="number" min="0.25" step="0.25" value={laborForm.hours} onChange={e => setLaborForm(f => ({ ...f, hours: e.target.value }))} placeholder="8" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Rate ($/hr)</label>
                  <input className="input" type="number" min="0" step="0.01" value={laborForm.rate} onChange={e => setLaborForm(f => ({ ...f, rate: e.target.value }))} placeholder={String(job.labor_rate || '')} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Work Date</label>
                <input className="input" type="date" value={laborForm.work_date} onChange={e => setLaborForm(f => ({ ...f, work_date: e.target.value }))} />
              </div>
              {laborError && <p style={{ color: '#FF3B30', fontSize: 13 }}>{laborError}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowLaborModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddLabor} disabled={addLabor.isPending}>
                  {addLabor.isPending ? 'Saving...' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 440, padding: 32, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Add Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Vendor</label>
                <input className="input" value={expenseForm.vendor} onChange={e => setExpenseForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Sherwin-Williams" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Description</label>
                <input className="input" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Exterior paint - 5 gal" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Amount ($)</label>
                  <input className="input" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Date</label>
                  <input className="input" type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Category</label>
                <select className="input" value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="MATERIALS">Materials</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                  <option value="EQUIPMENT_RENTAL">Equipment Rental</option>
                  <option value="SUPPLIES">Supplies</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <input className="input" value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" />
              </div>
              {expenseError && <p style={{ color: '#FF3B30', fontSize: 13 }}>{expenseError}</p>}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddExpense} disabled={addExpense.isPending}>
                  {addExpense.isPending ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 480, padding: 32, background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Edit Job</h2>
              <button onClick={() => setShowEditJob(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><X size={20} strokeWidth={1.5} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Job Name</label>
                <input className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
                  value={editJobForm.name} onChange={e => setEditJobForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Address</label>
                <input className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
                  value={editJobForm.address} onChange={e => setEditJobForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Municipality</label>
                <input className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
                  value={editJobForm.municipality} onChange={e => setEditJobForm(f => ({ ...f, municipality: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Status</label>
                <select className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
                  value={editJobForm.status} onChange={e => setEditJobForm(f => ({ ...f, status: e.target.value }))}>
                  {['ESTIMATING', 'ACTIVE', 'INVOICED', 'COMPLETE', 'CANCELLED'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="edit-tax-exempt" checked={editJobForm.tax_exempt}
                  onChange={e => setEditJobForm(f => ({ ...f, tax_exempt: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="edit-tax-exempt" style={{ fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer' }}>Tax Exempt</label>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 14, minHeight: 80, resize: 'vertical' }}
                  value={editJobForm.notes} onChange={e => setEditJobForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {editJobError && <p style={{ color: '#FF3B30', fontSize: 13, marginTop: 12 }}>{editJobError}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowEditJob(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSaveJob} className="btn btn-primary" disabled={updateJob.isPending}>
                {updateJob.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Confirmation */}
      {showDeleteJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 400, padding: 32, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={22} strokeWidth={1.5} style={{ color: '#FF3B30', flexShrink: 0 }} />
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>Delete Job</h2>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6, marginBottom: 24 }}>
              Delete <strong>{job.name}</strong>? This will remove the job and cannot be undone. Estimates, invoices, and contracts linked to this job will also be hidden.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteJob(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => deleteJob.mutate()} className="btn" disabled={deleteJob.isPending}
                style={{ background: '#FF3B30', color: '#fff', padding: '8px 20px', fontSize: 14, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {deleteJob.isPending ? 'Deleting...' : 'Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

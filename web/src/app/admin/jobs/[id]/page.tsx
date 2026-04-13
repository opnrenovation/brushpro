'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import { jobsApi, estimatesApi } from '@/lib/api';

const TABS = ['Overview', 'Estimates', 'Labor', 'Expenses', 'Invoices'];

function fmt(n: number) { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

interface LineItem { description: string; qty: number; unit_price: number; }

const emptyItem: LineItem = { description: '', qty: 1, unit_price: 0 };

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');

  // Estimate modal state
  const [showEstModal, setShowEstModal] = useState(false);
  const [estMode, setEstMode] = useState<'flat' | 'itemized'>('flat');
  const [flatDesc, setFlatDesc] = useState('');
  const [flatAmount, setFlatAmount] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [estNotes, setEstNotes] = useState('');
  const [estError, setEstError] = useState('');

  const { data: jobData } = useQuery({ queryKey: ['jobs', id], queryFn: () => jobsApi.get(id) });
  const { data: profitData } = useQuery({ queryKey: ['jobs', id, 'profitability'], queryFn: () => jobsApi.profitability(id) });

  const job = jobData?.data?.data || jobData?.data;
  const profit = profitData?.data?.data || profitData?.data;

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

  function closeEstModal() {
    setShowEstModal(false);
    setEstMode('flat');
    setFlatDesc('');
    setFlatAmount('');
    setLineItems([{ ...emptyItem }]);
    setEstNotes('');
    setEstError('');
  }

  function handleCreateEstimate() {
    if (estMode === 'flat') {
      if (!flatAmount || isNaN(parseFloat(flatAmount)) || parseFloat(flatAmount) <= 0) {
        setEstError('Enter a valid amount.');
        return;
      }
      const items = [{
        description: flatDesc || 'Painting services',
        type: 'LABOR', qty: 1, unit: 'flat',
        unit_price: parseFloat(flatAmount),
        taxable: true,
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
        taxable: true,
      }));
      createEstimate.mutate({ job_id: id, line_items: items, notes: estNotes || undefined });
    }
  }

  function addLineItem() { setLineItems(l => [...l, { ...emptyItem }]); }
  function removeLineItem(i: number) { setLineItems(l => l.filter((_, idx) => idx !== i)); }
  function updateLineItem(i: number, patch: Partial<LineItem>) {
    setLineItems(l => l.map((item, idx) => idx === i ? { ...item, ...patch } : item));
  }

  const itemizedTotal = lineItems.reduce((s, li) => s + (li.qty || 1) * (li.unit_price || 0), 0);

  if (!job) return <div style={{ padding: 40, color: 'rgba(0,0,0,0.4)' }}>Loading...</div>;

  const margin = profit?.margin ?? 0;
  const marginColor = margin >= 35 ? '#34C759' : margin >= 25 ? '#FF9500' : '#FF3B30';

  return (
    <div>
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }}>
        <ArrowLeft size={15} strokeWidth={1.5} /> Jobs
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{job.name}</h1>
        <p style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>{job.address}, {job.municipality} · {job.customer?.name}</p>
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

            {/* Mode toggle */}
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

            {/* Flat mode */}
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

            {/* Itemized mode */}
            {estMode === 'itemized' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service / Description</div>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qty</div>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price</div>
                  <div />
                </div>
                {lineItems.map((li, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input className="glass-input" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                      value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })}
                      placeholder="e.g. Exterior painting" />
                    <input className="glass-input" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                      type="number" min="1" step="1"
                      value={li.qty} onChange={(e) => updateLineItem(i, { qty: parseInt(e.target.value) || 1 })} />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>$</span>
                      <input className="glass-input" style={{ width: '100%', padding: '8px 8px 8px 18px', fontSize: 13 }}
                        type="number" min="0" step="0.01"
                        value={li.unit_price || ''} onChange={(e) => updateLineItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00" />
                    </div>
                    <button onClick={() => removeLineItem(i)} disabled={lineItems.length === 1}
                      style={{ background: 'none', border: 'none', cursor: lineItems.length === 1 ? 'default' : 'pointer', color: lineItems.length === 1 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button onClick={addLineItem} className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 12px', marginBottom: 12 }}>
                  <Plus size={13} strokeWidth={1.5} /> Add Line
                </button>
                <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Menlo,monospace', marginBottom: 4 }}>
                  Total: {fmt(itemizedTotal)}
                </div>
              </div>
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

      {/* Tab content */}
      <div className="glass" style={{ padding: 24 }}>
        {tab === 'Overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Status', value: job.status },
                { label: 'Labor Rate', value: job.labor_rate ? `$${job.labor_rate}/hr` : '—' },
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
                  <thead><tr><th>Number</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
                  <tbody>
                    {(job.estimates as { id: string; estimate_number: string; status: string; line_items: unknown; created_at: string }[]).map((e) => {
                      const items = (e.line_items as { qty: number; unit_price: number }[]) || [];
                      const total = items.reduce((s, li) => s + li.qty * li.unit_price, 0);
                      return (
                        <tr key={e.id}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.estimate_number}</td>
                          <td><span className="pill pill-blue">{e.status}</span></td>
                          <td style={{ fontFamily: 'Menlo,monospace', color: 'var(--text-primary)' }}>{fmt(total)}</td>
                          <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>{new Date(e.created_at).toLocaleDateString()}</td>
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
            {(job.labor || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No labor entries.</p>
              : <table className="data-table"><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Total</th></tr></thead>
                  <tbody>{(job.labor as { id: string; description: string; hours: number; rate: number }[]).map((l) => (
                    <tr key={l.id}><td style={{ color: 'var(--text-primary)' }}>{l.description}</td>
                      <td style={{ color: 'rgba(0,0,0,0.7)' }}>{l.hours}h</td>
                      <td style={{ color: 'rgba(0,0,0,0.7)' }}>{fmt(l.rate)}/hr</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'var(--text-primary)' }}>{fmt(l.hours * l.rate)}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}

        {tab === 'Expenses' && (
          <div>
            {(job.expenses || []).length === 0
              ? <p style={{ color: 'rgba(0,0,0,0.4)' }}>No expenses yet.</p>
              : <table className="data-table"><thead><tr><th>Vendor</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
                  <tbody>{(job.expenses as { id: string; vendor: string; description: string; category: string; amount: number }[]).map((e) => (
                    <tr key={e.id}><td style={{ color: 'var(--text-primary)' }}>{e.vendor}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{e.description}</td>
                      <td style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>{e.category}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#FF9500' }}>{fmt(e.amount)}</td>
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
    </div>
  );
}

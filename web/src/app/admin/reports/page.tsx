'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, Download, Calendar } from 'lucide-react';
import { reportsApi } from '@/lib/api';

function fmt(n: number) { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`; }
function pct(n: number) { return `${Number(n).toFixed(1)}%`; }

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type Preset = 'all' | '15d' | '30d' | '60d' | '90d' | 'month' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'month', label: 'This month' },
  { id: '15d', label: 'Last 15 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '60d', label: 'Last 60 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom' },
];

function getPresetRange(preset: Preset, customStart: string, customEnd: string): { start?: string; end?: string } {
  const now = new Date();
  if (preset === 'all') return {};
  if (preset === 'month') return { start: toISO(startOfMonth(now)), end: toISO(now) };
  if (preset === '15d') { const d = new Date(now); d.setDate(d.getDate() - 15); return { start: toISO(d), end: toISO(now) }; }
  if (preset === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: toISO(d), end: toISO(now) }; }
  if (preset === '60d') { const d = new Date(now); d.setDate(d.getDate() - 60); return { start: toISO(d), end: toISO(now) }; }
  if (preset === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90); return { start: toISO(d), end: toISO(now) }; }
  if (preset === 'custom') return { start: customStart || undefined, end: customEnd || undefined };
  return {};
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = getPresetRange(preset, customStart, customEnd);
  const params = Object.fromEntries(Object.entries(range).filter(([, v]) => v != null)) as Record<string, string>;

  const queryOptions = useCallback((key: string[]) => ({
    queryKey: [...key, range.start ?? '', range.end ?? ''],
    queryFn: () => {
      if (key[1] === 'tax' && key[2] === 'outstanding') return reportsApi.taxOutstanding(params);
      if (key[1] === 'tax') return reportsApi.tax(params);
      if (key[1] === 'profit') return reportsApi.profit(params);
      return reportsApi.tax(params);
    },
  }), [range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: taxData } = useQuery(queryOptions(['reports', 'tax']));
  const { data: taxOutstandingData } = useQuery(queryOptions(['reports', 'tax', 'outstanding']));
  const { data: profitData } = useQuery(queryOptions(['reports', 'profit']));

  const tax = taxData?.data?.data || taxData?.data || [];
  const taxOutstanding = taxOutstandingData?.data?.data || taxOutstandingData?.data || [];
  const profit = profitData?.data?.data || profitData?.data || [];

  const handleExport = async (type: 'tax' | 'profit') => {
    const res = type === 'tax' ? await reportsApi.taxExport() : await reportsApi.profitExport();
    downloadBlob(new Blob([res.data], { type: 'text/csv' }), `${type}-report.csv`);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <BarChart2 size={20} color="#007AFF" strokeWidth={1.5} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Reports</h1>
      </div>

      {/* Date range controls */}
      <div className="glass" style={{ padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Calendar size={14} color="#007AFF" strokeWidth={1.5} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Date Range</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: preset === p.id ? '#007AFF' : 'rgba(0,0,0,0.07)',
                color: preset === p.id ? '#fff' : 'var(--text-primary)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Profit Report */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Profit per Job</h2>
          <button className="btn btn-ghost" onClick={() => handleExport('profit')} style={{ fontSize: 13, padding: '7px 14px' }}>
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </button>
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {profit.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>No profit data available.</div>
            : <table className="data-table">
                <thead><tr><th>Job</th><th>Revenue</th><th>Labor</th><th>Expenses</th><th>Net</th><th>Margin</th></tr></thead>
                <tbody>
                  {(profit as { job_id: string; job_name: string; revenue: number; labor_cost: number; expense_cost: number; net_profit: number; margin: number }[]).map((r) => {
                    const color = r.margin >= 35 ? '#34C759' : r.margin >= 25 ? '#FF9500' : '#FF3B30';
                    return (
                      <tr key={r.job_id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.job_name}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: '#34C759' }}>{fmt(r.revenue)}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.6)' }}>{fmt(r.labor_cost)}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.6)' }}>{fmt(r.expense_cost)}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color }}>{fmt(r.net_profit)}</td>
                        <td><span style={{ fontSize: 12, fontWeight: 700, color }}>{pct(r.margin)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </div>
      </div>

      {/* Outstanding Tax by Municipality */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Outstanding Tax by Municipality</h2>
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>All open invoices (created but not fully paid) — state and local tax owed</p>
          </div>
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {taxOutstanding.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>No outstanding tax. All invoices paid.</div>
            : <table className="data-table">
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th>Open Invoices</th>
                    <th>Taxable Amount</th>
                    <th>State Tax</th>
                    <th>Local Tax</th>
                    <th>Total Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(taxOutstanding as { municipality: string; invoice_count: number; taxable_subtotal: number; state_tax_outstanding: number; local_tax_outstanding: number; total_tax_outstanding: number; state_rate: number; local_rate: number }[]).map((r) => (
                    <tr key={r.municipality}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.municipality}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{r.invoice_count}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.7)' }}>{fmt(r.taxable_subtotal)}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.6)' }}>
                        {fmt(r.state_tax_outstanding)}
                        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginLeft: 4 }}>({pct(r.state_rate * 100)})</span>
                      </td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.6)' }}>
                        {fmt(r.local_tax_outstanding)}
                        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginLeft: 4 }}>({pct(r.local_rate * 100)})</span>
                      </td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#FF9500', fontWeight: 700 }}>{fmt(r.total_tax_outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      {/* Tax Collected Report */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Tax Collected by Jurisdiction</h2>
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>Paid and partially paid invoices</p>
          </div>
          <button className="btn btn-ghost" onClick={() => handleExport('tax')} style={{ fontSize: 13, padding: '7px 14px' }}>
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </button>
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {tax.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>No tax data available.</div>
            : <table className="data-table">
                <thead><tr><th>Jurisdiction</th><th>Invoices</th><th>Taxable</th><th>Tax Collected</th></tr></thead>
                <tbody>
                  {(tax as { municipality: string; invoice_count: number; taxable_amount: number; tax_collected: number }[]).map((r) => (
                    <tr key={r.municipality}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.municipality}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{r.invoice_count}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.7)' }}>{fmt(r.taxable_amount)}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#34C759', fontWeight: 600 }}>{fmt(r.tax_collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>
    </div>
  );
}

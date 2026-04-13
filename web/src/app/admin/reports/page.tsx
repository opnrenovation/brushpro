'use client';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api';

function fmt(n: number) { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`; }
function pct(n: number) { return `${Number(n).toFixed(1)}%`; }

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { data: taxData } = useQuery({ queryKey: ['reports', 'tax'], queryFn: () => reportsApi.tax() });
  const { data: taxOutstandingData } = useQuery({ queryKey: ['reports', 'tax', 'outstanding'], queryFn: () => reportsApi.taxOutstanding() });
  const { data: profitData } = useQuery({ queryKey: ['reports', 'profit'], queryFn: () => reportsApi.profit() });

  const tax = taxData?.data?.data || taxData?.data || [];
  const taxOutstanding = taxOutstandingData?.data?.data || taxOutstandingData?.data || [];
  const profit = profitData?.data?.data || profitData?.data || [];

  const handleExport = async (type: 'tax' | 'profit') => {
    const res = type === 'tax' ? await reportsApi.taxExport() : await reportsApi.profitExport();
    downloadBlob(new Blob([res.data], { type: 'text/csv' }), `${type}-report.csv`);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <BarChart2 size={20} color="#007AFF" strokeWidth={1.5} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Reports</h1>
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
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>Sent invoices not yet paid — tax liability not yet collected</p>
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
                    <th>State Tax (6%)</th>
                    <th>Local Tax</th>
                    <th>Total Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(taxOutstanding as { municipality: string; invoice_count: number; taxable_subtotal: number; state_tax_outstanding: number; local_tax_outstanding: number; total_tax_outstanding: number; local_rate: number }[]).map((r) => (
                    <tr key={r.municipality}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.municipality}</td>
                      <td style={{ color: 'rgba(0,0,0,0.6)' }}>{r.invoice_count}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.7)' }}>{fmt(r.taxable_subtotal)}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(0,0,0,0.6)' }}>{fmt(r.state_tax_outstanding)}</td>
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

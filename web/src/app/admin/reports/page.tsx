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
  const { data: profitData } = useQuery({ queryKey: ['reports', 'profit'], queryFn: () => reportsApi.profit() });

  const tax = taxData?.data?.data || taxData?.data || [];
  const profit = profitData?.data?.data || profitData?.data || [];

  const handleExport = async (type: 'tax' | 'profit') => {
    const res = type === 'tax' ? await reportsApi.taxExport() : await reportsApi.profitExport();
    downloadBlob(new Blob([res.data], { type: 'text/csv' }), `${type}-report.csv`);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <BarChart2 size={20} color="#007AFF" strokeWidth={1.5} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Reports</h1>
      </div>

      {/* Profit Report */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Profit per Job</h2>
          <button className="btn btn-ghost" onClick={() => handleExport('profit')} style={{ fontSize: 13, padding: '7px 14px' }}>
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </button>
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {profit.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No profit data available.</div>
            : <table className="data-table">
                <thead><tr><th>Job</th><th>Revenue</th><th>Labor</th><th>Expenses</th><th>Net</th><th>Margin</th></tr></thead>
                <tbody>
                  {(profit as { job_id: string; job_name: string; revenue: number; labor_cost: number; expense_cost: number; net_profit: number; margin: number }[]).map((r) => {
                    const color = r.margin >= 35 ? '#34C759' : r.margin >= 25 ? '#FF9500' : '#FF3B30';
                    return (
                      <tr key={r.job_id}>
                        <td style={{ fontWeight: 500, color: '#fff' }}>{r.job_name}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: '#34C759' }}>{fmt(r.revenue)}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(255,255,255,0.6)' }}>{fmt(r.labor_cost)}</td>
                        <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(255,255,255,0.6)' }}>{fmt(r.expense_cost)}</td>
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

      {/* Tax Report */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Tax by Jurisdiction</h2>
          <button className="btn btn-ghost" onClick={() => handleExport('tax')} style={{ fontSize: 13, padding: '7px 14px' }}>
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </button>
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {tax.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No tax data available.</div>
            : <table className="data-table">
                <thead><tr><th>Jurisdiction</th><th>Invoices</th><th>Taxable</th><th>Tax Collected</th></tr></thead>
                <tbody>
                  {(tax as { municipality: string; invoice_count: number; taxable_amount: number; tax_collected: number }[]).map((r) => (
                    <tr key={r.municipality}>
                      <td style={{ fontWeight: 500, color: '#fff' }}>{r.municipality}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>{r.invoice_count}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: 'rgba(255,255,255,0.7)' }}>{fmt(r.taxable_amount)}</td>
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

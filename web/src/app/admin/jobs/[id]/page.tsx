'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { jobsApi } from '@/lib/api';

const TABS = ['Overview', 'Estimates', 'Labor', 'Expenses', 'Invoices'];

function fmt(n: number) { return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('Overview');

  const { data: jobData } = useQuery({ queryKey: ['jobs', id], queryFn: () => jobsApi.get(id) });
  const { data: profitData } = useQuery({ queryKey: ['jobs', id, 'profitability'], queryFn: () => jobsApi.profitability(id) });

  const job = jobData?.data?.data || jobData?.data;
  const profit = profitData?.data?.data || profitData?.data;

  if (!job) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Loading...</div>;

  const margin = profit?.margin ?? 0;
  const marginColor = margin >= 35 ? '#34C759' : margin >= 25 ? '#FF9500' : '#FF3B30';

  return (
    <div>
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }}>
        <ArrowLeft size={15} strokeWidth={1.5} /> Jobs
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{job.name}</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>{job.address}, {job.municipality} · {job.customer?.name}</p>
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
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: tab === t ? '#007AFF' : 'rgba(255,255,255,0.5)',
              borderBottom: `2px solid ${tab === t ? '#007AFF' : 'transparent'}`,
              marginBottom: -1,
            }}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass" style={{ padding: 24 }}>
        {tab === 'Overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Status', value: job.status },
                { label: 'Labor Rate', value: `$${job.labor_rate}/hr` },
                { label: 'Start Date', value: job.start_date ? new Date(job.start_date).toLocaleDateString() : '—' },
                { label: 'End Date', value: job.end_date ? new Date(job.end_date).toLocaleDateString() : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, color: '#fff' }}>{value}</div>
                </div>
              ))}
            </div>
            {job.notes && <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6 }}>{job.notes}</p>
            </div>}
          </div>
        )}
        {tab === 'Estimates' && (
          <div>
            {(job.estimates || []).length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No estimates yet.</p>
              : <table className="data-table"><thead><tr><th>Number</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>{(job.estimates as { id: string; estimate_number: string; status: string; created_at: string }[]).map((e) => (
                    <tr key={e.id}><td style={{ color: '#fff' }}>{e.estimate_number}</td>
                      <td><span className="pill pill-blue">{e.status}</span></td>
                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}
        {tab === 'Labor' && (
          <div>
            {(job.labor || []).length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No labor entries.</p>
              : <table className="data-table"><thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th>Total</th></tr></thead>
                  <tbody>{(job.labor as { id: string; description: string; hours: number; rate: number; work_date: string }[]).map((l) => (
                    <tr key={l.id}><td style={{ color: '#fff' }}>{l.description}</td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>{l.hours}h</td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>{fmt(l.rate)}/hr</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#fff' }}>{fmt(l.hours * l.rate)}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}
        {tab === 'Expenses' && (
          <div>
            {(job.expenses || []).length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No expenses yet.</p>
              : <table className="data-table"><thead><tr><th>Vendor</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
                  <tbody>{(job.expenses as { id: string; vendor: string; description: string; category: string; amount: number }[]).map((e) => (
                    <tr key={e.id}><td style={{ color: '#fff' }}>{e.vendor}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>{e.description}</td>
                      <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{e.category}</td>
                      <td style={{ fontFamily: 'Menlo,monospace', color: '#FF9500' }}>{fmt(e.amount)}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}
        {tab === 'Invoices' && (
          <div>
            {(job.invoices || []).length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.4)' }}>No invoices yet.</p>
              : <table className="data-table"><thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Due</th></tr></thead>
                  <tbody>{(job.invoices as { id: string; invoice_number: string; type: string; status: string; due_date: string }[]).map((inv) => (
                    <tr key={inv.id}><td style={{ color: '#fff' }}>{inv.invoice_number}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>{inv.type}</td>
                      <td><span className="pill pill-blue">{inv.status}</span></td>
                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{new Date(inv.due_date).toLocaleDateString()}</td>
                    </tr>))}
                  </tbody></table>}
          </div>
        )}
      </div>
    </div>
  );
}

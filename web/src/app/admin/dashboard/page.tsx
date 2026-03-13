'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Target, Briefcase, AlertTriangle } from 'lucide-react';
import { reportsApi, leadsApi, jobsApi, invoicesApi } from '@/lib/api';

function StatCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral' }) {
  const color = trend === 'up' ? '#34C759' : trend === 'down' ? '#FF3B30' : '#007AFF';
  return (
    <div className="glass" style={{ padding: '24px', flex: 1 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Menlo, monospace', color }}>{value}</span>
        {trend === 'up' && <TrendingUp size={18} color={color} strokeWidth={1.5} style={{ marginBottom: 4 }} />}
        {trend === 'down' && <TrendingDown size={18} color={color} strokeWidth={1.5} style={{ marginBottom: 4 }} />}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function DashboardPage() {
  const { data: profitData } = useQuery({ queryKey: ['reports', 'profit'], queryFn: () => reportsApi.profit() });
  const { data: leadsData } = useQuery({ queryKey: ['leads'], queryFn: () => leadsApi.list() });
  const { data: jobsData } = useQuery({ queryKey: ['jobs', 'active'], queryFn: () => jobsApi.list({ status: 'ACTIVE' }) });
  const { data: invoicesData } = useQuery({ queryKey: ['invoices', 'overdue'], queryFn: () => invoicesApi.list({ status: 'OVERDUE' }) });

  const jobs: unknown[] = Array.isArray(jobsData?.data?.data) ? jobsData.data.data : Array.isArray(jobsData?.data) ? jobsData.data : [];
  const leads: unknown[] = Array.isArray(leadsData?.data?.data) ? leadsData.data.data : Array.isArray(leadsData?.data) ? leadsData.data : [];
  const invoices: unknown[] = Array.isArray(invoicesData?.data?.data) ? invoicesData.data.data : Array.isArray(invoicesData?.data) ? invoicesData.data : [];
  const profit = profitData?.data?.data || profitData?.data || [];

  const revenue = Array.isArray(profit) ? profit.reduce((s: number, j: { revenue?: number }) => s + (j.revenue || 0), 0) : 0;
  const costs = Array.isArray(profit) ? profit.reduce((s: number, j: { total_cost?: number }) => s + (j.total_cost || 0), 0) : 0;
  const net = revenue - costs;
  const newLeads = leads.filter((l: unknown) => (l as { stage?: string }).stage === 'NEW').length;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 28 }}>OPN Renovation — Overview</p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        <StatCard label="Revenue" value={fmt(revenue)} trend="up" />
        <StatCard label="Costs" value={fmt(costs)} trend="neutral" />
        <StatCard label="Net Profit" value={fmt(net)} sub={revenue > 0 ? `${((net / revenue) * 100).toFixed(1)}% margin` : undefined} trend={net > 0 ? 'up' : 'down'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Active Jobs */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={18} color="#007AFF" strokeWidth={1.5} />
              <span style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>Active Jobs</span>
            </div>
            <Link href="/admin/jobs" style={{ fontSize: 13, color: '#007AFF', textDecoration: 'none' }}>View all</Link>
          </div>
          {jobs.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No active jobs</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Job</th><th>Status</th></tr></thead>
              <tbody>
                {(jobs as { id: string; name: string; status: string }[]).slice(0, 5).map((j) => (
                  <tr key={j.id}>
                    <td><Link href={`/admin/jobs/${j.id}`} style={{ color: '#fff', textDecoration: 'none' }}>{j.name}</Link></td>
                    <td><span className="pill pill-green">{j.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* New Leads Alert */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} color="#007AFF" strokeWidth={1.5} />
              <span style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>Lead Pipeline</span>
            </div>
            <Link href="/admin/leads" style={{ fontSize: 13, color: '#007AFF', textDecoration: 'none' }}>View all</Link>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[{ label: 'Total', value: leads.length, color: '#007AFF' },
              { label: 'New', value: newLeads, color: newLeads > 0 ? '#FF9500' : '#34C759' },
              { label: 'Won', value: leads.filter((l: unknown) => (l as { stage?: string }).stage === 'WON').length, color: '#34C759' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, minWidth: 80, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'Menlo,monospace' }}>{value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue Invoices */}
      {invoices.length > 0 && (
        <div style={{ marginTop: 20, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="#FF3B30" strokeWidth={1.5} />
          <span style={{ fontSize: 14, color: '#FF3B30', fontWeight: 500 }}>
            {invoices.length} overdue invoice{invoices.length !== 1 ? 's' : ''} need attention.
          </span>
          <Link href="/admin/jobs" style={{ fontSize: 13, color: '#FF3B30', textDecoration: 'underline', marginLeft: 'auto' }}>Review</Link>
        </div>
      )}
    </div>
  );
}

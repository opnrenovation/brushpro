'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Search, Plus } from 'lucide-react';
import { jobsApi } from '@/lib/api';

const STATUSES = ['ALL', 'ESTIMATING', 'ACTIVE', 'INVOICED', 'COMPLETE', 'CANCELLED'];
const STATUS_PILL: Record<string, string> = {
  ESTIMATING: 'pill-blue', ACTIVE: 'pill-green', INVOICED: 'pill-orange',
  COMPLETE: 'pill-muted', CANCELLED: 'pill-muted',
};

interface Job { id: string; name: string; address: string; status: string; municipality: string; customer?: { name: string }; created_at: string; }

const FALLBACK: Job[] = [
  { id: '1', name: 'Henderson Exterior', address: '142 Maple Ave', status: 'ACTIVE', municipality: 'Des Moines', customer: { name: 'Mark Henderson' }, created_at: new Date().toISOString() },
  { id: '2', name: 'Downtown Office Suite', address: '800 Commerce Blvd', status: 'ESTIMATING', municipality: 'Des Moines', customer: { name: 'Apex Realty' }, created_at: new Date().toISOString() },
  { id: '3', name: 'Garcia Residence Interior', address: '55 Birchwood Ct', status: 'COMPLETE', municipality: 'Ankeny', customer: { name: 'Elena Garcia' }, created_at: new Date().toISOString() },
];

export default function JobsPage() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list(), placeholderData: { data: { data: FALLBACK } } });
  const jobs: Job[] = data?.data?.data || data?.data || FALLBACK;

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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Jobs</h1>
        </div>
        <button className="btn btn-primary"><Plus size={16} strokeWidth={2} /> New Job</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)',
              background: status === s ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.05)',
              color: status === s ? '#007AFF' : 'rgba(255,255,255,0.5)',
            }}>{s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
        <Search size={15} strokeWidth={1.5} color="rgba(255,255,255,0.3)"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." className="glass-input"
          style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: 14 }} />
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Job</th><th>Customer</th><th>Address</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id}>
                <td><Link href={`/admin/jobs/${j.id}`} style={{ color: '#fff', fontWeight: 500, textDecoration: 'none' }}>{j.name}</Link></td>
                <td style={{ color: 'rgba(255,255,255,0.6)' }}>{j.customer?.name || '—'}</td>
                <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{j.address}, {j.municipality}</td>
                <td><span className={`pill ${STATUS_PILL[j.status] || 'pill-muted'}`}>{j.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

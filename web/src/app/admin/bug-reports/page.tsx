'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, ImageIcon } from 'lucide-react';
import { bugReportsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Modal, Field, Pill, FilterChips, PageHeader, inputStyle, errMsg } from '@/components/admin/ui';

interface Report {
  id: string;
  type: 'BUG' | 'FEATURE_REQUEST' | 'QUESTION';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX';
  title: string;
  description: string;
  page_url: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  has_screenshot?: boolean;
  screenshot?: string | null;
  reporter: { id: string; name: string; email: string } | null;
}

const FILTERS = ['ACTIVE', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX', 'ALL'] as const;
const FILTER_LABELS = { ACTIVE: 'Open + In progress', WONT_FIX: "Won't fix" };
const TYPE_LABEL: Record<string, string> = { BUG: 'Bug', FEATURE_REQUEST: 'Change', QUESTION: 'Question' };

const when = (v: string) =>
  new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

const reporterName = (r: Report) =>
  r.reporter ? (r.reporter.name && r.reporter.name !== 'Admin' ? r.reporter.name : r.reporter.email) : 'Unknown';

export default function BugReportsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <BugReportsPage />
    </Suspense>
  );
}

function BugReportsPage() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ACTIVE');
  const [openId, setOpenId] = useState<string | null>(params.get('id'));

  const query: Record<string, string> = {};
  if (filter === 'ACTIVE') query.status = 'OPEN,IN_PROGRESS';
  else if (filter !== 'ALL') query.status = filter;

  const { data, isLoading } = useQuery({ queryKey: ['bug-reports', query], queryFn: () => bugReportsApi.list(query) });
  const reports: Report[] = data?.data?.data || [];

  return (
    <div>
      <PageHeader icon={<Bug size={20} color="#007AFF" strokeWidth={1.5} />} title="Bug Reports" />
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -12, marginBottom: 16 }}>
        Use the Report button at the bottom right of any page to send a bug or a change request.
      </p>
      <div style={{ marginBottom: 16 }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} labels={FILTER_LABELS} />
      </div>

      <div className="glass" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Report</th><th>Type</th><th>Priority</th><th>From</th><th>Filed</th><th>Status</th></tr></thead>
          <tbody>
            {!isLoading && reports.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 40 }}>Nothing here</td></tr>
            )}
            {reports.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)}>
                <td>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.title}
                    {r.has_screenshot && <ImageIcon size={13} strokeWidth={1.5} color="rgba(0,0,0,0.35)" />}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description}
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>{TYPE_LABEL[r.type]}</td>
                <td><Pill value={r.priority} /></td>
                <td style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>{reporterName(r)}</td>
                <td style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                <td><Pill value={r.status} label={r.status === 'WONT_FIX' ? "Won't fix" : undefined} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && <ReportDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const isOwner = useAuthStore((s) => s.user?.role === 'OWNER');
  const { data } = useQuery({ queryKey: ['bug-report', id], queryFn: () => bugReportsApi.get(id) });
  const report: Report | undefined = data?.data?.data;
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (report) {
      setStatus(report.status);
      setNotes(report.resolution_notes || '');
    }
  }, [report]);

  const save = useMutation({
    mutationFn: () => bugReportsApi.update(id, { status, resolution_notes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bug-reports'] });
      qc.invalidateQueries({ queryKey: ['bug-report', id] });
      onClose();
    },
    onError: (e) => setError(errMsg(e, 'Failed to save.')),
  });

  const remove = useMutation({
    mutationFn: () => bugReportsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bug-reports'] }); onClose(); },
  });

  return (
    <Modal title={report?.title || 'Report'} onClose={onClose} maxWidth={620}>
      {!report ? <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <Pill value={report.type} label={TYPE_LABEL[report.type]} />
            <Pill value={report.priority} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {reporterName(report)} · {when(report.created_at)}{report.page_url ? ` · ${report.page_url}` : ''}
            </span>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 16 }}>{report.description}</p>
          {report.screenshot && (
            <a href={report.screenshot} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.screenshot} alt="Attached screenshot" style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', marginBottom: 16 }} />
            </a>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 200px) 1fr', gap: 12 }}>
            <Field label="Status">
              <select className="glass-input" style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="WONT_FIX">Won&apos;t fix</option>
              </select>
            </Field>
            <Field label="Response / what changed">
              <textarea className="glass-input" style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          {error && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            {isOwner && (
              <button className="btn btn-ghost" style={{ color: '#FF3B30' }} onClick={() => { if (confirm('Delete this report permanently?')) remove.mutate(); }}>Delete</button>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

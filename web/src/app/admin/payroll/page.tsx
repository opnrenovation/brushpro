'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wallet, Plus } from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { Modal, Field, Pill, PageHeader, inputStyle, money, hours, day, todayIso, errMsg } from '@/components/admin/ui';

interface PayRun {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  frequency: string;
  status: string;
  total_gross: string;
  total_net: string;
  total_employer_taxes: string;
  _count: { stubs: number };
}

const FREQ_DAYS: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14 };
const FREQ_LABEL: Record<string, string> = { WEEKLY: 'Weekly', BIWEEKLY: 'Every 2 weeks', SEMIMONTHLY: 'Twice a month', MONTHLY: 'Monthly' };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Suggest the next period from the latest run, or the two weeks ending last Saturday.
function suggestPeriod(runs: PayRun[], frequency: string) {
  const len = FREQ_DAYS[frequency];
  const last = runs[0];
  if (last && len) {
    const start = addDays(last.period_end.slice(0, 10), 1);
    const end = addDays(start, len - 1);
    return { period_start: start, period_end: end, pay_date: addDays(end, 6) };
  }
  const today = new Date(`${todayIso()}T00:00:00Z`);
  const lastSat = addDays(todayIso(), -((today.getUTCDay() + 1) % 7));
  const span = len || 14;
  return { period_start: addDays(lastSat, -(span - 1)), period_end: lastSat, pay_date: todayIso() };
}

export default function PayrollPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'runs' | 'ytd'>('runs');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ frequency: 'BIWEEKLY', period_start: '', period_end: '', pay_date: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['pay-runs'], queryFn: () => payrollApi.runs() });
  const runs: PayRun[] = data?.data?.data || [];

  const create = useMutation({
    mutationFn: () => payrollApi.create(form),
    onSuccess: (res) => router.push(`/admin/payroll/${res.data.data.id}`),
    onError: (e) => setError(errMsg(e, 'Failed to create pay run.')),
  });

  // Arriving from Time Cards' "Run payroll": open the form on that period.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const start = q.get('start');
    const end = q.get('end');
    if (q.get('new') !== '1' || !start || !end) return;
    const frequency = FREQ_LABEL[q.get('frequency') || ''] ? q.get('frequency')! : 'BIWEEKLY';
    setForm({ frequency, period_start: start, period_end: end, pay_date: end < todayIso() ? todayIso() : addDays(end, 6) });
    setError('');
    setShowNew(true);
    window.history.replaceState(null, '', '/admin/payroll');
  }, []);

  function openNew() {
    const frequency = runs[0]?.frequency || 'BIWEEKLY';
    setForm({ frequency, ...suggestPeriod(runs, frequency) });
    setError('');
    setShowNew(true);
  }

  return (
    <div>
      <PageHeader icon={<Wallet size={20} color="#007AFF" strokeWidth={1.5} />} title="Payroll">
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} strokeWidth={1.5} /> New Pay Run</button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {([['runs', 'Pay Runs'], ['ytd', 'Year to Date']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: '10px 16px', fontSize: 14, fontWeight: tab === k ? 600 : 400, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #007AFF' : '2px solid transparent',
              color: tab === k ? '#007AFF' : 'rgba(0,0,0,0.55)', marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'runs' ? (
        <div className="glass" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Pay Date</th><th>Period</th><th>People</th><th>Gross</th><th>Net Pay</th><th>Employer Taxes</th><th>Status</th></tr></thead>
            <tbody>
              {!isLoading && runs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 40 }}>
                  No pay runs yet. Add employees, log their hours, then start a pay run.
                </td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/payroll/${r.id}`)}>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`/admin/payroll/${r.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{day(r.pay_date)}</Link>
                  </td>
                  <td style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
                    {day(r.period_start, { month: 'short', day: 'numeric' })} – {day(r.period_end, { month: 'short', day: 'numeric' })}
                  </td>
                  <td>{r._count.stubs}</td>
                  <td>{money(r.total_gross)}</td>
                  <td style={{ fontWeight: 600 }}>{money(r.total_net)}</td>
                  <td style={{ color: 'rgba(0,0,0,0.55)' }}>{money(r.total_employer_taxes)}</td>
                  <td><Pill value={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <YearToDate />}

      {showNew && (
        <Modal title="New Pay Run" onClose={() => setShowNew(false)} maxWidth={460}>
          <Field label="Pay Frequency">
            <select className="glass-input" style={inputStyle} value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value, ...suggestPeriod(runs, e.target.value) })}>
              {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
            <Field label="Period Start"><input className="glass-input" style={inputStyle} type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field>
            <Field label="Period End"><input className="glass-input" style={inputStyle} type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
          </div>
          <Field label="Pay Date"><input className="glass-input" style={inputStyle} type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></Field>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Every active employee gets a pay stub. Hourly pay comes from hours logged in the period; salaried pay is the salary divided by the pay frequency.
          </p>
          {error && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Building...' : 'Create Draft'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function YearToDate() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data } = useQuery({ queryKey: ['payroll-summary', year], queryFn: () => payrollApi.summary(year) });
  type Row = Record<string, string | null> & { employee?: { first_name: string; last_name: string; worker_type: string } };
  const rows: Row[] = data?.data?.data?.rows || [];
  const sum = (k: string) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
  const cols: Array<[string, string]> = [
    ['gross_pay', 'Gross'], ['federal_withholding', 'Federal'], ['state_withholding', 'Iowa'],
    ['social_security', 'Soc. Sec.'], ['medicare', 'Medicare'], ['other_deductions', 'Other'],
    ['reimbursement', 'Reimb.'], ['net_pay', 'Net'],
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <select className="glass-input" style={{ padding: '8px 12px', fontSize: 14 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[0, 1, 2, 3].map((n) => { const y = new Date().getFullYear() - n; return <option key={y} value={y}>{y}</option>; })}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Finalized and paid runs only. Use these totals for quarterly 941 / IA filings and year-end W-2s and 1099s.</span>
      </div>
      <div className="glass" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Employee</th><th>Type</th><th>Hours</th>{cols.map(([, l]) => <th key={l}>{l}</th>)}<th>Employer Tax</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 4} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 32 }}>No finalized payroll in {year}</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.employee?.first_name} {r.employee?.last_name}</td>
                <td style={{ fontSize: 13 }}>{r.employee?.worker_type === 'W2' ? 'W-2' : '1099'}</td>
                <td>{hours(Number(r.regular_hours || 0) + Number(r.overtime_hours || 0))}</td>
                {cols.map(([k]) => <td key={k} style={{ fontWeight: k === 'net_pay' ? 600 : 400 }}>{money(r[k])}</td>)}
                <td>{money(Number(r.employer_social_security || 0) + Number(r.employer_medicare || 0))}</td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td><td /><td>{hours(sum('regular_hours') + sum('overtime_hours'))}</td>
                {cols.map(([k]) => <td key={k}>{money(sum(k))}</td>)}
                <td>{money(sum('employer_social_security') + sum('employer_medicare'))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

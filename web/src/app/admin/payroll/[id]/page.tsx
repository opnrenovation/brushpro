'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Lock, CheckCircle2, RotateCcw, Trash2, Download, Printer, Pencil, Wallet } from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { Modal, Field, Pill, inputStyle, money, hours, day, errMsg } from '@/components/admin/ui';

interface Stub {
  id: string;
  employee_id: string;
  worker_type: 'W2' | 'CONTRACTOR_1099';
  pay_type: 'HOURLY' | 'SALARY';
  pay_rate: string;
  regular_hours: string;
  overtime_hours: string;
  regular_pay: string;
  overtime_pay: string;
  bonus: string;
  reimbursement: string;
  gross_pay: string;
  federal_withholding: string;
  state_withholding: string;
  social_security: string;
  medicare: string;
  other_deductions: string;
  other_deductions_note: string | null;
  net_pay: string;
  employer_social_security: string;
  employer_medicare: string;
  payment_method: string | null;
  check_number: string | null;
  notes: string | null;
  employee: { id: string; first_name: string; last_name: string; position: string | null; address: string | null };
}

interface Run {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  frequency: string;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  notes: string | null;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  total_employer_taxes: string;
  pending_time_entries: number;
  stubs: Stub[];
}

const n = (v: unknown) => Number(v ?? 0);

export default function PayRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Stub | null>(null);
  const [printing, setPrinting] = useState<Stub | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['pay-run', id], queryFn: () => payrollApi.get(id) });
  const run: Run | undefined = data?.data?.data;

  const setRun = (res: { data: { data: Run } }) => {
    qc.setQueryData(['pay-run', id], res);
    qc.invalidateQueries({ queryKey: ['pay-runs'] });
  };
  const action = useMutation({
    mutationFn: (fn: () => Promise<{ data: { data: Run } }>) => fn(),
    onSuccess: setRun,
    onError: (e) => alert(errMsg(e, 'Something went wrong.')),
  });
  const remove = useMutation({
    mutationFn: () => payrollApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-runs'] }); router.push('/admin/payroll'); },
    onError: (e) => alert(errMsg(e, 'Failed to delete pay run.')),
  });

  async function exportCsv() {
    const res = await payrollApi.export(id);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${run?.pay_date.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>;
  if (!run) return <p style={{ color: 'var(--text-tertiary)' }}>Pay run not found.</p>;

  const draft = run.status === 'DRAFT';
  const busy = action.isPending;

  return (
    <div>
      <Link href="/admin/payroll" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#007AFF', textDecoration: 'none', marginBottom: 12 }}>
        <ArrowLeft size={14} strokeWidth={1.5} /> Payroll
      </Link>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wallet size={20} color="#007AFF" strokeWidth={1.5} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Pay Run · {day(run.pay_date)}</h1>
            <Pill value={run.status} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Period {day(run.period_start)} – {day(run.period_end)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {draft && (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={() => action.mutate(() => payrollApi.recalculate(id))} title="Pull in the latest logged hours and employee settings">
                <RefreshCw size={15} strokeWidth={1.5} /> Recalculate
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm('Delete this draft pay run?')) remove.mutate(); }} style={{ color: '#FF3B30' }}>
                <Trash2 size={15} strokeWidth={1.5} /> Delete
              </button>
              <button className="btn btn-primary" disabled={busy || run.stubs.length === 0}
                onClick={() => { if (confirm('Finalize this pay run? Amounts will be locked.')) action.mutate(() => payrollApi.finalize(id)); }}>
                <Lock size={15} strokeWidth={1.5} /> Finalize
              </button>
            </>
          )}
          {run.status === 'FINALIZED' && (
            <button className="btn btn-primary" disabled={busy} onClick={() => action.mutate(() => payrollApi.markPaid(id))}>
              <CheckCircle2 size={15} strokeWidth={1.5} /> Mark Paid
            </button>
          )}
          {!draft && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm('Reopen as a draft so amounts can be changed?')) action.mutate(() => payrollApi.reopen(id)); }}>
              <RotateCcw size={15} strokeWidth={1.5} /> Reopen
            </button>
          )}
          <button className="btn btn-ghost" onClick={exportCsv}><Download size={15} strokeWidth={1.5} /> CSV</button>
        </div>
      </div>

      {draft && run.pending_time_entries > 0 && (
        <div style={{ background: 'rgba(255,149,0,0.10)', border: '1px solid rgba(255,149,0,0.35)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#8a4a00' }}>
          {run.pending_time_entries} crew {run.pending_time_entries === 1 ? 'shift' : 'shifts'} in this period {run.pending_time_entries === 1 ? 'is' : 'are'} not approved yet and {run.pending_time_entries === 1 ? 'is' : 'are'} not included.{' '}
          <Link href="/admin/employees?tab=hours" style={{ color: '#007AFF', fontWeight: 600 }}>Review time</Link>, then Recalculate.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          ['Gross Pay', run.total_gross],
          ['Withholding & Deductions', run.total_deductions],
          ['Net Pay', run.total_net],
          ['Employer Taxes', run.total_employer_taxes],
          ['Total Cost', n(run.total_gross) + n(run.total_employer_taxes) + run.stubs.reduce((t, s) => t + n(s.reimbursement), 0)],
        ].map(([label, v]) => (
          <div key={label as string} className="glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{money(v)}</div>
          </div>
        ))}
      </div>

      <div className="glass" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Employee</th><th>Hours</th><th>Gross</th><th>Taxes</th><th>Other</th><th>Net Pay</th><th>Paid By</th><th /></tr>
          </thead>
          <tbody>
            {run.stubs.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 32 }}>
                No active employees for this period. Add employees, then Recalculate.
              </td></tr>
            )}
            {run.stubs.map((s) => {
              const taxes = n(s.federal_withholding) + n(s.state_withholding) + n(s.social_security) + n(s.medicare);
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.employee.first_name} {s.employee.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {s.worker_type === 'W2' ? 'W-2' : '1099'} · {s.pay_type === 'HOURLY' ? `${money(s.pay_rate)}/hr` : `${money(s.pay_rate)}/yr`}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {hours(s.regular_hours)}{n(s.overtime_hours) > 0 && <span style={{ color: '#b35f00' }}> + {hours(s.overtime_hours)} OT</span>}
                  </td>
                  <td>{money(s.gross_pay)}{n(s.bonus) > 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>incl. {money(s.bonus)} bonus</div>}</td>
                  <td style={{ color: 'rgba(0,0,0,0.6)' }}>{money(taxes)}</td>
                  <td style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
                    {n(s.other_deductions) > 0 && <div>-{money(s.other_deductions)}</div>}
                    {n(s.reimbursement) > 0 && <div>+{money(s.reimbursement)}</div>}
                    {n(s.other_deductions) === 0 && n(s.reimbursement) === 0 && '—'}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{money(s.net_pay)}</td>
                  <td style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>
                    {s.payment_method ? `${s.payment_method.charAt(0)}${s.payment_method.slice(1).toLowerCase()}${s.check_number ? ` #${s.check_number}` : ''}` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setEditing(s)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 6 }}>
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      <button onClick={() => setPrinting(s)} title="Pay stub" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 6 }}>
                        <Printer size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
        Federal and Iowa withholding use each employee&apos;s flat percentage and are estimates. Overtime is 1.5x over 40 hours per Sunday–Saturday week within this period.
      </p>

      {editing && <StubEditor run={run} stub={editing} onClose={() => setEditing(null)} onSaved={(res) => { setRun(res); setEditing(null); }} />}
      {printing && <PayStubView run={run} stub={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

function StubEditor({ run, stub, onClose, onSaved }: {
  run: Run; stub: Stub; onClose: () => void; onSaved: (res: { data: { data: Run } }) => void;
}) {
  const draft = run.status === 'DRAFT';
  const [f, setF] = useState({
    regular_hours: String(n(stub.regular_hours)),
    overtime_hours: String(n(stub.overtime_hours)),
    bonus: String(n(stub.bonus)),
    reimbursement: String(n(stub.reimbursement)),
    other_deductions: String(n(stub.other_deductions)),
    other_deductions_note: stub.other_deductions_note || '',
    payment_method: stub.payment_method || '',
    check_number: stub.check_number || '',
    notes: stub.notes || '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        payment_method: f.payment_method, check_number: f.check_number, notes: f.notes,
      };
      if (draft) {
        if (stub.pay_type === 'HOURLY') {
          payload.regular_hours = f.regular_hours;
          payload.overtime_hours = f.overtime_hours;
        }
        Object.assign(payload, { bonus: f.bonus, reimbursement: f.reimbursement, other_deductions: f.other_deductions, other_deductions_note: f.other_deductions_note });
      }
      return payrollApi.updateStub(run.id, stub.id, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setError(errMsg(e, 'Failed to save.')),
  });

  const num = (k: keyof typeof f, label: string, step = '0.01') => (
    <Field label={label}>
      <input className="glass-input" style={inputStyle} type="number" min="0" step={step} value={f[k]} onChange={set(k)} disabled={!draft} />
    </Field>
  );

  return (
    <Modal title={`${stub.employee.first_name} ${stub.employee.last_name}`} onClose={onClose} maxWidth={520}>
      {!draft && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>This run is {run.status.toLowerCase()}. Reopen it to change amounts; payment details can still be recorded.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
        {stub.pay_type === 'HOURLY' ? (
          <>
            {num('regular_hours', 'Regular Hours', '0.25')}
            {num('overtime_hours', 'Overtime Hours', '0.25')}
          </>
        ) : null}
        {num('bonus', 'Bonus (taxable)')}
        {num('reimbursement', 'Reimbursement (not taxed)')}
        {num('other_deductions', 'Other Deductions')}
        <Field label="Deduction Note"><input className="glass-input" style={inputStyle} value={f.other_deductions_note} onChange={set('other_deductions_note')} disabled={!draft} placeholder="Advance, uniform..." /></Field>
        <Field label="Paid By">
          <select className="glass-input" style={inputStyle} value={f.payment_method} onChange={set('payment_method')}>
            <option value="">Not recorded</option><option value="CHECK">Check</option><option value="TRANSFER">Direct deposit / transfer</option><option value="CASH">Cash</option>
          </select>
        </Field>
        <Field label="Check #"><input className="glass-input" style={inputStyle} value={f.check_number} onChange={set('check_number')} /></Field>
      </div>
      <Field label="Notes"><input className="glass-input" style={inputStyle} value={f.notes} onChange={set('notes')} /></Field>
      {stub.pay_type === 'HOURLY' && draft && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Editing hours here overrides the logged hours for this run. Recalculate resets them from the time log.</p>
      )}
      {error && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function PayStubView({ run, stub, onClose }: { run: Run; stub: Stub; onClose: () => void }) {
  const row = (label: string, v: unknown, opts: { neg?: boolean; bold?: boolean } = {}) => (
    <tr>
      <td style={{ padding: '5px 0', color: opts.bold ? '#111' : '#444', fontWeight: opts.bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: opts.bold ? 700 : 400 }}>{opts.neg && n(v) > 0 ? `-${money(v)}` : money(v)}</td>
    </tr>
  );
  return (
    <Modal title="Pay Stub" onClose={onClose} maxWidth={560}>
      <div id="pay-stub-print" style={{ background: '#fff', color: '#111', padding: 20, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>OPN Renovation</div>
            <div style={{ color: '#555' }}>Earnings Statement</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Pay date: <strong>{day(run.pay_date)}</strong></div>
            <div style={{ color: '#555' }}>Period: {day(run.period_start)} – {day(run.period_end)}</div>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>{stub.employee.first_name} {stub.employee.last_name}</div>
          {stub.employee.position && <div style={{ color: '#555' }}>{stub.employee.position}</div>}
          {stub.employee.address && <div style={{ color: '#555' }}>{stub.employee.address}</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td colSpan={2} style={{ fontWeight: 700, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Earnings</td></tr>
            {stub.pay_type === 'HOURLY'
              ? row(`Regular ${hours(stub.regular_hours)} h × ${money(stub.pay_rate)}`, stub.regular_pay)
              : row('Salary', stub.regular_pay)}
            {n(stub.overtime_hours) > 0 && row(`Overtime ${hours(stub.overtime_hours)} h × ${money(n(stub.pay_rate) * 1.5)}`, stub.overtime_pay)}
            {n(stub.bonus) > 0 && row('Bonus', stub.bonus)}
            {row('Gross pay', stub.gross_pay, { bold: true })}
            <tr><td colSpan={2} style={{ fontWeight: 700, borderBottom: '1px solid #ddd', padding: '12px 0 4px' }}>Deductions</td></tr>
            {stub.worker_type === 'W2' ? (
              <>
                {row('Federal income tax', stub.federal_withholding, { neg: true })}
                {row('Iowa income tax', stub.state_withholding, { neg: true })}
                {row('Social Security', stub.social_security, { neg: true })}
                {row('Medicare', stub.medicare, { neg: true })}
              </>
            ) : (
              <tr><td colSpan={2} style={{ padding: '5px 0', color: '#555' }}>Independent contractor: no taxes withheld</td></tr>
            )}
            {n(stub.other_deductions) > 0 && row(stub.other_deductions_note || 'Other', stub.other_deductions, { neg: true })}
            {n(stub.reimbursement) > 0 && (
              <>
                <tr><td colSpan={2} style={{ fontWeight: 700, borderBottom: '1px solid #ddd', padding: '12px 0 4px' }}>Reimbursements</td></tr>
                {row('Reimbursement', stub.reimbursement)}
              </>
            )}
            <tr><td colSpan={2} style={{ borderBottom: '2px solid #111', paddingTop: 8 }} /></tr>
            {row('Net pay', stub.net_pay, { bold: true })}
          </tbody>
        </table>
        {stub.payment_method && (
          <p style={{ marginTop: 12, color: '#555' }}>
            Paid by {stub.payment_method.toLowerCase()}{stub.check_number ? `, check #${stub.check_number}` : ''}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.5} /> Print
        </button>
      </div>
    </Modal>
  );
}

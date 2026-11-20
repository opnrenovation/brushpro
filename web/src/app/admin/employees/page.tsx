'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardHat, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { employeesApi } from '@/lib/api';
import TimeCards from '@/components/admin/TimeCards';
import {
  Modal, Field, Pill, FilterChips, PageHeader, inputStyle, money, day, isoDay, todayIso, errMsg,
} from '@/components/admin/ui';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  worker_type: 'W2' | 'CONTRACTOR_1099';
  pay_type: 'HOURLY' | 'SALARY';
  pay_rate: string;
  overtime_eligible: boolean;
  federal_withholding_pct: string;
  state_withholding_pct: string;
  hire_date: string | null;
  termination_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  app_access: boolean;
  has_pin: boolean;
  pin_locked: boolean;
  last_app_login_at: string | null;
}


const emptyEmployee = {
  first_name: '', last_name: '', email: '', phone: '', address: '', position: '',
  status: 'ACTIVE', worker_type: 'W2', pay_type: 'HOURLY', pay_rate: '', overtime_eligible: true,
  federal_withholding_pct: '0', state_withholding_pct: '0', hire_date: '', termination_date: '',
  emergency_contact_name: '', emergency_contact_phone: '', notes: '',
  app_access: false, pin: '',
};
type EmployeeForm = typeof emptyEmployee;

const STATUS_FILTERS = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'ALL'] as const;


export default function EmployeesPage() {
  const [tab, setTab] = useState<'people' | 'hours'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'hours' ? 'hours' : 'people');
  return (
    <div>
      <PageHeader icon={<HardHat size={20} color="#007AFF" strokeWidth={1.5} />} title="Employees" />
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        {([['people', 'Team'], ['hours', 'Time Cards']] as const).map(([k, label]) => (
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
      {tab === 'people' ? <TeamTab /> : <TimeCards />}
    </div>
  );
}

// ── Team ───────────────────────────────────────────────────────────────────

function TeamTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('ACTIVE');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyEmployee);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() });
  const employees: Employee[] = data?.data?.data || [];

  const set = (k: keyof EmployeeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const save = useMutation({
    mutationFn: (f: EmployeeForm) => {
      const payload = {
        ...f,
        pay_rate: Number(f.pay_rate),
        federal_withholding_pct: Number(f.federal_withholding_pct || 0),
        state_withholding_pct: Number(f.state_withholding_pct || 0),
      };
      return editing ? employeesApi.update(editing.id, payload) : employeesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowModal(false);
    },
    onError: (e) => setFormError(errMsg(e, 'Failed to save employee.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
    onError: () => alert('Failed to remove employee.'),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...emptyEmployee, hire_date: todayIso() });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      first_name: e.first_name, last_name: e.last_name, email: e.email || '', phone: e.phone || '',
      address: e.address || '', position: e.position || '', status: e.status, worker_type: e.worker_type,
      pay_type: e.pay_type, pay_rate: String(Number(e.pay_rate)), overtime_eligible: e.overtime_eligible,
      federal_withholding_pct: String(Number(e.federal_withholding_pct)),
      state_withholding_pct: String(Number(e.state_withholding_pct)),
      hire_date: isoDay(e.hire_date), termination_date: isoDay(e.termination_date),
      emergency_contact_name: e.emergency_contact_name || '', emergency_contact_phone: e.emergency_contact_phone || '',
      notes: e.notes || '', app_access: e.app_access, pin: '',
    });
    setFormError('');
    setShowModal(true);
  }

  function submit() {
    if (!form.first_name.trim() || !form.last_name.trim()) return setFormError('First and last name are required.');
    if (!(Number(form.pay_rate) > 0)) return setFormError('Enter a pay rate greater than zero.');
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) return setFormError('PIN must be 4 to 6 digits.');
    setFormError('');
    save.mutate(form);
  }

  const filtered = employees.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      e.position?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
  });

  const isW2 = form.worker_type === 'W2';

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={15} strokeWidth={1.5} color="rgba(0,0,0,0.3)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees..."
            className="glass-input" style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <FilterChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} strokeWidth={1.5} /> New Employee
        </button>
      </div>

      <div className="glass" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Position</th><th>Type</th><th>Pay</th><th>Phone</th><th>Crew App</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'rgba(0,0,0,0.35)', padding: 40 }}>
                {employees.length === 0 ? 'No employees yet. Add your crew to start tracking hours and payroll.' : 'No employees match'}
              </td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.first_name} {e.last_name}</td>
                <td style={{ color: 'rgba(0,0,0,0.6)', fontSize: 13 }}>{e.position || '—'}</td>
                <td style={{ fontSize: 13 }}>{e.worker_type === 'W2' ? 'W-2' : '1099'}</td>
                <td style={{ fontSize: 13 }}>
                  {e.pay_type === 'HOURLY' ? `${money(e.pay_rate)}/hr` : `${money(e.pay_rate)}/yr`}
                </td>
                <td style={{ color: 'rgba(0,0,0,0.55)', fontSize: 13 }}>{e.phone || '—'}</td>
                <td style={{ fontSize: 13, color: e.app_access ? '#1f8a3b' : 'rgba(0,0,0,0.35)' }}>
                  {e.app_access ? (e.last_app_login_at ? 'On' : 'On · not signed in yet') : '—'}
                </td>
                <td><Pill value={e.status} /></td>
                <td onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(e)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 6 }}>
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove ${e.first_name} ${e.last_name}? Their past pay stubs are kept.`)) remove.mutate(e.id); }}
                      title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', padding: 6 }}>
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? `${editing.first_name} ${editing.last_name}` : 'New Employee'} onClose={() => setShowModal(false)} maxWidth={620}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 12 }}>
            <Field label="First Name *"><input className="glass-input" style={inputStyle} value={form.first_name} onChange={set('first_name')} /></Field>
            <Field label="Last Name *"><input className="glass-input" style={inputStyle} value={form.last_name} onChange={set('last_name')} /></Field>
            <Field label="Position"><input className="glass-input" style={inputStyle} value={form.position} onChange={set('position')} placeholder="Painter, Crew Lead..." /></Field>
            <Field label="Status">
              <select className="glass-input" style={inputStyle} value={form.status} onChange={set('status')}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="TERMINATED">Terminated</option>
              </select>
            </Field>
            <Field label="Phone"><input className="glass-input" style={inputStyle} type="tel" value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Email"><input className="glass-input" style={inputStyle} type="email" value={form.email} onChange={set('email')} /></Field>
          </div>
          <Field label="Address"><input className="glass-input" style={inputStyle} value={form.address} onChange={set('address')} /></Field>

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '16px 0 10px' }}>Pay</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', columnGap: 12 }}>
            <Field label="Worker Type">
              <select className="glass-input" style={inputStyle} value={form.worker_type} onChange={set('worker_type')}>
                <option value="W2">W-2 employee</option><option value="CONTRACTOR_1099">1099 contractor</option>
              </select>
            </Field>
            <Field label="Pay Type">
              <select className="glass-input" style={inputStyle} value={form.pay_type} onChange={set('pay_type')}>
                <option value="HOURLY">Hourly</option><option value="SALARY">Salary</option>
              </select>
            </Field>
            <Field label={form.pay_type === 'HOURLY' ? 'Hourly Rate *' : 'Annual Salary *'}>
              <input className="glass-input" style={inputStyle} type="number" min="0" step="0.01" value={form.pay_rate} onChange={set('pay_rate')} placeholder={form.pay_type === 'HOURLY' ? '25.00' : '52000'} />
            </Field>
          </div>
          {form.pay_type === 'HOURLY' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              <input type="checkbox" checked={form.overtime_eligible} onChange={set('overtime_eligible')} />
              Overtime eligible (1.5x over 40 hours a week)
            </label>
          )}
          {isW2 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
                <Field label="Federal Withholding %">
                  <input className="glass-input" style={inputStyle} type="number" min="0" max="50" step="0.1" value={form.federal_withholding_pct} onChange={set('federal_withholding_pct')} />
                </Field>
                <Field label="Iowa Withholding %">
                  <input className="glass-input" style={inputStyle} type="number" min="0" max="20" step="0.1" value={form.state_withholding_pct} onChange={set('state_withholding_pct')} />
                </Field>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -4, marginBottom: 12 }}>
                Social Security (6.2%) and Medicare (1.45%) are calculated automatically. Set the withholding percentages from the employee&apos;s W-4 and IA W-4.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              1099 contractors are paid gross with no taxes withheld.
            </p>
          )}

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '16px 0 10px' }}>Employment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 12 }}>
            <Field label="Hire Date"><input className="glass-input" style={inputStyle} type="date" value={form.hire_date} onChange={set('hire_date')} /></Field>
            <Field label="End Date"><input className="glass-input" style={inputStyle} type="date" value={form.termination_date} onChange={set('termination_date')} /></Field>
            <Field label="Emergency Contact"><input className="glass-input" style={inputStyle} value={form.emergency_contact_name} onChange={set('emergency_contact_name')} /></Field>
            <Field label="Emergency Phone"><input className="glass-input" style={inputStyle} type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} /></Field>
          </div>
          <Field label="Notes">
            <textarea className="glass-input" style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={form.notes} onChange={set('notes')} />
          </Field>

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '16px 0 10px' }}>Crew App</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            <input type="checkbox" checked={form.app_access} onChange={set('app_access')} />
            Let {form.first_name || 'them'} use the crew app to clock in, fix their time card and see their jobs
          </label>
          {form.app_access && (
            <div style={{ background: 'rgba(0,122,255,0.05)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Field label={editing?.has_pin ? 'New PIN (leave blank to keep the current one)' : 'PIN (4 to 6 digits) *'} style={{ marginBottom: 8 }}>
                <input className="glass-input" style={inputStyle} inputMode="numeric" autoComplete="off" maxLength={6}
                  value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} placeholder="e.g. 4821" />
              </Field>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                They sign in at <strong>www.opnpainting.com/crew</strong> with their {form.email ? 'email' : 'phone'}{form.email && form.phone ? ' or phone' : ''} and this PIN, and can add it to their home screen like an app. Tell them the PIN in person or by text.
                {editing?.pin_locked && <span style={{ color: '#d70015' }}> Locked after too many wrong PINs; setting a new PIN unlocks it.</span>}
                {editing?.last_app_login_at && <> Last signed in {day(editing.last_app_login_at)}.</>}
              </p>
            </div>
          )}

          {editing && <EmployeeYtd id={editing.id} />}

          {formError && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function EmployeeYtd({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ['employee', id], queryFn: () => employeesApi.get(id) });
  const emp = data?.data?.data;
  if (!emp) return null;
  const ytd = emp.ytd || {};
  const stubs: Array<{ id: string; gross_pay: string; net_pay: string; pay_run: { id: string; pay_date: string; status: string } }> = emp.pay_stubs || [];
  return (
    <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>This year (finalized pay runs)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, fontSize: 13 }}>
        <div><div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Gross</div>{money(ytd.gross_pay)}</div>
        <div><div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Net</div>{money(ytd.net_pay)}</div>
        <div><div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Federal</div>{money(ytd.federal_withholding)}</div>
        <div><div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Iowa</div>{money(ytd.state_withholding)}</div>
      </div>
      {stubs.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          Recent: {stubs.slice(0, 4).map((s) => `${day(s.pay_run.pay_date, { month: 'short', day: 'numeric' })} ${money(s.net_pay)}`).join('  ·  ')}
        </div>
      )}
    </div>
  );
}

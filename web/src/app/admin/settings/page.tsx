'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Building, FileText, ScrollText, DollarSign, Package, Calculator, Calendar, Mail, Users, Globe } from 'lucide-react';
import { settingsApi, taxProfilesApi, contractTemplatesApi, usersApi, schedulerApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const SECTIONS = [
  { key: 'branding', label: 'Branding', icon: Building },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'contracts', label: 'Contracts', icon: ScrollText },
  { key: 'billing', label: 'Billing', icon: DollarSign },
  { key: 'pricebook', label: 'Price Book', icon: Package },
  { key: 'tax', label: 'Tax Profiles', icon: Calculator },
  { key: 'scheduler', label: 'Scheduler', icon: Calendar },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'users', label: 'Users', icon: Users },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="glass-input" style={{ width: '100%', padding: '10px 14px', fontSize: 14 }} />
  );
}

function BrandingSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const val = (k: string) => (form[k] !== undefined ? form[k] : settings[k] || '');
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Branding" subtitle="Company identity visible on proposals and invoices" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Company Name"><Input value={val('company_name')} onChange={set('company_name')} /></Field>
        <Field label="License Number"><Input value={val('license_number')} onChange={set('license_number')} /></Field>
        <Field label="Phone"><Input value={val('phone')} onChange={set('phone')} /></Field>
        <Field label="Email"><Input value={val('email')} onChange={set('email')} type="email" /></Field>
        <Field label="Website"><Input value={val('website')} onChange={set('website')} /></Field>
      </div>
      <Field label="Address">
        <textarea value={val('address')} onChange={(e) => set('address')(e.target.value)}
          className="glass-input" style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }} />
      </Field>
      <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {saved ? 'Saved!' : mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function ContractsSection() {
  const { data } = useQuery({ queryKey: ['contract-templates'], queryFn: () => contractTemplatesApi.list() });
  const templates = data?.data?.data || data?.data || [];
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });

  return (
    <div>
      <SectionHeader title="Contract Templates" subtitle="Manage contract templates for proposals" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(templates as { id: string; name: string; is_default: boolean; description: string | null }[]).map((t) => (
          <div key={t.id} className="glass" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{t.name}</div>
              {t.is_default && <span className="pill pill-green" style={{ fontSize: 10 }}>Default</span>}
              {t.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{t.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 12px' }}>Edit</button>
              <button className="btn btn-danger" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => deleteMutation.mutate(t.id)}>Delete</button>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>+ New Template</button>
      </div>
    </div>
  );
}

function BillingSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
  const val = (k: string) => (form[k] !== undefined ? String(form[k]) : String(settings[k] ?? ''));
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Billing" subtitle="Configure deposit and payment settings" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Deposit Percentage (%)"><Input value={val('deposit_percentage')} onChange={set('deposit_percentage')} type="number" /></Field>
        <Field label="Minimum Deposit ($)"><Input value={val('deposit_minimum_amount')} onChange={set('deposit_minimum_amount')} type="number" placeholder="Optional floor" /></Field>
        <Field label="Payment Terms (days)"><Input value={val('payment_terms_days')} onChange={set('payment_terms_days')} type="number" /></Field>
      </div>
      <Field label="Deposit Message">
        <textarea value={val('deposit_message')} onChange={(e) => set('deposit_message')(e.target.value)}
          className="glass-input" style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 70, resize: 'vertical' }}
          placeholder="e.g. This deposit secures your project start date." />
      </Field>
      <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function TaxSection() {
  const { data } = useQuery({ queryKey: ['tax-profiles'], queryFn: () => taxProfilesApi.list() });
  const profiles = data?.data?.data || data?.data || [];
  return (
    <div>
      <SectionHeader title="Tax Profiles" subtitle="Configure tax rates by municipality" />
      <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
        {profiles.length === 0
          ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No tax profiles. Add one to enable tax on invoices.</div>
          : <table className="data-table">
              <thead><tr><th>Name</th><th>Municipality</th><th>State Rate</th><th>Local Rate</th><th>Default</th></tr></thead>
              <tbody>
                {(profiles as { id: string; name: string; municipality: string; state_rate: number; local_rate: number; is_default: boolean }[]).map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: '#fff', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{p.municipality}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{(Number(p.state_rate) * 100).toFixed(2)}%</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{(Number(p.local_rate) * 100).toFixed(2)}%</td>
                    <td>{p.is_default && <span className="pill pill-green">Default</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
      <button className="btn btn-primary">+ Add Tax Profile</button>
    </div>
  );
}

function UsersSection() {
  const { user } = useAuthStore();
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list(), enabled: user?.role === 'OWNER' });
  const users = data?.data?.data || data?.data || [];

  if (user?.role !== 'OWNER') {
    return (
      <div>
        <SectionHeader title="Users" />
        <div className="glass" style={{ padding: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Only owners can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="User Management" subtitle="Invite and manage team members" />
      <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th></tr></thead>
          <tbody>
            {(users as { id: string; name: string; email: string; role: string; last_login_at: string | null; is_active: boolean }[]).map((u) => (
              <tr key={u.id}>
                <td style={{ color: '#fff', fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{u.email}</td>
                <td><span className={`pill ${u.role === 'OWNER' ? 'pill-blue' : 'pill-muted'}`}>{u.role}</span></td>
                <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td><span className={`pill ${u.is_active ? 'pill-green' : 'pill-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary">Invite User</button>
    </div>
  );
}

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  branding: BrandingSection,
  contracts: ContractsSection,
  billing: BillingSection,
  tax: TaxSection,
  users: UsersSection,
};

export default function SettingsPage() {
  const [section, setSection] = useState('branding');
  const SectionComp = SECTION_COMPONENTS[section];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <Settings size={20} color="#007AFF" strokeWidth={1.5} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Left nav */}
        <div className="glass" style={{ padding: 8, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSection(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
                borderRadius: 10, fontSize: 13, fontWeight: section === key ? 600 : 400, cursor: 'pointer',
                border: 'none', background: section === key ? 'rgba(0,122,255,0.1)' : 'transparent',
                color: section === key ? '#007AFF' : 'rgba(255,255,255,0.6)', marginBottom: 2, textAlign: 'left',
              }}>
              <Icon size={16} strokeWidth={1.5} />{label}
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div className="glass" style={{ padding: 28 }}>
          {SectionComp ? <SectionComp /> : (
            <div>
              <SectionHeader title={SECTIONS.find((s) => s.key === section)?.label || ''} />
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

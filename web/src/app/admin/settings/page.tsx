'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Building, FileText, ScrollText, DollarSign, Package,
  Calculator, Calendar, Mail, Users, Plus, Trash2, Edit2, Upload,
} from 'lucide-react';
import {
  settingsApi, taxProfilesApi, contractTemplatesApi, usersApi,
  schedulerApi, materialItemsApi,
} from '@/lib/api';
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
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function GlassInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="glass-input"
      style={{ width: '100%', padding: '10px 14px', fontSize: 14 }}
    />
  );
}

// ── Branding ──────────────────────────────────────────────────────────────────
function BrandingSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const val = (k: string) => (form[k] !== undefined ? form[k] : settings[k] || '');
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Branding" subtitle="Company identity shown on proposals, estimates, and invoices" />

      {/* Logo upload */}
      <Field label="Company Logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {settings.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="Company logo" style={{ height: 48, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }} />
          )}
          <label style={{ cursor: 'pointer' }}>
            <div className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
              <Upload size={14} strokeWidth={1.5} />
              {logoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
            </div>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) logoMutation.mutate(file);
              }}
            />
          </label>
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Company Name">
          <GlassInput value={val('company_name')} onChange={set('company_name')} placeholder="OPN Renovation" />
        </Field>
        <Field label="License Number">
          <GlassInput value={val('license_number')} onChange={set('license_number')} placeholder="LIC-12345" />
        </Field>
        <Field label="Phone">
          <GlassInput value={val('phone')} onChange={set('phone')} placeholder="(515) 555-1234" />
        </Field>
        <Field label="Email">
          <GlassInput value={val('email')} onChange={set('email')} type="email" placeholder="info@opnrenovation.com" />
        </Field>
        <Field label="Website">
          <GlassInput value={val('website')} onChange={set('website')} placeholder="https://opnrenovation.com" />
        </Field>
      </div>
      <Field label="Address">
        <textarea
          value={val('address')}
          onChange={(e) => set('address')(e.target.value)}
          className="glass-input"
          style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }}
          placeholder="123 Main St, Des Moines, IA 50309"
        />
      </Field>
      <button
        className="btn btn-primary"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {saved ? 'Saved!' : mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Documents ─────────────────────────────────────────────────────────────────
function DocumentsSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const val = (k: string) => (form[k] !== undefined ? form[k] : settings[k] || '');
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Documents" subtitle="Configure default prefixes and notes for invoices and estimates" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Invoice Number Prefix">
          <GlassInput value={val('invoice_prefix')} onChange={set('invoice_prefix')} placeholder="INV-" />
        </Field>
        <Field label="Estimate Number Prefix">
          <GlassInput value={val('estimate_prefix')} onChange={set('estimate_prefix')} placeholder="EST-" />
        </Field>
      </div>
      <Field label="Default Invoice Notes">
        <textarea
          value={val('invoice_notes')}
          onChange={(e) => set('invoice_notes')(e.target.value)}
          className="glass-input"
          style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }}
          placeholder="Thank you for your business!"
        />
      </Field>
      <Field label="Default Estimate Notes">
        <textarea
          value={val('estimate_notes')}
          onChange={(e) => set('estimate_notes')(e.target.value)}
          className="glass-input"
          style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }}
          placeholder="This estimate is valid for 30 days."
        />
      </Field>
      <button
        className="btn btn-primary"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {saved ? 'Saved!' : mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Contracts ─────────────────────────────────────────────────────────────────
function ContractsSection() {
  const { data } = useQuery({ queryKey: ['contract-templates'], queryFn: () => contractTemplatesApi.list() });
  const templates = data?.data?.data || data?.data || [];
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<{ id?: string; name: string; body: string; description: string; is_default: boolean } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contract-templates'] }),
  });

  const saveMutation = useMutation({
    mutationFn: (t: typeof editTemplate) => {
      if (!t) return Promise.reject();
      if (t.id) return contractTemplatesApi.update(t.id, t);
      return contractTemplatesApi.create(t);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
      setShowModal(false);
      setEditTemplate(null);
    },
  });

  return (
    <div>
      <SectionHeader title="Contract Templates" subtitle="Manage contract templates attached to proposals" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {(templates as { id: string; name: string; is_default: boolean; description: string | null }[]).map((t) => (
          <div key={t.id} className="glass" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                {t.is_default && <span className="pill pill-green" style={{ fontSize: 10 }}>Default</span>}
              </div>
              {t.description && <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>{t.description}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: '6px 12px' }}
                onClick={() => {
                  setEditTemplate({ id: t.id, name: t.name, body: '', description: t.description || '', is_default: t.is_default });
                  setShowModal(true);
                }}
              >
                <Edit2 size={13} strokeWidth={1.5} /> Edit
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: 13, padding: '6px 12px' }}
                onClick={() => deleteMutation.mutate(t.id)}
              >
                <Trash2 size={13} strokeWidth={1.5} /> Delete
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="glass" style={{ padding: 32, textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>
            No contract templates yet.
          </div>
        )}
      </div>
      <button
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => { setEditTemplate({ name: '', body: '', description: '', is_default: false }); setShowModal(true); }}
      >
        <Plus size={15} strokeWidth={1.5} /> New Template
      </button>

      {/* Modal */}
      {showModal && editTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 640, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18, marginBottom: 20 }}>
              {editTemplate.id ? 'Edit Template' : 'New Contract Template'}
            </h3>
            <Field label="Template Name">
              <GlassInput value={editTemplate.name} onChange={(v) => setEditTemplate((t) => t && { ...t, name: v })} placeholder="Standard Contract" />
            </Field>
            <Field label="Description">
              <GlassInput value={editTemplate.description} onChange={(v) => setEditTemplate((t) => t && { ...t, description: v })} placeholder="Optional description" />
            </Field>
            <Field label="Contract Body">
              <textarea
                value={editTemplate.body}
                onChange={(e) => setEditTemplate((t) => t && { ...t, body: e.target.value })}
                className="glass-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: 13, minHeight: 200, resize: 'vertical', fontFamily: 'Menlo, monospace' }}
                placeholder="Enter the full contract text here. Use {{customer_name}}, {{project_address}}, {{total_price}} as placeholders."
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editTemplate.is_default}
                onChange={(e) => setEditTemplate((t) => t && { ...t, is_default: e.target.checked })}
                style={{ accentColor: '#007AFF', width: 16, height: 16 }}
              />
              <span style={{ color: 'rgba(0,0,0,0.7)', fontSize: 14 }}>Set as default template</span>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); setEditTemplate(null); }} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => saveMutation.mutate(editTemplate)}
                disabled={saveMutation.isPending || !editTemplate.name.trim()}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Billing ───────────────────────────────────────────────────────────────────
function BillingSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const val = (k: string) => (form[k] !== undefined ? String(form[k]) : String(settings[k] ?? ''));
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Billing" subtitle="Configure deposit and payment settings" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Deposit Percentage (%)">
          <GlassInput value={val('deposit_percentage')} onChange={set('deposit_percentage')} type="number" placeholder="25" />
        </Field>
        <Field label="Minimum Deposit ($)">
          <GlassInput value={val('deposit_minimum_amount')} onChange={set('deposit_minimum_amount')} type="number" placeholder="Optional floor" />
        </Field>
        <Field label="Payment Terms (days)">
          <GlassInput value={val('payment_terms_days')} onChange={set('payment_terms_days')} type="number" placeholder="30" />
        </Field>
        <Field label="Estimate Expiry (days)">
          <GlassInput value={val('estimate_expiry_days')} onChange={set('estimate_expiry_days')} type="number" placeholder="30" />
        </Field>
      </div>
      <Field label="Deposit Message">
        <textarea
          value={val('deposit_message')}
          onChange={(e) => set('deposit_message')(e.target.value)}
          className="glass-input"
          style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 70, resize: 'vertical' }}
          placeholder="e.g. This deposit secures your project start date."
        />
      </Field>
      <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {saved ? 'Saved!' : mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Price Book ────────────────────────────────────────────────────────────────
function PriceBookSection() {
  const { data } = useQuery({ queryKey: ['material-items'], queryFn: () => materialItemsApi.list() });
  const items = data?.data?.data || data?.data || [];
  const qc = useQueryClient();

  const [newItem, setNewItem] = useState({ name: '', unit: '', unit_cost: '', description: '' });
  const [adding, setAdding] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => materialItemsApi.create({
      ...newItem,
      unit_cost: parseFloat(newItem.unit_cost) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-items'] });
      setNewItem({ name: '', unit: '', unit_cost: '', description: '' });
      setAdding(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => materialItemsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['material-items'] }),
  });

  return (
    <div>
      <SectionHeader title="Price Book" subtitle="Manage standard material items and labor rates" />
      <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
        {items.length === 0 && !adding ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>
            No items yet. Add your first material item.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Unit</th><th>Unit Cost</th><th>Description</th><th></th></tr>
            </thead>
            <tbody>
              {(items as { id: string; name: string; unit: string; unit_cost: number; description: string | null }[]).map((item) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ color: 'rgba(0,0,0,0.6)' }}>{item.unit}</td>
                  <td style={{ fontFamily: 'Menlo,monospace', color: '#34C759' }}>${Number(item.unit_cost).toFixed(2)}</td>
                  <td style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>{item.description || '—'}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <tr>
                  <td>
                    <input
                      value={newItem.name}
                      onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
                      placeholder="Item name"
                      className="glass-input"
                      style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      value={newItem.unit}
                      onChange={(e) => setNewItem((n) => ({ ...n, unit: e.target.value }))}
                      placeholder="gal, hr, sq ft"
                      className="glass-input"
                      style={{ padding: '6px 10px', fontSize: 13, width: '80px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={newItem.unit_cost}
                      onChange={(e) => setNewItem((n) => ({ ...n, unit_cost: e.target.value }))}
                      placeholder="0.00"
                      className="glass-input"
                      style={{ padding: '6px 10px', fontSize: 13, width: '80px' }}
                    />
                  </td>
                  <td>
                    <input
                      value={newItem.description}
                      onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))}
                      placeholder="Optional"
                      className="glass-input"
                      style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '5px 10px' }}
                        onClick={() => createMutation.mutate()}
                        disabled={!newItem.name.trim() || createMutation.isPending}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '5px 10px' }}
                        onClick={() => setAdding(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {!adding && (
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={15} strokeWidth={1.5} /> Add Item
        </button>
      )}
    </div>
  );
}

// ── Tax Profiles ──────────────────────────────────────────────────────────────
function TaxSection() {
  const { data } = useQuery({ queryKey: ['tax-profiles'], queryFn: () => taxProfilesApi.list() });
  const profiles = data?.data?.data || data?.data || [];
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', municipality: '', state_rate: '', local_rate: '', is_default: false });

  const createMutation = useMutation({
    mutationFn: () => taxProfilesApi.create({
      ...newProfile,
      state_rate: parseFloat(newProfile.state_rate) / 100 || 0,
      local_rate: parseFloat(newProfile.local_rate) / 100 || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-profiles'] });
      setAdding(false);
      setNewProfile({ name: '', municipality: '', state_rate: '', local_rate: '', is_default: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taxProfilesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-profiles'] }),
  });

  return (
    <div>
      <SectionHeader title="Tax Profiles" subtitle="Configure tax rates by municipality" />
      <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
        {profiles.length === 0 && !adding ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>
            No tax profiles. Add one to enable tax on invoices.
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Municipality</th><th>State Rate</th><th>Local Rate</th><th>Default</th><th></th></tr></thead>
            <tbody>
              {(profiles as { id: string; name: string; municipality: string; state_rate: number; local_rate: number; is_default: boolean }[]).map((p) => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ color: 'rgba(0,0,0,0.6)' }}>{p.municipality}</td>
                  <td style={{ color: 'rgba(0,0,0,0.6)' }}>{(Number(p.state_rate) * 100).toFixed(3)}%</td>
                  <td style={{ color: 'rgba(0,0,0,0.6)' }}>{(Number(p.local_rate) * 100).toFixed(3)}%</td>
                  <td>{p.is_default && <span className="pill pill-green">Default</span>}</td>
                  <td>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <tr>
                  <td><input value={newProfile.name} onChange={(e) => setNewProfile((n) => ({ ...n, name: e.target.value }))} placeholder="Des Moines" className="glass-input" style={{ padding: '6px 10px', fontSize: 13, width: '100%' }} /></td>
                  <td><input value={newProfile.municipality} onChange={(e) => setNewProfile((n) => ({ ...n, municipality: e.target.value }))} placeholder="Municipality" className="glass-input" style={{ padding: '6px 10px', fontSize: 13, width: '120px' }} /></td>
                  <td><input type="number" value={newProfile.state_rate} onChange={(e) => setNewProfile((n) => ({ ...n, state_rate: e.target.value }))} placeholder="6.0" className="glass-input" style={{ padding: '6px 10px', fontSize: 13, width: '70px' }} /></td>
                  <td><input type="number" value={newProfile.local_rate} onChange={(e) => setNewProfile((n) => ({ ...n, local_rate: e.target.value }))} placeholder="1.0" className="glass-input" style={{ padding: '6px 10px', fontSize: 13, width: '70px' }} /></td>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={newProfile.is_default} onChange={(e) => setNewProfile((n) => ({ ...n, is_default: e.target.checked }))} style={{ accentColor: '#007AFF' }} />
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>Default</span>
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => createMutation.mutate()} disabled={!newProfile.name.trim() || createMutation.isPending}>Save</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setAdding(false)}>Cancel</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {!adding && (
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={15} strokeWidth={1.5} /> Add Tax Profile
        </button>
      )}
    </div>
  );
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function SchedulerSection() {
  const { data: settingsData } = useQuery({ queryKey: ['scheduler-settings'], queryFn: () => schedulerApi.getSettings() });
  const { data: typesData } = useQuery({ queryKey: ['appointment-types'], queryFn: () => schedulerApi.getAppointmentTypes() });
  const { data: rulesData } = useQuery({ queryKey: ['availability-rules'], queryFn: () => schedulerApi.getAvailabilityRules() });

  const schedulerSettings = settingsData?.data?.data || settingsData?.data || {};
  const types = typesData?.data?.data || typesData?.data || [];
  const rules = rulesData?.data?.data || rulesData?.data || [];

  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: () => schedulerApi.updateSettings({ ...schedulerSettings, ...form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-settings'] }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => schedulerApi.deleteAvailabilityRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability-rules'] }),
  });

  const val = (k: string) => (form[k] !== undefined ? form[k] : String(schedulerSettings[k] ?? ''));
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div>
      <SectionHeader title="Scheduler" subtitle="Configure online booking settings and availability" />

      {/* Settings */}
      <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <h3 style={{ color: 'rgba(0,0,0,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Booking Rules
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Field label="Buffer (minutes)">
            <GlassInput value={val('buffer_minutes')} onChange={set('buffer_minutes')} type="number" placeholder="15" />
          </Field>
          <Field label="Min Notice (hours)">
            <GlassInput value={val('min_notice_hours')} onChange={set('min_notice_hours')} type="number" placeholder="24" />
          </Field>
          <Field label="Booking Window (days)">
            <GlassInput value={val('booking_window_days')} onChange={set('booking_window_days')} type="number" placeholder="60" />
          </Field>
        </div>
        <button className="btn btn-primary" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} style={{ marginTop: 8 }}>
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Appointment Types */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Appointment Types</h3>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {types.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>No appointment types configured.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Duration</th><th>Active</th></tr></thead>
              <tbody>
                {(types as { id: string; name: string; duration_minutes: number; is_active: boolean }[]).map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ color: 'rgba(0,0,0,0.6)' }}>{t.duration_minutes} min</td>
                    <td><span className={`pill ${t.is_active ? 'pill-green' : 'pill-muted'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Availability Rules */}
      <div>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Availability Rules</h3>
        <div className="glass" style={{ overflow: 'hidden' }}>
          {rules.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>No availability rules configured.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Active</th><th></th></tr></thead>
              <tbody>
                {(rules as { id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean }[]).map((r) => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{DAYS[r.day_of_week]}</td>
                    <td style={{ color: 'rgba(0,0,0,0.6)' }}>{r.start_time}</td>
                    <td style={{ color: 'rgba(0,0,0,0.6)' }}>{r.end_time}</td>
                    <td><span className={`pill ${r.is_active ? 'pill-green' : 'pill-muted'}`}>{r.is_active ? 'Active' : 'Off'}</span></td>
                    <td>
                      <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => deleteRuleMutation.mutate(r.id)}>
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Email ─────────────────────────────────────────────────────────────────────
function EmailSection() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const settings = data?.data?.data || data?.data || {};
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => settingsApi.update({ ...settings, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const val = (k: string) => (form[k] !== undefined ? form[k] : settings[k] || '');
  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <SectionHeader title="Email Settings" subtitle="Configure the FROM address and reply-to for all outgoing emails" />
      <Field label="FROM Name">
        <GlassInput value={val('email_from_name')} onChange={set('email_from_name')} placeholder="OPN Renovation" />
      </Field>
      <Field label="FROM Email Address">
        <GlassInput value={val('email_from_address')} onChange={set('email_from_address')} type="email" placeholder="noreply@opnrenovation.com" />
      </Field>
      <Field label="Reply-To Address">
        <GlassInput value={val('email_reply_to')} onChange={set('email_reply_to')} type="email" placeholder="info@opnrenovation.com" />
      </Field>
      <div style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#FF9500', lineHeight: 1.6 }}>
        All emails are sent via Resend. Make sure your domain is verified in the Resend dashboard before changing the FROM address.
      </div>
      <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {saved ? 'Saved!' : mutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────
function UsersSection() {
  const { user } = useAuthStore();
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list(), enabled: user?.role === 'OWNER' });
  const users = data?.data?.data || data?.data || [];
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('ADMIN');
  const [showInvite, setShowInvite] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite({ email: inviteEmail, name: inviteName, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setInviteEmail('');
      setInviteName('');
      setShowInvite(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      usersApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (user?.role !== 'OWNER') {
    return (
      <div>
        <SectionHeader title="Users" />
        <div className="glass" style={{ padding: 24 }}>
          <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>Only owners can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="User Management" subtitle="Invite and manage team members" />
      <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(users as { id: string; name: string; email: string; role: string; last_login_at: string | null; is_active: boolean }[]).map((u) => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: 'rgba(0,0,0,0.6)', fontSize: 13 }}>{u.email}</td>
                <td><span className={`pill ${u.role === 'OWNER' ? 'pill-blue' : 'pill-muted'}`}>{u.role}</span></td>
                <td style={{ color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                <td><span className={`pill ${u.is_active ? 'pill-green' : 'pill-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  {u.id !== user.id && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => deactivateMutation.mutate({ id: u.id, is_active: !u.is_active })}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
        <Plus size={15} strokeWidth={1.5} /> Invite User
      </button>

      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Invite Team Member</h3>
            <Field label="Full Name">
              <GlassInput value={inviteName} onChange={setInviteName} placeholder="Jane Smith" />
            </Field>
            <Field label="Email Address">
              <GlassInput value={inviteEmail} onChange={setInviteEmail} type="email" placeholder="jane@opnrenovation.com" />
            </Field>
            <Field label="Role">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="glass-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: 14, appearance: 'none' }}
              >
                <option value="ADMIN" style={{ background: '#1a1a2e' }}>Admin</option>
                <option value="OWNER" style={{ background: '#1a1a2e' }}>Owner</option>
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail.trim() || !inviteName.trim() || inviteMutation.isPending}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  branding: BrandingSection,
  documents: DocumentsSection,
  contracts: ContractsSection,
  billing: BillingSection,
  pricebook: PriceBookSection,
  tax: TaxSection,
  scheduler: SchedulerSection,
  email: EmailSection,
  users: UsersSection,
};

export default function SettingsPage() {
  const [section, setSection] = useState('branding');
  const SectionComp = SECTION_COMPONENTS[section];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
        <Settings size={20} color="#007AFF" strokeWidth={1.5} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Left nav */}
        <div className="glass" style={{ padding: 8, alignSelf: 'flex-start', position: 'sticky', top: 24 }}>
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: section === key ? 600 : 400,
                cursor: 'pointer',
                border: 'none',
                background: section === key ? 'rgba(0,122,255,0.1)' : 'transparent',
                color: section === key ? '#007AFF' : 'rgba(0,0,0,0.6)',
                marginBottom: 2,
                textAlign: 'left',
              }}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div className="glass" style={{ padding: 28 }}>
          {SectionComp ? <SectionComp /> : (
            <div>
              <SectionHeader title={SECTIONS.find((s) => s.key === section)?.label || ''} />
              <p style={{ color: 'rgba(0,0,0,0.4)' }}>This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

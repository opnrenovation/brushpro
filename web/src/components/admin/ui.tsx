'use client';
import { X } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';

// Small shared pieces for the employee, payroll and bug report pages. They
// mirror the inline styles the other admin pages use.

export const money = (v: unknown) =>
  Number(v ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const hours = (v: unknown) => {
  const n = Number(v ?? 0);
  return n % 1 === 0 ? String(n) : n.toFixed(2);
};

// Dates are stored as UTC midnight; format in UTC so they never shift a day.
export const day = (v: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  v ? new Date(v).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' }) : '—';

export const isoDay = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const errMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export const inputStyle: CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 14 };
export const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 6 };

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, maxWidth = 520 }: { title: string; onClose: () => void; children: ReactNode; maxWidth?: number }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass" style={{ width: '100%', maxWidth, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PILL_COLORS: Record<string, [string, string]> = {
  ACTIVE: ['rgba(52,199,89,0.14)', '#1f8a3b'],
  PAID: ['rgba(52,199,89,0.14)', '#1f8a3b'],
  RESOLVED: ['rgba(52,199,89,0.14)', '#1f8a3b'],
  FINALIZED: ['rgba(0,122,255,0.12)', '#007AFF'],
  IN_PROGRESS: ['rgba(0,122,255,0.12)', '#007AFF'],
  DRAFT: ['rgba(255,149,0,0.14)', '#b35f00'],
  OPEN: ['rgba(255,149,0,0.14)', '#b35f00'],
  URGENT: ['rgba(255,59,48,0.12)', '#d70015'],
  HIGH: ['rgba(255,59,48,0.10)', '#d70015'],
  TERMINATED: ['rgba(255,59,48,0.10)', '#d70015'],
};

export function Pill({ value, label }: { value: string; label?: string }) {
  const [bg, fg] = PILL_COLORS[value] || ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.55)'];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: bg, color: fg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {label || value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>>;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.12)',
            background: value === o ? 'rgba(0,122,255,0.15)' : 'rgba(0,0,0,0.05)',
            color: value === o ? '#007AFF' : 'rgba(0,0,0,0.5)',
          }}>
          {labels?.[o] || o.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

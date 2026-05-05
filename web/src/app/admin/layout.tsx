'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Target, Briefcase, Users,
  Mail, BarChart2, Settings, LogOut, Menu, X, Truck, Building2, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/leads',     label: 'Leads',     icon: Target },
  { href: '/admin/jobs',      label: 'Jobs',       icon: Briefcase },
  { href: '/admin/invoices',  label: 'Invoices',   icon: FileText },
  { href: '/admin/contacts',  label: 'Contacts',   icon: Users },
  { href: '/admin/companies', label: 'Companies',  icon: Building2 },
  { href: '/admin/vendors',   label: 'Vendors',    icon: Truck },
  { href: '/admin/marketing', label: 'Marketing',  icon: Mail },
  { href: '/admin/reports',   label: 'Reports',    icon: BarChart2 },
  { href: '/admin/settings',  label: 'Settings',   icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, _hydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const close = () => setSidebarOpen(false);

  if (!_hydrated) return null;

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="admin-layout">

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={22} strokeWidth={1.5} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/opn-logo.png" alt="OPN Renovation" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>BrushPro</span>
        </div>
        {/* spacer to visually center the logo */}
        <div style={{ width: 40 }} />
      </header>

      {/* ── Backdrop (mobile only) ───────────────────────────────────── */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={close} />}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`admin-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        {/* Logo row */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/opn-logo-white.png" alt="OPN Renovation" width={36} height={36} style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>BrushPro</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>OPN Renovation</div>
            </div>
          </div>
          {/* X button — only visible on mobile via CSS */}
          <button className="sidebar-close-btn" onClick={close} aria-label="Close menu" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 12px' }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={close}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                  background: active ? '#2563eb' : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} strokeWidth={1.5} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User / sign-out */}
        {user && (
          <div style={{ padding: '16px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 10px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <LogOut size={15} strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="admin-main">{children}</main>
    </div>
  );
}

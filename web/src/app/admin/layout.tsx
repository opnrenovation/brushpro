'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Target, Briefcase, Users,
  Mail, BarChart2, Settings, LogOut, PaintBucket,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/leads', label: 'Leads', icon: Target },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/contacts', label: 'Contacts', icon: Users },
  { href: '/admin/marketing', label: 'Marketing', icon: Mail },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(0,122,255,0.15)',
              border: '1px solid rgba(0,122,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PaintBucket size={18} color="#007AFF" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>BrushPro</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>OPN Renovation</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px' }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#007AFF' : 'rgba(255,255,255,0.6)',
                  background: active ? 'rgba(0,122,255,0.1)' : 'transparent',
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

        {/* User */}
        {user && (
          <div style={{ padding: '16px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 10px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <LogOut size={15} strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="admin-main">{children}</main>
    </div>
  );
}

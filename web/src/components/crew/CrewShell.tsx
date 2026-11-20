'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Clock, CalendarDays, Briefcase, LogOut } from 'lucide-react';
import { useCrewStore } from '@/stores/crew';

const TABS = [
  { href: '/crew', label: 'Clock', icon: Clock },
  { href: '/crew/timecard', label: 'Time Card', icon: CalendarDays },
  { href: '/crew/jobs', label: 'Jobs', icon: Briefcase },
];

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, employee, logout, _hydrated } = useCrewStore();
  const isLogin = pathname === '/crew/login';

  useEffect(() => {
    if (_hydrated && !token && !isLogin) router.replace('/crew/login');
  }, [_hydrated, token, isLogin, router]);

  if (!_hydrated) return null;
  if (isLogin) return <div className="crew-app">{children}</div>;
  if (!token) return null;

  return (
    <div className="crew-app">
      <header className="crew-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/opn-logo.png" alt="OPN Renovation" width={30} height={30} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>OPN Crew</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{employee?.first_name} {employee?.last_name}</div>
          </div>
        </div>
        <button
          onClick={() => { if (confirm('Sign out of the crew app?')) { logout(); router.replace('/crew/login'); } }}
          aria-label="Sign out"
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', padding: 8, cursor: 'pointer' }}
        >
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </header>

      <main className="crew-main">{children}</main>

      <nav className="crew-tabbar">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/crew' ? pathname === '/crew' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`crew-tab${active ? ' active' : ''}`}>
              <Icon size={22} strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

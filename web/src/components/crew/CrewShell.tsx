'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CalendarDays, Briefcase, CalendarOff, Megaphone, LogOut, Globe } from 'lucide-react';
import { useCrewStore } from '@/stores/crew';
import { crewApi } from '@/lib/crewApi';
import { useT, useLang, LANG_NAME, Lang } from './i18n';
import { flushQueue } from './punch';

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { token, employee, logout, _hydrated } = useCrewStore();
  const { t, lang } = useT();
  const setLang = useLang((s) => s.setLang);
  const isLogin = pathname === '/crew/login';

  const { data: meData } = useQuery({
    queryKey: ['crew', 'me'],
    queryFn: () => crewApi.me(),
    enabled: _hydrated && !!token && !isLogin,
    refetchInterval: 60_000,
  });
  const badges: { news: number; off: number } = meData?.data?.data?.badges || { news: 0, off: 0 };

  useEffect(() => {
    if (_hydrated && !token && !isLogin) router.replace('/crew/login');
  }, [_hydrated, token, isLogin, router]);

  // Punches saved with no signal go out as soon as there is a connection.
  useEffect(() => {
    if (!token) return;
    const send = () => flushQueue().then((n) => { if (n) qc.invalidateQueries({ queryKey: ['crew'] }); });
    send();
    window.addEventListener('online', send);
    const timer = setInterval(send, 30_000);
    return () => { window.removeEventListener('online', send); clearInterval(timer); };
  }, [token, qc]);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const langPicker = (
    <label className="crew-lang" title={t.language}>
      <Globe size={18} strokeWidth={1.5} />
      <select aria-label={t.language} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {(Object.keys(LANG_NAME) as Lang[]).map((l) => <option key={l} value={l}>{LANG_NAME[l]}</option>)}
      </select>
    </label>
  );

  if (!_hydrated) return null;
  if (isLogin) return <div className="crew-app"><div className="crew-login-lang">{langPicker}</div>{children}</div>;
  if (!token) return null;

  const TABS = [
    { href: '/crew', label: t.tabClock, icon: Clock, badge: 0 },
    { href: '/crew/timecard', label: t.tabWeek, icon: CalendarDays, badge: 0 },
    { href: '/crew/jobs', label: t.tabJobs, icon: Briefcase, badge: 0 },
    { href: '/crew/time-off', label: t.tabOff, icon: CalendarOff, badge: badges.off },
    { href: '/crew/news', label: t.tabNews, icon: Megaphone, badge: badges.news },
  ];

  return (
    <div className="crew-app">
      <header className="crew-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/opn-logo.png" alt="OPN Renovation" width={30} height={30} style={{ objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.appName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{employee?.first_name} {employee?.last_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {langPicker}
          <button
            onClick={() => { if (confirm(t.signOutQ)) { logout(); router.replace('/crew/login'); } }}
            aria-label={t.signOut}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', padding: 8, cursor: 'pointer' }}
          >
            <LogOut size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main className="crew-main">{children}</main>

      <nav className="crew-tabbar">
        {TABS.map(({ href, label, icon: Icon, badge }) => {
          const active = href === '/crew' ? pathname === '/crew' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`crew-tab${active ? ' active' : ''}`}>
              <span style={{ position: 'relative' }}>
                <Icon size={22} strokeWidth={1.5} />
                {badge > 0 && <span className="crew-dot">{badge > 9 ? '9+' : badge}</span>}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

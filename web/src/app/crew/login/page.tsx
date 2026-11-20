'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { crewApi } from '@/lib/crewApi';
import { useCrewStore } from '@/stores/crew';

export default function CrewLoginPage() {
  const router = useRouter();
  const { token, setSession } = useCrewStore();
  const [login, setLogin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) router.replace('/crew');
  }, [token, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !pin.trim()) return setError('Enter your email or phone and your PIN.');
    setBusy(true);
    setError('');
    try {
      const res = await crewApi.login(login.trim(), pin.trim());
      setSession(res.data.data.token, res.data.data.employee);
      router.replace('/crew');
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not sign in. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="crew-card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Image src="/opn-logo.png" alt="OPN Renovation" width={64} height={64} style={{ objectFit: 'contain', margin: '0 auto 10px' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>OPN Crew</h1>
          <p className="crew-muted" style={{ marginTop: 4 }}>Clock in, check your hours and see your jobs.</p>
        </div>
        <label className="crew-label" htmlFor="login">Email or phone</label>
        <input id="login" className="crew-input" value={login} onChange={(e) => setLogin(e.target.value)}
          autoComplete="username" autoCapitalize="none" inputMode="email" placeholder="(515) 555-0100" style={{ marginBottom: 14 }} />
        <label className="crew-label" htmlFor="pin">PIN</label>
        <input id="pin" className="crew-input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          type="password" inputMode="numeric" autoComplete="current-password" placeholder="4 to 6 digits" style={{ marginBottom: 18, letterSpacing: 4 }} />
        {error && <p style={{ color: '#FF3B30', fontSize: 14, marginBottom: 14 }}>{error}</p>}
        <button type="submit" className="crew-big-btn" disabled={busy} style={{ background: '#1e40af', padding: 16, fontSize: 16 }}>
          {busy ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="crew-muted" style={{ textAlign: 'center', marginTop: 16 }}>No PIN yet? Ask the office to set one up.</p>
      </form>
    </div>
  );
}

'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  borderRadius: 10,
  background: 'rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.12)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'system-ui, sans-serif',
  transition: 'border-color 0.2s',
};

export default function AdminLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Change password form
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await authApi.login(email, password);
      const { token, user, must_change_password } = res.data;

      setAuth(token, user, must_change_password ?? false);

      if (must_change_password) {
        setMustChange(true);
      } else {
        router.replace('/admin/dashboard');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setChangeError('Password must be at least 8 characters.');
      return;
    }

    setChanging(true);
    setChangeError('');

    try {
      await authApi.changePassword(password, newPassword);
      router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Password change failed.';
      setChangeError(msg);
    } finally {
      setChanging(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F5F7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,122,255,0.08) 0%, transparent 70%), #F5F5F7',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'rgba(0,122,255,0.15)',
              border: '1px solid rgba(0,122,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Lock size={24} strokeWidth={1.5} style={{ color: '#007AFF' }} />
          </div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4 }}>
            OPN Renovation
          </h1>
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>Admin Portal</p>
        </div>

        <div className="glass" style={{ padding: '36px' }}>
          {!mustChange ? (
            <>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Sign In</h2>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'rgba(255,59,48,0.12)',
                    border: '1px solid rgba(255,59,48,0.3)',
                    borderRadius: 10,
                    marginBottom: 20,
                    color: '#FF3B30',
                    fontSize: 14,
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: 'rgba(0,0,0,0.55)', fontSize: 13, marginBottom: 6 }}>
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={16}
                      strokeWidth={1.5}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(0,0,0,0.3)',
                      }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="admin@opnrenovation.com"
                      style={{ ...inputStyle, paddingLeft: 42 }}
                      className="glass-input"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: 'block', color: 'rgba(0,0,0,0.55)', fontSize: 13, marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={16}
                      strokeWidth={1.5}
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(0,0,0,0.3)',
                      }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingLeft: 42, paddingRight: 42 }}
                      className="glass-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '13px' }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div
                style={{
                  background: 'rgba(255,149,0,0.1)',
                  border: '1px solid rgba(255,149,0,0.25)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 24,
                  color: '#FF9500',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                For security, you must set a new password before continuing.
              </div>

              <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Set New Password</h2>

              {changeError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'rgba(255,59,48,0.12)',
                    border: '1px solid rgba(255,59,48,0.3)',
                    borderRadius: 10,
                    marginBottom: 20,
                    color: '#FF3B30',
                    fontSize: 14,
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {changeError}
                </div>
              )}

              <form onSubmit={handleChangePassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: 'rgba(0,0,0,0.55)', fontSize: 13, marginBottom: 6 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={{ display: 'block', color: 'rgba(0,0,0,0.55)', fontSize: 13, marginBottom: 6 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat password"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={changing}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '13px' }}
                >
                  {changing ? (
                    <>
                      <Loader2 size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                      Updating...
                    </>
                  ) : (
                    'Set Password & Continue'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

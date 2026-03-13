'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  PenLine,
  ExternalLink,
  CreditCard,
} from 'lucide-react';

interface EstimateData {
  estimate_number: string;
  project_address: string;
  scope_notes: string;
  total_price: number;
  customer_name: string;
  company_name: string;
  company_logo?: string;
  contract_body?: string;
  deposit_amount?: number;
  stripe_link?: string;
  status: string;
}

type StepType = 'loading' | 'error' | 'view' | 'contract' | 'payment' | 'done';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  outline: 'none',
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

export default function ApprovePage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<StepType>('loading');
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loadError, setLoadError] = useState('');

  // Contract signing
  const [agreed, setAgreed] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  // Canvas signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Payment
  const [payByCheck, setPayByCheck] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/approve/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.message || 'Could not load estimate.');
        }
        return r.json();
      })
      .then((data) => {
        setEstimate(data);
        setStep('view');
      })
      .catch((err) => {
        setLoadError(err.message);
        setStep('error');
      });
  }, [token]);

  // Canvas drawing setup
  useEffect(() => {
    if (step !== 'contract') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / rect.width;
      const scaleY = canvas!.height / rect.height;
      if ('touches' in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawingRef.current = true;
      const pos = getPos(e);
      ctx!.beginPath();
      ctx!.moveTo(pos.x, pos.y);
    }

    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!drawingRef.current) return;
      const pos = getPos(e);
      ctx!.lineTo(pos.x, pos.y);
      ctx!.stroke();
      setHasSignature(true);
    }

    function onEnd() {
      drawingRef.current = false;
    }

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('mouseleave', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [step]);

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function handleSign() {
    if (!agreed || !customerName.trim() || !hasSignature) return;
    setSigning(true);
    setSignError('');

    try {
      const canvas = canvasRef.current;
      const signaturePng = canvas?.toDataURL('image/png') ?? '';

      const res = await fetch(`/api/v1/approve/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_png: signaturePng,
          customer_name: customerName.trim(),
          ip: 'client',
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Signing failed. Please try again.');
      }

      setStep('payment');
    } catch (err: unknown) {
      setSignError(err instanceof Error ? err.message : 'Signing failed.');
    } finally {
      setSigning(false);
    }
  }

  async function handleDecline() {
    if (!confirm('Are you sure you want to decline this estimate?')) return;
    try {
      await fetch(`/api/v1/approve/${token}/decline`, { method: 'POST' });
    } catch {
      // continue regardless
    }
    setStep('done');
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0A0A0F',
    padding: '60px 24px',
    position: 'relative',
    overflow: 'hidden',
  };

  const wrapStyle: React.CSSProperties = {
    maxWidth: 680,
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  };

  if (step === 'loading') {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} strokeWidth={1.5} style={{ color: '#007AFF', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Loading your estimate...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={wrapStyle}>
          <div className="glass" style={{ padding: '48px', textAlign: 'center' }}>
            <AlertCircle size={48} strokeWidth={1.5} style={{ color: '#FF3B30', marginBottom: 20 }} />
            <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Unable to Load Estimate</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 24 }}>{loadError || 'This link may have expired or is invalid.'}</p>
            <a href="tel:+15155551234" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
              Contact Us to Resolve
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,122,255,0.08) 0%, transparent 60%), #0A0A0F',
          zIndex: 0,
        }}
      />

      <div style={wrapStyle}>
        {/* Company header */}
        {estimate && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {estimate.company_logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={estimate.company_logo} alt={estimate.company_name} style={{ height: 48, marginBottom: 12 }} />
            ) : (
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                {estimate.company_name}
              </h2>
            )}
          </div>
        )}

        {/* VIEW STEP */}
        {step === 'view' && estimate && (
          <div className="glass" style={{ padding: '40px' }}>
            <div style={{ marginBottom: 28 }}>
              <span className="pill pill-blue" style={{ marginBottom: 12, display: 'inline-flex' }}>
                Estimate #{estimate.estimate_number}
              </span>
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                Your Estimate
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                Prepared for {estimate.customer_name}
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Project Address
              </p>
              <p style={{ color: '#fff', fontSize: 15 }}>{estimate.project_address}</p>
            </div>

            {estimate.scope_notes && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 20,
                }}
              >
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Scope of Work
                </p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.7 }}>{estimate.scope_notes}</p>
              </div>
            )}

            <div
              style={{
                background: 'rgba(232,168,56,0.08)',
                border: '1px solid rgba(232,168,56,0.25)',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 32,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 500 }}>Total Price</span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#E8A838',
                }}
              >
                ${estimate.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setStep('contract')}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', fontSize: 15, padding: '14px' }}
              >
                <CheckCircle size={18} strokeWidth={1.5} />
                Approve &amp; Sign Contract
              </button>
              <button
                type="button"
                onClick={handleDecline}
                className="btn btn-ghost"
                style={{ padding: '14px 20px' }}
              >
                <XCircle size={18} strokeWidth={1.5} style={{ color: '#FF3B30' }} />
                Decline
              </button>
            </div>
          </div>
        )}

        {/* CONTRACT STEP */}
        {step === 'contract' && estimate && (
          <div className="glass" style={{ padding: '40px' }}>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 28,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 24,
              }}
            >
              Review &amp; Sign Contract
            </h2>

            {/* Contract body */}
            {estimate.contract_body && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 24,
                  maxHeight: 320,
                  overflowY: 'auto',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 13,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {estimate.contract_body}
              </div>
            )}

            {/* Agreement checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                padding: '16px 20px',
                borderRadius: 10,
                border: `1px solid ${agreed ? 'rgba(52,199,89,0.4)' : 'rgba(255,255,255,0.1)'}`,
                background: agreed ? 'rgba(52,199,89,0.06)' : 'rgba(255,255,255,0.03)',
                marginBottom: 24,
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#34C759', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>
                I have read and agree to the terms and conditions of this contract.
              </span>
            </label>

            {/* Signature canvas */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                  <PenLine size={14} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6 }} />
                  Sign below
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={600}
                height={150}
                style={{
                  width: '100%',
                  height: 150,
                  borderRadius: 10,
                  border: `1px solid ${hasSignature ? 'rgba(0,122,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
              />
              {!hasSignature && (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  Draw your signature above using mouse or touch
                </p>
              )}
            </div>

            {/* Full name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 6 }}>
                Full name (type to confirm)
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={estimate.customer_name}
                style={inputStyle}
                className="glass-input"
              />
            </div>

            {signError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  background: 'rgba(255,59,48,0.12)',
                  border: '1px solid rgba(255,59,48,0.3)',
                  borderRadius: 10,
                  marginBottom: 20,
                  color: '#FF3B30',
                  fontSize: 14,
                }}
              >
                <AlertCircle size={16} strokeWidth={1.5} />
                {signError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSign}
              disabled={!agreed || !customerName.trim() || !hasSignature || signing}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: 15,
                padding: '14px',
                opacity: agreed && customerName.trim() && hasSignature ? 1 : 0.4,
              }}
            >
              {signing ? (
                <>
                  <Loader2 size={18} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing...
                </>
              ) : (
                <>
                  <PenLine size={18} strokeWidth={1.5} />
                  Sign Contract
                </>
              )}
            </button>
          </div>
        )}

        {/* PAYMENT STEP */}
        {step === 'payment' && estimate && (
          <div className="glass" style={{ padding: '40px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(52,199,89,0.15)',
                border: '1px solid rgba(52,199,89,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34C759',
                marginBottom: 24,
              }}
            >
              <CheckCircle size={28} strokeWidth={1.5} />
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 28,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 8,
              }}
            >
              Contract Signed
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
              Your contract has been signed. To secure your booking, please submit a deposit.
            </p>

            {estimate.deposit_amount && estimate.deposit_amount > 0 && (
              <div
                style={{
                  background: 'rgba(0,122,255,0.08)',
                  border: '1px solid rgba(0,122,255,0.2)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 24,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Deposit Amount</span>
                <span style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>
                  ${estimate.deposit_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {estimate.stripe_link && (
                <a
                  href={estimate.stripe_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', fontSize: 15, padding: '14px' }}
                >
                  <CreditCard size={18} strokeWidth={1.5} />
                  Pay Deposit Online
                  <ExternalLink size={14} strokeWidth={1.5} />
                </a>
              )}

              <button
                type="button"
                onClick={() => { setPayByCheck(true); setStep('done'); }}
                className="btn btn-ghost"
                style={{ justifyContent: 'center', fontSize: 14 }}
              >
                I will pay by check
              </button>
            </div>

            {payByCheck && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>
                Please make the check out to OPN Renovation. We will contact you with delivery details.
              </p>
            )}
          </div>
        )}

        {/* DONE STEP */}
        {step === 'done' && (
          <div className="glass" style={{ padding: '48px', textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(52,199,89,0.15)',
                border: '1px solid rgba(52,199,89,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34C759',
                margin: '0 auto 24px',
              }}
            >
              <CheckCircle size={36} strokeWidth={1.5} />
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 32,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 12,
              }}
            >
              Booking Confirmed
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 32px' }}>
              Your estimate has been approved and your project is now booked. We will be in touch soon to confirm
              the start date.
            </p>
            <a href="/" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
              Back to Home
            </a>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

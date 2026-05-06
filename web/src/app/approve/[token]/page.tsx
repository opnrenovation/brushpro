'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, AlertCircle, PenLine, Plus, Trash2 } from 'lucide-react';

interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
  taxable: boolean;
}

interface PaintCode {
  name: string;
  code: string;
}

interface EstimateData {
  estimate_number: string;
  customer_name: string;
  job_address: string;
  line_items: LineItem[];
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  tax_exempt: boolean;
  notes?: string | null;
  company_name: string;
  company_logo?: string | null;
  contract_body: string;
  status: string;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_percentage: number;
}

type Step = 'loading' | 'error' | 'view' | 'contract' | 'deposit' | 'done' | 'declined';

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Shared design tokens ─────────────────────────────────────────────────────
const BLUE  = '#1e40af';
const NAVY  = '#1e3a8a';
const LIGHT = '#eff6ff';
const BORD  = '#bfdbfe';
const GRAY  = '#6b7280';
const DARK  = '#0f172a';
const MID   = '#374151';
const GREEN = '#16a34a';

const pg: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f1f5f9',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  color: DARK,
};

const wrap: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '48px 20px 80px',
};

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: '40px',
  marginBottom: 20,
};

const sectionLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: GRAY,
  marginBottom: 8,
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  fontSize: 15,
  borderRadius: 10,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: DARK,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  padding: '14px 28px',
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  background: BLUE,
  color: '#fff',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loadError, setLoadError] = useState('');

  const [paintCodes, setPaintCodes] = useState<PaintCode[]>([]);
  const [clientNotes, setClientNotes] = useState('');

  const [signMethod, setSignMethod] = useState<'pad' | 'type'>('pad');
  const [typedName, setTypedName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/approve/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || 'Could not load estimate.');
        return d;
      })
      .then((data) => { setEstimate(data); setStep('view'); })
      .catch((err) => { setLoadError(err.message); setStep('error'); });
  }, [token]);

  // Canvas setup
  useEffect(() => {
    if (step !== 'contract' || signMethod !== 'pad') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = canvas!.width / rect.width;
      const sy = canvas!.height / rect.height;
      if ('touches' in e) {
        return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
      }
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    }
    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault(); drawingRef.current = true;
      const p = getPos(e); ctx!.beginPath(); ctx!.moveTo(p.x, p.y);
    }
    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!drawingRef.current) return;
      const p = getPos(e); ctx!.lineTo(p.x, p.y); ctx!.stroke(); setHasDrawn(true);
    }
    function onEnd() { drawingRef.current = false; }

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
  }, [step, signMethod]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function addPaintCode() { setPaintCodes(c => [...c, { name: '', code: '' }]); }
  function updatePaintCode(i: number, field: keyof PaintCode, val: string) {
    setPaintCodes(c => c.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }
  function removePaintCode(i: number) { setPaintCodes(c => c.filter((_, idx) => idx !== i)); }

  const canSign = signMethod === 'pad' ? hasDrawn : typedName.trim().length > 2;

  async function handleSign() {
    if (!canSign || !estimate) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      let signaturePng: string | null = null;
      if (signMethod === 'pad') {
        signaturePng = canvasRef.current?.toDataURL('image/png') ?? null;
      }
      const validCodes = paintCodes.filter(p => p.name.trim() || p.code.trim());
      const res = await fetch(`/api/v1/approve/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sign_method: signMethod,
          signature_png: signaturePng,
          customer_name: signMethod === 'type' ? typedName.trim() : estimate.customer_name,
          paint_codes: validCodes.length > 0 ? validCodes : null,
          client_notes: clientNotes.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || 'Signing failed. Please try again.');
      if (d.data?.checkout_url) {
        setCheckoutUrl(d.data.checkout_url);
        setDepositAmount(d.data.deposit_amount || 0);
        setStep('deposit');
      } else {
        setStep('done');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!confirm('Are you sure you want to decline this estimate?')) return;
    try { await fetch(`/api/v1/approve/${token}/decline`, { method: 'POST' }); } catch { /* continue */ }
    setStep('declined');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={{ ...pg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} strokeWidth={1.5} style={{ color: BLUE, marginBottom: 14, animation: 'spin 1s linear infinite' }} />
          <p style={{ color: GRAY, fontSize: 15 }}>Loading your estimate...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={pg}>
        <div style={wrap}>
          <div style={{ ...card, textAlign: 'center', padding: '56px 40px' }}>
            <AlertCircle size={44} strokeWidth={1.5} style={{ color: '#dc2626', marginBottom: 18 }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: DARK, marginBottom: 10 }}>Unable to Load Estimate</h2>
            <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '0 auto' }}>
              {loadError || 'This link may have expired or is invalid.'}
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={pg}>
      <div style={wrap}>

        {/* ── Company header ─────────────────────────────────────────────── */}
        {estimate && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {estimate.company_logo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={estimate.company_logo}
                alt={estimate.company_name}
                style={{ height: 52, marginBottom: 10, objectFit: 'contain' }}
              />
            )}
            <div style={{ fontSize: 20, fontWeight: 700, color: DARK }}>{estimate.company_name}</div>
          </div>
        )}

        {/* ── VIEW STEP ─────────────────────────────────────────────────── */}
        {step === 'view' && estimate && (
          <div style={card}>
            {/* Estimate badge + heading */}
            <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid #e2e8f0` }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: LIGHT, border: `1px solid ${BORD}`,
                borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700,
                color: BLUE, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
              }}>
                Estimate {estimate.estimate_number}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: DARK, marginBottom: 4, lineHeight: 1.25 }}>
                Your Estimate
              </h1>
              <p style={{ color: GRAY, fontSize: 14 }}>Prepared for {estimate.customer_name}</p>
            </div>

            {/* Property */}
            <div style={{ background: LIGHT, border: `1px solid ${BORD}`, borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
              <span style={sectionLabel}>Property Address</span>
              <p style={{ color: DARK, fontSize: 15, margin: 0, fontWeight: 500 }}>{estimate.job_address}</p>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 24 }}>
              <span style={sectionLabel}>Scope of Work</span>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                      <th key={h} style={{
                        padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: GRAY, textAlign: i === 0 ? 'left' : 'right',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estimate.line_items.map((li, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '13px 12px', fontSize: 14, color: DARK }}>{li.description}</td>
                      <td style={{ padding: '13px 12px', fontSize: 14, color: MID, textAlign: 'right' }}>{li.qty}</td>
                      <td style={{ padding: '13px 12px', fontSize: 14, color: MID, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {usd(li.unit_price)}
                      </td>
                      <td style={{ padding: '13px 12px', fontSize: 14, fontWeight: 600, color: DARK, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {usd(li.qty * li.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 280 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                    <span style={{ fontSize: 14, color: GRAY }}>Subtotal</span>
                    <span style={{ fontSize: 14, color: MID, fontVariantNumeric: 'tabular-nums' }}>{usd(estimate.subtotal)}</span>
                  </div>
                  {!estimate.tax_exempt && estimate.tax_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                      <span style={{ fontSize: 14, color: GRAY }}>Sales Tax ({(estimate.tax_rate * 100).toFixed(0)}%)</span>
                      <span style={{ fontSize: 14, color: MID, fontVariantNumeric: 'tabular-nums' }}>{usd(estimate.tax_amount)}</span>
                    </div>
                  )}
                  {estimate.tax_exempt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                      <span style={{ fontSize: 14, color: GRAY }}>Sales Tax</span>
                      <span style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>Exempt</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                    borderTop: '2px solid #e2e8f0', marginTop: 4,
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{usd(estimate.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {estimate.notes && (
              <div style={{
                background: LIGHT, border: `1px solid ${BORD}`,
                borderLeft: `4px solid ${BLUE}`,
                borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 24,
              }}>
                <span style={sectionLabel}>Notes</span>
                <p style={{ color: MID, fontSize: 14, lineHeight: 1.75, margin: 0 }}>{estimate.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep('contract')}
                style={{ ...btnPrimary, flex: 1, padding: '15px 24px', fontSize: 16 }}
              >
                <CheckCircle size={18} strokeWidth={1.5} />
                Proceed to Approval
              </button>
              <button
                type="button"
                onClick={handleDecline}
                style={{
                  padding: '15px 18px', fontSize: 14, borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#fff', color: GRAY,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                <XCircle size={16} strokeWidth={1.5} style={{ color: '#dc2626' }} />
                Decline
              </button>
            </div>
          </div>
        )}

        {/* ── CONTRACT STEP ─────────────────────────────────────────────── */}
        {step === 'contract' && estimate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Agreement */}
            <div style={card}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 6 }}>
                Painting Services Agreement
              </h2>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 20 }}>
                Please read the agreement below before signing.
              </p>
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '20px 24px', maxHeight: 320, overflowY: 'auto',
                color: MID, fontSize: 13, lineHeight: 1.85,
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
              }}>
                {estimate.contract_body}
              </div>
            </div>

            {/* Paint codes */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 4 }}>Paint Color Codes</h3>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 20, lineHeight: 1.6 }}>
                Optional. Add the paint colors selected for this project.
              </p>
              {paintCodes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {paintCodes.map((pc, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                      <input style={inp} placeholder="Color name (e.g. Agreeable Gray)" value={pc.name} onChange={(e) => updatePaintCode(i, 'name', e.target.value)} />
                      <input style={inp} placeholder="Code (e.g. SW 7029)" value={pc.code} onChange={(e) => updatePaintCode(i, 'code', e.target.value)} />
                      <button type="button" onClick={() => removePaintCode(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addPaintCode}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: BLUE, fontSize: 14, padding: 0, fontFamily: 'inherit', fontWeight: 500 }}>
                <Plus size={15} strokeWidth={2} />
                {paintCodes.length === 0 ? 'Add a paint color code' : 'Add another color'}
              </button>
            </div>

            {/* Comments */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 4 }}>Comments &amp; Instructions</h3>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 16, lineHeight: 1.6 }}>Optional.</p>
              <textarea
                style={{ ...inp, minHeight: 100, resize: 'vertical', lineHeight: 1.65 }}
                placeholder="Add any details such as preferred dates, access instructions, or anything else important for your project."
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
              />
            </div>

            {/* Signature */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 4 }}>Signature</h3>
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 20, lineHeight: 1.6 }}>
                By signing below you agree to the terms of this service agreement.
              </p>

              <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
                {(['pad', 'type'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setSignMethod(m)}
                    style={{
                      flex: 1, padding: '9px 0', fontSize: 14, fontWeight: 500, border: 'none',
                      cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s', fontFamily: 'inherit',
                      background: signMethod === m ? '#fff' : 'transparent',
                      color: signMethod === m ? DARK : GRAY,
                      boxShadow: signMethod === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {m === 'pad' ? 'Draw Signature' : 'Type Name'}
                  </button>
                ))}
              </div>

              {signMethod === 'pad' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: GRAY }}>
                      <PenLine size={13} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      Draw your signature
                    </span>
                    {hasDrawn && (
                      <button type="button" onClick={clearCanvas}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, fontSize: 12, fontFamily: 'inherit' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={160}
                    style={{
                      width: '100%', height: 160, borderRadius: 10, touchAction: 'none', cursor: 'crosshair',
                      border: `1px solid ${hasDrawn ? BLUE : '#e2e8f0'}`,
                      background: '#fafafa',
                    }}
                  />
                  {!hasDrawn && (
                    <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, marginTop: 8 }}>
                      Sign using your mouse or finger
                    </p>
                  )}
                </div>
              )}

              {signMethod === 'type' && (
                <div>
                  <label style={sectionLabel}>Type your full name</label>
                  <input
                    style={{ ...inp, fontSize: 20, fontStyle: 'italic', letterSpacing: '0.02em' }}
                    placeholder={estimate.customer_name}
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                    Typing your name constitutes a legal electronic signature.
                  </p>
                </div>
              )}

              {submitError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginTop: 20,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 10, color: '#dc2626', fontSize: 14,
                }}>
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSign}
                disabled={!canSign || submitting}
                style={{
                  ...btnPrimary,
                  marginTop: 24, width: '100%', padding: '15px',
                  fontSize: 16, opacity: canSign && !submitting ? 1 : 0.45,
                  cursor: canSign && !submitting ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting
                  ? <><Loader2 size={18} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} /> Signing...</>
                  : <><PenLine size={18} strokeWidth={1.5} /> Sign &amp; Approve</>
                }
              </button>

              <button type="button" onClick={() => setStep('view')}
                style={{ marginTop: 12, width: '100%', padding: '12px', fontSize: 14, border: 'none', background: 'none', color: GRAY, cursor: 'pointer', fontFamily: 'inherit' }}>
                Back to estimate
              </button>
            </div>
          </div>
        )}

        {/* ── DEPOSIT ───────────────────────────────────────────────────── */}
        {step === 'deposit' && (
          <div style={{ ...card, textAlign: 'center', padding: '56px 40px' }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%', margin: '0 auto 24px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={34} strokeWidth={1.5} style={{ color: GREEN }} />
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: DARK, marginBottom: 10 }}>Agreement Signed</h2>
            <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.75, maxWidth: 420, margin: '0 auto 32px' }}>
              Thank you, {estimate?.customer_name}. Your service agreement has been signed.
              To confirm your booking, please pay the deposit below.
            </p>

            <div style={{
              background: LIGHT, border: `1px solid ${BORD}`, borderRadius: 14,
              padding: '24px 32px', maxWidth: 300, margin: '0 auto 32px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY, marginBottom: 8 }}>
                Deposit Due
              </div>
              <div style={{ fontSize: 38, fontWeight: 700, color: NAVY, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                {usd(depositAmount)}
              </div>
              <div style={{ fontSize: 13, color: GRAY }}>
                {estimate?.deposit_percentage ?? 30}% of project total
              </div>
            </div>

            <button
              onClick={() => { window.location.href = checkoutUrl; }}
              style={{ ...btnPrimary, width: '100%', maxWidth: 300, padding: '15px 40px', fontSize: 16, marginBottom: 16 }}
            >
              Pay Deposit Now
            </button>
            <br />
            <button
              onClick={() => setStep('done')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, fontSize: 13, fontFamily: 'inherit', padding: 4 }}
            >
              I will pay later
            </button>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ ...card, textAlign: 'center', padding: '64px 40px' }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%', margin: '0 auto 24px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={34} strokeWidth={1.5} style={{ color: GREEN }} />
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 700, color: DARK, marginBottom: 12 }}>Agreement Signed</h2>
            <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.75, maxWidth: 420, margin: '0 auto' }}>
              Thank you, {estimate?.customer_name}. Your service agreement has been signed and your project is confirmed.
              We will be in touch soon with next steps.
            </p>
          </div>
        )}

        {/* ── DECLINED ──────────────────────────────────────────────────── */}
        {step === 'declined' && (
          <div style={{ ...card, textAlign: 'center', padding: '64px 40px' }}>
            <XCircle size={44} strokeWidth={1.5} style={{ color: '#dc2626', marginBottom: 18 }} />
            <h2 style={{ fontSize: 26, fontWeight: 700, color: DARK, marginBottom: 10 }}>Estimate Declined</h2>
            <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.7 }}>
              We have noted your response. Feel free to reach out if you would like to discuss further.
            </p>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

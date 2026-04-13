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
}

type Step = 'loading' | 'error' | 'view' | 'contract' | 'done' | 'declined';

const bg: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0A0A0F',
  position: 'relative',
  overflow: 'hidden',
};

const wrap: React.CSSProperties = {
  maxWidth: 700,
  margin: '0 auto',
  padding: '60px 24px 80px',
  position: 'relative',
  zIndex: 1,
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 20,
  padding: '40px',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 15,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const serif = "'Cormorant Garamond', Georgia, serif";

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loadError, setLoadError] = useState('');

  // Paint codes
  const [paintCodes, setPaintCodes] = useState<PaintCode[]>([]);

  // Client notes
  const [clientNotes, setClientNotes] = useState('');

  // Signature
  const [signMethod, setSignMethod] = useState<'pad' | 'type'>('pad');
  const [typedName, setTypedName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/approve/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || 'Could not load estimate.');
        return d;
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

  // Canvas setup
  useEffect(() => {
    if (step !== 'contract' || signMethod !== 'pad') return;
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
      const sx = canvas!.width / rect.width;
      const sy = canvas!.height / rect.height;
      if ('touches' in e) {
        return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
      }
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
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
      setHasDrawn(true);
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

  function addPaintCode() {
    setPaintCodes(c => [...c, { name: '', code: '' }]);
  }
  function updatePaintCode(i: number, field: keyof PaintCode, val: string) {
    setPaintCodes(c => c.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }
  function removePaintCode(i: number) {
    setPaintCodes(c => c.filter((_, idx) => idx !== i));
  }

  const canSign =
    signMethod === 'pad' ? hasDrawn : typedName.trim().length > 2;

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
      setStep('done');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Signing failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!confirm('Are you sure you want to decline this estimate?')) return;
    try {
      await fetch(`/api/v1/approve/${token}/decline`, { method: 'POST' });
    } catch { /* continue */ }
    setStep('declined');
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} strokeWidth={1.5} style={{ color: '#007AFF', marginBottom: 16, animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15 }}>Loading your estimate...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={bg}>
        <div style={wrap}>
          <div style={{ ...card, textAlign: 'center', padding: '56px 40px' }}>
            <AlertCircle size={48} strokeWidth={1.5} style={{ color: '#FF3B30', marginBottom: 20 }} />
            <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
              Unable to Load Estimate
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
              {loadError || 'This link may have expired or is invalid.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={bg}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,122,255,0.07) 0%, transparent 65%)',
      }} />

      <div style={wrap}>
        {/* Company header */}
        {estimate && (
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {estimate.company_logo
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={estimate.company_logo} alt={estimate.company_name} style={{ height: 44, marginBottom: 4 }} />
              : <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: '#fff' }}>{estimate.company_name}</h2>
            }
          </div>
        )}

        {/* ─── VIEW STEP (bid document) ─────────────────────────────────────── */}
        {step === 'view' && estimate && (
          <div style={card}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.3)',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                color: '#007AFF', letterSpacing: '0.04em', marginBottom: 14,
              }}>
                Estimate {estimate.estimate_number}
              </div>
              <h1 style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                Your Estimate
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                Prepared for {estimate.customer_name}
              </p>
            </div>

            {/* Property */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <span style={label}>Property Address</span>
              <p style={{ color: '#fff', fontSize: 15, margin: 0 }}>{estimate.job_address}</p>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 24 }}>
              <span style={label}>Scope of Work</span>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Description', 'Qty', 'Price', 'Amount'].map((h, i) => (
                      <th key={h} style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: 'rgba(255,255,255,0.3)', padding: '0 0 10px',
                        textAlign: i === 0 ? 'left' : 'right',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estimate.line_items.map((li, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{li.description}</td>
                      <td style={{ padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>{li.qty}</td>
                      <td style={{ padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'right', fontFamily: 'Menlo,monospace' }}>
                        ${li.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 0', fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'right', fontFamily: 'Menlo,monospace' }}>
                        ${(li.qty * li.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 260 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Subtotal</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Menlo,monospace' }}>
                      ${estimate.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {!estimate.tax_exempt && estimate.tax_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                        Sales Tax ({(estimate.tax_rate * 100).toFixed(0)}%)
                      </span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Menlo,monospace' }}>
                        ${estimate.tax_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {estimate.tax_exempt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>Sales Tax</span>
                      <span style={{ fontSize: 14, color: '#34C759' }}>Exempt</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#E8A838', fontFamily: serif }}>
                      ${estimate.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {estimate.notes && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid rgba(0,122,255,0.5)', borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 24 }}>
                <span style={label}>Notes</span>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{estimate.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep('contract')}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '15px 24px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: '#007AFF', color: '#fff',
                }}
              >
                <CheckCircle size={18} strokeWidth={1.5} />
                Proceed to Approval
              </button>
              <button
                type="button"
                onClick={handleDecline}
                style={{
                  padding: '15px 18px', fontSize: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <XCircle size={16} strokeWidth={1.5} style={{ color: '#FF3B30' }} />
                Decline
              </button>
            </div>
          </div>
        )}

        {/* ─── CONTRACT STEP ────────────────────────────────────────────────── */}
        {step === 'contract' && estimate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Service agreement */}
            <div style={card}>
              <h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
                Painting Services Agreement
              </h2>
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '20px 24px',
                maxHeight: 340, overflowY: 'auto',
                color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.85,
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
              }}>
                {estimate.contract_body}
              </div>
            </div>

            {/* Paint color codes */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                Paint Color Codes
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
                Optional. Add the paint colors you have selected for this project.
              </p>

              {paintCodes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {paintCodes.map((pc, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                      <input
                        style={inputStyle}
                        placeholder="Color name (e.g. Agreeable Gray)"
                        value={pc.name}
                        onChange={(e) => updatePaintCode(i, 'name', e.target.value)}
                      />
                      <input
                        style={inputStyle}
                        placeholder="Code (e.g. SW 7029)"
                        value={pc.code}
                        onChange={(e) => updatePaintCode(i, 'code', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removePaintCode(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addPaintCode}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#007AFF', fontSize: 14, padding: 0, fontFamily: 'inherit',
                }}
              >
                <Plus size={15} strokeWidth={2} />
                {paintCodes.length === 0 ? 'Add a paint color code' : 'Add another color'}
              </button>
            </div>

            {/* Comments & instructions */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                Comments &amp; Instructions
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
                Optional.
              </p>
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.65 }}
                placeholder="Add any details such as preferred dates and times, access instructions, rooms of concern, or anything else important for your project."
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
              />
            </div>

            {/* Signature */}
            <div style={card}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Signature</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
                By signing below you agree to the terms of this service agreement.
              </p>

              {/* Toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4 }}>
                {(['pad', 'type'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSignMethod(m)}
                    style={{
                      flex: 1, padding: '9px 0', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
                      borderRadius: 8, transition: 'all 0.15s', fontFamily: 'inherit',
                      background: signMethod === m ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: signMethod === m ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {m === 'pad' ? 'Draw Signature' : 'Type Name'}
                  </button>
                ))}
              </div>

              {signMethod === 'pad' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                      <PenLine size={13} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      Draw your signature
                    </span>
                    {hasDrawn && (
                      <button type="button" onClick={clearCanvas}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'inherit' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={160}
                    style={{
                      width: '100%', height: 160, borderRadius: 12, touchAction: 'none', cursor: 'crosshair',
                      border: `1px solid ${hasDrawn ? 'rgba(0,122,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  />
                  {!hasDrawn && (
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 8 }}>
                      Sign using your mouse or finger
                    </p>
                  )}
                </div>
              )}

              {signMethod === 'type' && (
                <div>
                  <label style={label}>Type your full name</label>
                  <input
                    style={{ ...inputStyle, fontSize: 22, fontFamily: serif, letterSpacing: '0.02em' }}
                    placeholder={estimate.customer_name}
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                    Typing your name constitutes a legal electronic signature.
                  </p>
                </div>
              )}

              {submitError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginTop: 20,
                  background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)',
                  borderRadius: 10, color: '#FF3B30', fontSize: 14,
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
                  marginTop: 24, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '15px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: 'none',
                  cursor: canSign && !submitting ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  background: canSign ? '#007AFF' : 'rgba(0,122,255,0.3)',
                  color: canSign ? '#fff' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {submitting
                  ? <><Loader2 size={18} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} /> Signing...</>
                  : <><PenLine size={18} strokeWidth={1.5} /> Sign &amp; Approve</>
                }
              </button>

              <button
                type="button"
                onClick={() => setStep('view')}
                style={{
                  marginTop: 12, width: '100%', padding: '12px', fontSize: 14, border: 'none',
                  background: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Back to estimate
              </button>
            </div>
          </div>
        )}

        {/* ─── DONE ─────────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ ...card, textAlign: 'center', padding: '64px 40px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 28px',
              background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={36} strokeWidth={1.5} style={{ color: '#34C759' }} />
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, color: '#fff', marginBottom: 14 }}>
              Agreement Signed
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.75, maxWidth: 440, margin: '0 auto' }}>
              Thank you, {estimate?.customer_name}. Your service agreement has been signed and your project is confirmed.
              We will be in touch soon with next steps.
            </p>
          </div>
        )}

        {/* ─── DECLINED ─────────────────────────────────────────────────────── */}
        {step === 'declined' && (
          <div style={{ ...card, textAlign: 'center', padding: '64px 40px' }}>
            <XCircle size={48} strokeWidth={1.5} style={{ color: '#FF3B30', marginBottom: 20 }} />
            <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
              Estimate Declined
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7 }}>
              We have noted your response. Feel free to reach out if you would like to discuss further.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

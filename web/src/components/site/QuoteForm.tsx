'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

interface QuoteFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service_needed: string;
  project_address: string;
  message: string;
  heard_from: string;
}

const SERVICES = [
  { value: '', label: 'Select a service...' },
  { value: 'Residential Painting', label: 'Residential Painting' },
  { value: 'Commercial Painting', label: 'Commercial Painting' },
  { value: 'Interior Painting', label: 'Interior Painting' },
  { value: 'Exterior Painting', label: 'Exterior Painting' },
  { value: 'Cabinet Painting', label: 'Cabinet Painting' },
  { value: 'Deck Staining', label: 'Deck Staining' },
  { value: 'Not sure', label: 'Not sure yet' },
];

const HEARD_FROM = [
  { value: '', label: 'How did you hear about us?' },
  { value: 'Google', label: 'Google' },
  { value: 'Referral', label: 'Referral from friend/family' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Drive By', label: 'Drive by / Yard sign' },
  { value: 'Other', label: 'Other' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 15,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

export default function QuoteForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<QuoteFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    service_needed: '',
    project_address: '',
    message: '',
    heard_from: '',
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Submission failed. Please try again.');
      }

      // Store first name for the confirmation page
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('quote_first_name', form.first_name);
      }

      router.push('/quote-submitted');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass" style={{ padding: '40px' }}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'rgba(255,59,48,0.12)',
              border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 10,
              marginBottom: 24,
              color: '#FF3B30',
              fontSize: 14,
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} />
            {error}
          </div>
        )}

        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              First Name *
            </label>
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              required
              placeholder="Alex"
              style={inputStyle}
              className="glass-input"
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              Last Name *
            </label>
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              required
              placeholder="Johnson"
              style={inputStyle}
              className="glass-input"
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              Email *
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="alex@example.com"
              style={inputStyle}
              className="glass-input"
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              Phone
            </label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="(515) 555-0000"
              style={inputStyle}
              className="glass-input"
            />
          </div>
        </div>

        {/* Service + Heard from */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              Service Needed *
            </label>
            <select
              name="service_needed"
              value={form.service_needed}
              onChange={handleChange}
              required
              style={{ ...inputStyle, appearance: 'none' }}
              className="glass-input"
            >
              {SERVICES.map((s) => (
                <option key={s.value} value={s.value} style={{ background: '#1a1a2e' }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
            >
              How did you hear about us?
            </label>
            <select
              name="heard_from"
              value={form.heard_from}
              onChange={handleChange}
              style={{ ...inputStyle, appearance: 'none' }}
              className="glass-input"
            >
              {HEARD_FROM.map((s) => (
                <option key={s.value} value={s.value} style={{ background: '#1a1a2e' }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Project address */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
          >
            Project Address
          </label>
          <input
            name="project_address"
            value={form.project_address}
            onChange={handleChange}
            placeholder="123 Main St, Des Moines, IA"
            style={inputStyle}
            className="glass-input"
          />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 28 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}
          >
            Tell us about your project
          </label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={4}
            placeholder="Describe your project, any specific requirements, timeline..."
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 100,
            }}
            className="glass-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent"
          style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}
        >
          {loading ? (
            <>
              <Loader2 size={18} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
              Sending...
            </>
          ) : (
            'Submit Quote Request'
          )}
        </button>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 16 }}>
          We respond within 1 business day. No spam, ever.
        </p>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

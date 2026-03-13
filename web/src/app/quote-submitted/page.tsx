'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, Calendar, Phone } from 'lucide-react';

export default function QuoteSubmittedPage() {
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      const name = sessionStorage.getItem('quote_first_name') || '';
      setFirstName(name);
    }
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(52,199,89,0.12) 0%, transparent 60%), #0A0A0F',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div className="glass" style={{ padding: '56px 48px' }}>
          {/* Success icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(52,199,89,0.15)',
              border: '1px solid rgba(52,199,89,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              color: '#34C759',
            }}
          >
            <CheckCircle size={40} strokeWidth={1.5} />
          </div>

          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 40,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 16,
              lineHeight: 1.2,
            }}
          >
            {firstName ? `Thank you, ${firstName}!` : 'Thank you!'}
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 17,
              lineHeight: 1.7,
              marginBottom: 40,
            }}
          >
            Your quote request has been received. We will contact you within
            <strong style={{ color: '#fff' }}> 1 business day</strong> to discuss your project.
          </p>

          <div
            style={{
              background: 'rgba(232,168,56,0.08)',
              border: '1px solid rgba(232,168,56,0.2)',
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 32,
              textAlign: 'left',
            }}
          >
            <p style={{ color: '#E8A838', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Want to skip the wait?
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              Book a time directly on our calendar and we will confirm your appointment immediately.
            </p>
            <Link href="/book" className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }}>
              <Calendar size={16} strokeWidth={1.5} />
              Book a Time Now
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="tel:+15155551234"
              className="btn btn-ghost"
              style={{ justifyContent: 'center', fontSize: 14 }}
            >
              <Phone size={15} strokeWidth={1.5} />
              Or call us directly at (515) 555-1234
            </a>

            <Link
              href="/"
              style={{
                color: 'rgba(255,255,255,0.4)',
                textDecoration: 'none',
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

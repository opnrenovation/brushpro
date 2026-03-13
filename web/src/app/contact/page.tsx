import Link from 'next/link';
import { Phone, Mail, Clock, MapPin, ChevronRight } from 'lucide-react';
import QuoteForm from '@/components/site/QuoteForm';

function Navbar() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#fff' }}>
            OPN Renovation
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[
            { label: 'Services', href: '/services' },
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
            { label: 'Book', href: '/book' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14, padding: '8px 14px' }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/#quote" className="btn btn-accent" style={{ marginLeft: 8 }}>
            Get a Free Quote
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function ContactPage() {
  return (
    <>
      <Navbar />

      <main style={{ background: '#0A0A0F', minHeight: '100vh', paddingTop: 64 }}>
        {/* Header */}
        <section
          style={{
            position: 'relative',
            padding: '80px 24px 64px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,168,56,0.09) 0%, transparent 60%), #0A0A0F',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
            <h1
              className="site-headline"
              style={{ fontSize: 'clamp(40px, 5vw, 60px)', color: '#fff', marginBottom: 16 }}
            >
              Contact Us
            </h1>
            <p className="site-body" style={{ fontSize: 18, maxWidth: 480, margin: '0 auto' }}>
              We would love to hear about your project. Reach out any way you prefer.
            </p>
          </div>
        </section>

        {/* Contact info + form */}
        <section style={{ padding: '20px 0 100px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 48, alignItems: 'start' }}>
              {/* Left: contact info */}
              <div>
                <div className="glass" style={{ padding: '36px', marginBottom: 20 }}>
                  <h2
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 24,
                      fontWeight: 600,
                      color: '#fff',
                      marginBottom: 24,
                    }}
                  >
                    Get in Touch
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Phone */}
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                        Phone
                      </p>
                      <a
                        href="tel:+15155551234"
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: 15 }}
                      >
                        <Phone size={16} strokeWidth={1.5} style={{ color: '#E8A838' }} />
                        (515) 555-1234
                      </a>
                    </div>

                    {/* Email */}
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                        Email
                      </p>
                      <a
                        href="mailto:info@opnrenovation.com"
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: 15 }}
                      >
                        <Mail size={16} strokeWidth={1.5} style={{ color: '#E8A838' }} />
                        info@opnrenovation.com
                      </a>
                    </div>

                    {/* Location */}
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                        Location
                      </p>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                        <MapPin size={16} strokeWidth={1.5} style={{ color: '#E8A838', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.5 }}>
                          Des Moines, Iowa
                          <br />
                          Serving the greater metro area
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hours */}
                <div className="glass" style={{ padding: '28px 36px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Clock size={18} strokeWidth={1.5} style={{ color: '#E8A838' }} />
                    <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Business Hours</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Monday - Friday</span>
                      <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>8:00 AM - 5:00 PM</span>
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Saturday - Sunday</span>
                      <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>8:00 AM - 1:00 PM</span>
                    </div>
                  </div>
                </div>

                {/* Book CTA */}
                <div style={{ marginTop: 20 }}>
                  <Link href="/book" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15 }}>
                    Book an Appointment
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>

              {/* Right: Quote form */}
              <div>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 26,
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: 24,
                  }}
                >
                  Request a Free Quote
                </p>
                <QuoteForm />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

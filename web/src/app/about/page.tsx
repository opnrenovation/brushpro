import Link from 'next/link';
import {
  Award,
  Clock,
  Shield,
  DollarSign,
  CheckCircle,
  MapPin,
  Phone,
  ChevronRight,
} from 'lucide-react';

const VALUES = [
  {
    icon: <Award size={28} strokeWidth={1.5} />,
    title: 'Quality',
    desc: 'We use premium paints and materials, take our time with prep work, and never cut corners. The result is a finish that looks great and lasts.',
  },
  {
    icon: <Clock size={28} strokeWidth={1.5} />,
    title: 'Reliability',
    desc: 'When we say we will be there at 8 AM, we are there at 8 AM. We communicate proactively, stay on schedule, and finish what we start.',
  },
  {
    icon: <Shield size={28} strokeWidth={1.5} />,
    title: 'Professionalism',
    desc: 'Our crew is courteous, respectful of your property, and cleans up thoroughly every day. We treat your home like our own.',
  },
  {
    icon: <DollarSign size={28} strokeWidth={1.5} />,
    title: 'Fair Pricing',
    desc: 'No hidden fees, no surprise charges. We provide detailed written estimates and stand behind them.',
  },
];

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

export default function AboutPage() {
  return (
    <>
      <Navbar />

      <main style={{ background: '#0A0A0F', minHeight: '100vh', paddingTop: 64 }}>
        {/* Hero */}
        <section
          style={{
            position: 'relative',
            padding: '100px 24px 80px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 70% 60% at 50% 20%, rgba(0,122,255,0.09) 0%, transparent 60%), #0A0A0F',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ maxWidth: 720 }}>
              <div className="pill pill-blue" style={{ marginBottom: 20, display: 'inline-flex' }}>
                <MapPin size={12} strokeWidth={1.5} style={{ marginRight: 4 }} />
                Des Moines, Iowa
              </div>
              <h1
                className="site-headline"
                style={{ fontSize: 'clamp(44px, 6vw, 72px)', color: '#fff', marginBottom: 24 }}
              >
                Family-Owned.
                <br />
                <span style={{ color: '#E8A838' }}>Des Moines Proud.</span>
              </h1>
              <p className="site-body" style={{ fontSize: 18, lineHeight: 1.8, marginBottom: 40, maxWidth: 600 }}>
                OPN Renovation is a family-owned painting company based in Des Moines, Iowa. Since 2020, we
                have been helping homeowners and businesses across the metro transform their spaces with
                expert painting and surface preparation services.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link href="/#quote" className="btn btn-accent" style={{ fontSize: 15 }}>
                  Get a Free Quote
                  <ChevronRight size={16} strokeWidth={1.5} />
                </Link>
                <a href="tel:+15155551234" className="btn btn-ghost" style={{ fontSize: 15 }}>
                  <Phone size={15} strokeWidth={1.5} />
                  (515) 555-1234
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Story section */}
        <section style={{ padding: '80px 0', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
              <div>
                <h2
                  className="site-headline"
                  style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#fff', marginBottom: 24 }}
                >
                  Our Story
                </h2>
                <div className="site-body" style={{ fontSize: 16, lineHeight: 1.85 }}>
                  <p style={{ marginBottom: 20 }}>
                    OPN Renovation started in 2020 with a simple goal: provide painting services that
                    Des Moines homeowners could actually trust. Too many contractors show up late, do
                    mediocre work, and disappear when something goes wrong.
                  </p>
                  <p style={{ marginBottom: 20 }}>
                    We built OPN Renovation on the opposite principles. Every job gets our full attention,
                    from the first estimate to the final walkthrough. We hire painters who take pride in
                    their craft, use premium materials, and never cut corners on prep work.
                  </p>
                  <p>
                    Over the past 4+ years, we have completed hundreds of residential and commercial
                    projects throughout Des Moines, Ankeny, Pleasant Hill, and the surrounding
                    communities. Most of our business comes from referrals — and that tells us we are
                    doing something right.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { number: '4+', label: 'Years in Business' },
                  { number: '100%', label: 'Family Owned' },
                  { number: 'A+', label: 'Customer Satisfaction' },
                  { number: 'Free', label: 'Written Estimates' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="glass"
                    style={{ padding: '28px 24px', textAlign: 'center' }}
                  >
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 40,
                        fontWeight: 600,
                        color: '#E8A838',
                        marginBottom: 8,
                      }}
                    >
                      {stat.number}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section style={{ padding: '100px 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <h2
                className="site-headline"
                style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#fff', marginBottom: 16 }}
              >
                Our Core Values
              </h2>
              <p className="site-body" style={{ fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
                These are not just words on a page. They are the standards we hold ourselves to on every single job.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              {VALUES.map((v) => (
                <div key={v.title} className="glass" style={{ padding: '32px 28px' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: 'rgba(0,122,255,0.12)',
                      border: '1px solid rgba(0,122,255,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#007AFF',
                      marginBottom: 20,
                    }}
                  >
                    {v.icon}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 22,
                      fontWeight: 600,
                      color: '#fff',
                      marginBottom: 10,
                    }}
                  >
                    {v.title}
                  </h3>
                  <p className="site-body" style={{ fontSize: 14, lineHeight: 1.7 }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Service area */}
        <section style={{ padding: '80px 0 100px', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
              <div>
                <h2
                  className="site-headline"
                  style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#fff', marginBottom: 16 }}
                >
                  Serving Greater Des Moines
                </h2>
                <p className="site-body" style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 28 }}>
                  We serve homeowners and businesses throughout the Des Moines metro area. Whether you are
                  in downtown Des Moines or in the surrounding suburbs, we can help.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Des Moines', 'Ankeny', 'Pleasant Hill', 'Altoona',
                    'Norwalk', 'Indianola', 'Ames', 'Newton', 'Urbandale', 'West Des Moines',
                  ].map((city) => (
                    <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle size={15} strokeWidth={1.5} style={{ color: '#34C759', flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }}>{city}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass" style={{ padding: '40px' }}>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 28,
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: 12,
                  }}
                >
                  Ready to Get Started?
                </h3>
                <p className="site-body" style={{ fontSize: 15, marginBottom: 28, lineHeight: 1.7 }}>
                  Contact us today for a free, no-obligation estimate on your painting project.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Link href="/#quote" className="btn btn-accent" style={{ justifyContent: 'center', fontSize: 15 }}>
                    Get a Free Quote
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </Link>
                  <Link href="/book" className="btn btn-primary" style={{ justifyContent: 'center', fontSize: 15 }}>
                    Book an Appointment
                  </Link>
                  <a href="tel:+15155551234" className="btn btn-ghost" style={{ justifyContent: 'center', fontSize: 15 }}>
                    <Phone size={15} strokeWidth={1.5} />
                    (515) 555-1234
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

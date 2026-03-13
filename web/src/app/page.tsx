import Link from 'next/link';
import {
  Phone,
  Mail,
  CheckCircle,
  Home,
  Building2,
  Layers,
  Sun,
  Hammer,
  Palette,
  Lightbulb,
  Star,
  Award,
  Shield,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import QuoteForm from '@/components/site/QuoteForm';

// Navbar
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
          <span
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 22,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}
          >
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
              style={{
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: 8,
                transition: 'color 0.2s',
              }}
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

// Hero Section
function Hero() {
  return (
    <section
      className="site-section"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 64 }}
    >
      <div className="gradient-mesh" />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: '80px 24px',
          width: '100%',
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <div
            className="pill pill-orange"
            style={{ marginBottom: 24, display: 'inline-flex' }}
          >
            <MapPin size={12} strokeWidth={1.5} style={{ marginRight: 4 }} />
            Des Moines, Iowa
          </div>

          <h1
            className="site-headline"
            style={{ fontSize: 'clamp(48px, 7vw, 88px)', color: '#fff', marginBottom: 24 }}
          >
            Des Moines' Premier
            <br />
            <span style={{ color: '#E8A838' }}>Painting Company</span>
          </h1>

          <p
            className="site-body"
            style={{ fontSize: 20, marginBottom: 40, maxWidth: 580 }}
          >
            Residential. Commercial. Interior. Exterior.
            <br />
            Done right the first time.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 64 }}>
            <a href="tel:+15155551234" className="btn btn-accent" style={{ fontSize: 16, padding: '14px 28px' }}>
              <Phone size={18} strokeWidth={1.5} />
              Call for a Free Quote
            </a>
            <Link href="/services" className="btn btn-ghost" style={{ fontSize: 16, padding: '14px 28px' }}>
              View Our Work
              <ChevronRight size={16} strokeWidth={1.5} />
            </Link>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              '4+ Years in Business',
              'Family Owned',
              'Fully Insured',
              'Free Estimates',
            ].map((badge) => (
              <div
                key={badge}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <CheckCircle size={16} strokeWidth={1.5} style={{ color: '#34C759', flexShrink: 0 }} />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Services data
const SERVICES = [
  {
    icon: <Home size={28} strokeWidth={1.5} />,
    name: 'Residential Painting',
    desc: 'Transform your home with precision interior and exterior painting that lasts for years.',
  },
  {
    icon: <Building2 size={28} strokeWidth={1.5} />,
    name: 'Commercial Painting',
    desc: 'Professional commercial painting with minimal disruption to your business operations.',
  },
  {
    icon: <Layers size={28} strokeWidth={1.5} />,
    name: 'Interior Painting',
    desc: 'Flawless interior finishes with clean lines, proper prep work, and premium paints.',
  },
  {
    icon: <Sun size={28} strokeWidth={1.5} />,
    name: 'Exterior Painting',
    desc: 'Weather-resistant exterior coatings that protect and beautify your property.',
  },
  {
    icon: <Hammer size={28} strokeWidth={1.5} />,
    name: 'Cabinet Painting',
    desc: 'Give your kitchen or bathroom a fresh look with expert cabinet refinishing.',
  },
  {
    icon: <Award size={28} strokeWidth={1.5} />,
    name: 'Deck Staining',
    desc: 'Protect and enhance your outdoor deck or fence with quality staining and sealing.',
  },
  {
    icon: <Palette size={28} strokeWidth={1.5} />,
    name: 'Accent Walls',
    desc: 'Create focal points and visual interest with expertly painted accent walls.',
  },
  {
    icon: <Lightbulb size={28} strokeWidth={1.5} />,
    name: 'Color Consultation',
    desc: 'Not sure what color to choose? Our team helps you find the perfect palette.',
  },
];

function ServicesSection() {
  return (
    <section className="site-section" style={{ padding: '100px 0', background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2
            className="site-headline"
            style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: '#fff', marginBottom: 16 }}
          >
            Our Services
          </h2>
          <p className="site-body" style={{ fontSize: 18, maxWidth: 480, margin: '0 auto' }}>
            Complete painting solutions for residential and commercial properties across Des Moines.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {SERVICES.map((service) => (
            <div
              key={service.name}
              className="glass"
              style={{ padding: 28, transition: 'transform 0.2s, box-shadow 0.2s' }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: 'rgba(232,168,56,0.12)',
                  border: '1px solid rgba(232,168,56,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#E8A838',
                  marginBottom: 20,
                }}
              >
                {service.icon}
              </div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 10,
                }}
              >
                {service.name}
              </h3>
              <p className="site-body" style={{ fontSize: 14, lineHeight: 1.6 }}>
                {service.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/services" className="btn btn-ghost" style={{ fontSize: 15 }}>
            View All Services
            <ChevronRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyOpnSection() {
  const features = [
    {
      icon: <Award size={32} strokeWidth={1.5} />,
      title: 'High Quality Work',
      desc: 'We use only premium paints and materials. Every surface is properly prepared, primed, and finished to the highest standard.',
    },
    {
      icon: <Shield size={32} strokeWidth={1.5} />,
      title: 'Reasonable Rates',
      desc: 'Competitive, transparent pricing with no hidden fees. We provide detailed written estimates before any work begins.',
    },
    {
      icon: <Clock size={32} strokeWidth={1.5} />,
      title: 'Reliable & Professional',
      desc: 'We show up on time, communicate clearly, and leave your property cleaner than we found it. Your satisfaction is guaranteed.',
    },
  ];

  return (
    <section className="site-section" style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2
            className="site-headline"
            style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: '#fff', marginBottom: 16 }}
          >
            Why Choose OPN Renovation?
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
          {features.map((f) => (
            <div key={f.title} style={{ textAlign: 'center', padding: '0 16px' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(0,122,255,0.12)',
                  border: '1px solid rgba(0,122,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#007AFF',
                  margin: '0 auto 24px',
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 24,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 12,
                }}
              >
                {f.title}
              </h3>
              <p className="site-body" style={{ fontSize: 15, lineHeight: 1.7 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceAreasSection() {
  const cities = [
    'Des Moines',
    'Ankeny',
    'Pleasant Hill',
    'Altoona',
    'Norwalk',
    'Indianola',
    'Ames',
    'Newton',
    'Colfax',
    'Urbandale',
    'West Des Moines',
    'Clive',
  ];

  return (
    <section
      className="site-section"
      style={{ padding: '100px 0', background: 'rgba(0,0,0,0.3)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <MapPin
            size={36}
            strokeWidth={1.5}
            style={{ color: '#E8A838', marginBottom: 16 }}
          />
          <h2
            className="site-headline"
            style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#fff', marginBottom: 16 }}
          >
            Serving Des Moines and Surrounding Communities
          </h2>
          <p className="site-body" style={{ fontSize: 16 }}>
            We proudly serve homeowners and businesses throughout the greater Des Moines metro area.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
          }}
        >
          {cities.map((city) => (
            <div
              key={city}
              className="glass"
              style={{
                padding: '10px 20px',
                borderRadius: 100,
                fontSize: 14,
                color: 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CheckCircle size={14} strokeWidth={1.5} style={{ color: '#34C759' }} />
              {city}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteSection() {
  return (
    <section id="quote" className="site-section" style={{ padding: '100px 0' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2
            className="site-headline"
            style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#fff', marginBottom: 16 }}
          >
            Get a Free Quote
          </h2>
          <p className="site-body" style={{ fontSize: 16 }}>
            Tell us about your project and we will get back to you within 1 business day.
          </p>
        </div>
        <QuoteForm />
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Sarah M.',
      location: 'Ankeny, IA',
      rating: 5,
      text: 'OPN Renovation did an incredible job on our home exterior. The crew was professional, on time, and the results exceeded our expectations.',
    },
    {
      name: 'James T.',
      location: 'Des Moines, IA',
      rating: 5,
      text: 'We hired them to paint our entire commercial office. They worked around our schedule and finished ahead of time. Highly recommend.',
    },
    {
      name: 'Linda R.',
      location: 'Pleasant Hill, IA',
      rating: 5,
      text: 'The cabinet painting transformed our kitchen completely. Clean lines, beautiful finish, and very reasonable pricing.',
    },
  ];

  return (
    <section
      className="site-section"
      style={{ padding: '100px 0', background: 'rgba(0,0,0,0.3)' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2
            className="site-headline"
            style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#fff', marginBottom: 16 }}
          >
            What Our Customers Say
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {testimonials.map((t) => (
            <div key={t.name} className="glass" style={{ padding: 28 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: '#E8A838', fill: '#E8A838' }}
                  />
                ))}
              </div>
              <p
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 15,
                  lineHeight: 1.7,
                  marginBottom: 20,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{t.text}&rdquo;
              </p>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{t.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        background: 'rgba(0,0,0,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '64px 0 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48, marginBottom: 48 }}>
          {/* Company info */}
          <div>
            <h3
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 24,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 16,
              }}
            >
              OPN Renovation
            </h3>
            <p className="site-body" style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
              Family-owned painting company serving Des Moines and surrounding communities since 2020.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href="tel:+15155551234"
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: '8px 14px', width: 'fit-content' }}
              >
                <Phone size={14} strokeWidth={1.5} />
                (515) 555-1234
              </a>
              <a
                href="mailto:info@opnrenovation.com"
                className="btn btn-ghost"
                style={{ fontSize: 13, padding: '8px 14px', width: 'fit-content' }}
              >
                <Mail size={14} strokeWidth={1.5} />
                info@opnrenovation.com
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Services
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                'Residential Painting',
                'Commercial Painting',
                'Interior Painting',
                'Exterior Painting',
                'Cabinet Painting',
                'Deck Staining',
              ].map((s) => (
                <li key={s} style={{ marginBottom: 10 }}>
                  <Link
                    href="/services"
                    style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Company
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                { label: 'About Us', href: '/about' },
                { label: 'Contact', href: '/contact' },
                { label: 'Book Appointment', href: '/book' },
                { label: 'Get a Quote', href: '/#quote' },
              ].map((item) => (
                <li key={item.label} style={{ marginBottom: 10 }}>
                  <Link
                    href={item.href}
                    style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Business Hours
            </h4>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 2 }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Mon - Fri</span>
                <br />
                8:00 AM - 5:00 PM
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Sat - Sun</span>
                <br />
                8:00 AM - 1:00 PM
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            &copy; {new Date().getFullYear()} OPN Renovation. All rights reserved. Des Moines, Iowa.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
            Licensed &amp; Insured
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ServicesSection />
        <WhyOpnSection />
        <ServiceAreasSection />
        <QuoteSection />
        <TestimonialsSection />
      </main>
      <Footer />
    </>
  );
}

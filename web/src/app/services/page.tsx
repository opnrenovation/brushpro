import Link from 'next/link';
import {
  Home,
  Building2,
  Layers,
  Sun,
  Hammer,
  Award,
  Palette,
  Lightbulb,
  ChevronRight,
  CheckCircle,
  Phone,
} from 'lucide-react';

const SERVICES = [
  {
    icon: <Home size={36} strokeWidth={1.5} />,
    name: 'Residential Painting',
    tagline: 'Your home, beautifully transformed.',
    description:
      'We specialize in complete residential painting projects — from single rooms to whole-house refreshes. Our team takes care of prep work, priming, painting, and cleanup so your home looks better than ever.',
    includes: [
      'Interior and exterior surfaces',
      'Proper surface preparation and repairs',
      'Premium paint brands (Sherwin-Williams, Benjamin Moore)',
      'Trim, doors, windows, and accent walls',
      'Clean worksite — protected floors and furniture',
      'Detailed final walkthrough',
    ],
  },
  {
    icon: <Building2 size={36} strokeWidth={1.5} />,
    name: 'Commercial Painting',
    tagline: 'Professional results for your business.',
    description:
      'We understand that downtime costs you money. Our commercial painting crews work efficiently, including evenings and weekends, to minimize disruption to your operations.',
    includes: [
      'Office buildings, retail, restaurants, and more',
      'Flexible scheduling to minimize business disruption',
      'Low-odor and VOC-compliant paints available',
      'Surface preparation and patching',
      'Epoxy floor coatings available',
      'Detailed written estimate before any work begins',
    ],
  },
  {
    icon: <Layers size={36} strokeWidth={1.5} />,
    name: 'Interior Painting',
    tagline: 'Flawless finishes. Clean lines. Every time.',
    description:
      'Interior painting is about precision. We protect your belongings, properly prepare every surface, and deliver crisp, clean finishes you will be proud of.',
    includes: [
      'Walls, ceilings, and trim',
      'Proper sanding and patching of imperfections',
      'Multiple coats for full coverage',
      'Clean tape lines and edge work',
      'Furniture and floor protection',
      'Same-day small room projects often available',
    ],
  },
  {
    icon: <Sun size={36} strokeWidth={1.5} />,
    name: 'Exterior Painting',
    tagline: 'Weather-resistant finishes that protect and impress.',
    description:
      'Des Moines weather is tough on exteriors. We use high-quality exterior paints that stand up to Iowa summers and winters, and we prepare every surface properly to ensure lasting adhesion.',
    includes: [
      'Power washing and surface prep',
      'Caulking and sealing cracks',
      'Premium exterior paints and primers',
      'Siding, trim, soffits, and fascia',
      'Decks and railings',
      'Multi-year color and adhesion warranty available',
    ],
  },
  {
    icon: <Hammer size={36} strokeWidth={1.5} />,
    name: 'Cabinet Painting',
    tagline: 'A kitchen transformation without the renovation price tag.',
    description:
      'Cabinet painting is one of the most cost-effective ways to transform your kitchen or bathroom. We use a specialized process that results in a factory-smooth, durable finish.',
    includes: [
      'Cabinet doors and frames',
      'Complete disassembly and reassembly',
      'Thorough degreasing and sanding',
      'High-build primer for smooth finish',
      'Durable topcoat resistant to moisture and wear',
      'Hardware reinstallation',
    ],
  },
  {
    icon: <Award size={36} strokeWidth={1.5} />,
    name: 'Deck Staining',
    tagline: 'Protect your investment and bring back the beauty.',
    description:
      'A properly stained deck can last years longer than an untreated one. We clean, repair, and apply high-quality stains and sealers to wood, composite, and concrete surfaces.',
    includes: [
      'Power washing and deck cleaning',
      'Board replacement and minor repairs',
      'Solid or semi-transparent stain options',
      'Fence and pergola staining available',
      'Concrete sealing and epoxy coatings',
      'UV-resistant and weatherproof formulas',
    ],
  },
  {
    icon: <Palette size={36} strokeWidth={1.5} />,
    name: 'Accent Walls',
    tagline: 'Make a statement in any room.',
    description:
      'A well-executed accent wall can define a space and showcase your personal style. Whether bold and dramatic or subtle and sophisticated, we execute your vision flawlessly.',
    includes: [
      'Single room or multi-room accent walls',
      'Color blocking and geometric designs',
      'Specialty finishes (metallic, matte, eggshell)',
      'Texture techniques available',
      'Color matching and sampling included',
      'Quick turnaround — often completed in a day',
    ],
  },
  {
    icon: <Lightbulb size={36} strokeWidth={1.5} />,
    name: 'Color Consultation',
    tagline: 'The right color makes all the difference.',
    description:
      'Choosing paint colors can feel overwhelming. Our color consultation service helps you find the perfect palette for your home — one that complements your lighting, furniture, and lifestyle.',
    includes: [
      'In-home consultation',
      'Sample cards and test patches',
      'Coordination across rooms and spaces',
      'Exterior color planning and curb appeal review',
      'Knowledge of current design trends',
      'No obligation — book separately or bundled with any painting service',
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Navbar */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#FFFFFF',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
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
                color: '#1D1D1F',
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
                style={{ color: 'rgba(0,0,0,0.6)', textDecoration: 'none', fontSize: 14, padding: '8px 14px' }}
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

      <main style={{ background: '#FFFFFF', minHeight: '100vh', paddingTop: 64 }}>
        {/* Page header */}
        <section
          style={{
            position: 'relative',
            padding: '80px 24px 60px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,168,56,0.07) 0%, transparent 60%), #FFFFFF',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
            <h1
              className="site-headline"
              style={{ fontSize: 'clamp(40px, 5vw, 64px)', color: '#1D1D1F', marginBottom: 16 }}
            >
              Our Painting Services
            </h1>
            <p className="site-body" style={{ fontSize: 18, maxWidth: 560, margin: '0 auto 32px' }}>
              Complete painting solutions for homes and businesses across Des Moines and surrounding communities.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/#quote" className="btn btn-accent" style={{ fontSize: 15 }}>
                Get a Free Quote
                <ChevronRight size={16} strokeWidth={1.5} />
              </Link>
              <Link href="/book" className="btn btn-ghost" style={{ fontSize: 15 }}>
                Book an Appointment
              </Link>
            </div>
          </div>
        </section>

        {/* Services list */}
        <section style={{ padding: '40px 0 100px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {SERVICES.map((service, index) => (
                <div key={service.name} className="glass" style={{ padding: '40px 48px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: 'rgba(232,168,56,0.1)',
                            border: '1px solid rgba(232,168,56,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#E8A838',
                            flexShrink: 0,
                          }}
                        >
                          {service.icon}
                        </div>
                        <div>
                          <h2
                            style={{
                              fontFamily: "'Cormorant Garamond', Georgia, serif",
                              fontSize: 28,
                              fontWeight: 600,
                              color: '#1D1D1F',
                              marginBottom: 4,
                            }}
                          >
                            {service.name}
                          </h2>
                          <p style={{ color: '#E8A838', fontSize: 14, fontStyle: 'italic' }}>
                            {service.tagline}
                          </p>
                        </div>
                      </div>

                      <p
                        className="site-body"
                        style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}
                      >
                        {service.description}
                      </p>

                      <div>
                        <p
                          style={{
                            color: 'rgba(0,0,0,0.4)',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 12,
                          }}
                        >
                          What is included
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 24px' }}>
                          {service.includes.map((item) => (
                            <li
                              key={item}
                              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'rgba(0,0,0,0.65)' }}
                            >
                              <CheckCircle
                                size={15}
                                strokeWidth={1.5}
                                style={{ color: '#34C759', flexShrink: 0, marginTop: 2 }}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                      <Link href="/#quote" className="btn btn-accent" style={{ whiteSpace: 'nowrap' }}>
                        Get a Free Quote
                        <ChevronRight size={14} strokeWidth={1.5} />
                      </Link>
                      <a
                        href="tel:+15155551234"
                        className="btn btn-ghost"
                        style={{ whiteSpace: 'nowrap', justifyContent: 'center' }}
                      >
                        <Phone size={14} strokeWidth={1.5} />
                        Call Us
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

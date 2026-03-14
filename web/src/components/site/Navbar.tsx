'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Book', href: '/book' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
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
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s',
          boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
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
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 22,
                fontWeight: 600,
                color: '#1D1D1F',
                letterSpacing: '-0.01em',
              }}
            >
              OPN Renovation
            </span>
          </Link>

          {/* Desktop links */}
          <div className="site-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: pathname === item.href ? '#1D1D1F' : 'rgba(0,0,0,0.6)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: pathname === item.href ? 600 : 500,
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

          {/* Mobile hamburger */}
          <button
            className="site-hamburger"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#1D1D1F',
              borderRadius: 8,
            }}
          >
            {open ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {open && (
        <div
          className="site-mobile-menu"
          style={{
            position: 'fixed',
            top: 64,
            left: 0,
            right: 0,
            zIndex: 49,
            background: '#FFFFFF',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            padding: '12px 24px 24px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '14px 0',
                fontSize: 17,
                fontWeight: pathname === item.href ? 600 : 400,
                color: pathname === item.href ? '#1D1D1F' : 'rgba(0,0,0,0.65)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#quote"
            className="btn btn-accent"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16, fontSize: 15 }}
          >
            Get a Free Quote
          </Link>
        </div>
      )}

      {/* Backdrop to close menu */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 64,
            zIndex: 48,
            background: 'rgba(0,0,0,0.20)',
          }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .site-nav-desktop { display: none !important; }
          .site-hamburger   { display: flex !important; }
        }
      `}</style>
    </>
  );
}

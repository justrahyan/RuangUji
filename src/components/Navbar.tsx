import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import logoRuangUji from '../assets/logo-ruanguji.png';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navLinks = [
    { name: 'Beranda', path: '/' },
    { name: 'Bank Pertanyaan', path: '/question-bank' },
    { name: 'Riwayat', path: '/history' },
  ];

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border-color)',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            aria-label="RuangUji Beranda"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontWeight: 800,
              fontSize: '1.25rem',
              color: 'var(--primary-blue)',
            }}
          >
            <img
              src={logoRuangUji}
              alt="Logo RuangUji"
              style={{
                width: 38,
                height: 38,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <span>RuangUji</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden-mobile" style={{ alignItems: 'center', gap: '2rem' }}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: isActive ? 'var(--primary-blue)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--blue-soft)' : 'transparent',
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    transition: 'all 0.2s',
                  }}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* CTA & Mobile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              to="/setup"
              className="btn btn-primary hidden-mobile"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Mulai Latihan
            </Link>

            <button
              className="md-hidden"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}>
        <Link
          to="/"
          aria-label="RuangUji Beranda"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontWeight: 800,
            fontSize: '1.15rem',
            color: 'var(--primary-blue)',
            padding: '0.5rem 0.25rem 1rem',
          }}
        >
          <img
            src={logoRuangUji}
            alt="Logo RuangUji"
            style={{
              width: 40,
              height: 40,
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <span>RuangUji</span>
        </Link>

        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;

          return (
            <Link
              key={link.path}
              to={link.path}
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: isActive ? 'var(--primary-blue)' : 'var(--text-primary)',
                padding: '1rem 1.25rem',
                backgroundColor: isActive ? 'var(--blue-soft)' : 'transparent',
                borderRadius: '1rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {link.name}
            </Link>
          );
        })}

        <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.5rem 0' }} />

        <Link
          to="/setup"
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1rem',
            borderRadius: '1rem',
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Mulai Latihan
        </Link>
      </div>
    </>
  );
}
import { Link } from 'react-router-dom';
import logoRuangUji from '../assets/logo-ruanguji.png';

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: 'var(--white)',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '4.5rem',
        paddingBottom: '2rem',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '3rem',
            marginBottom: '4rem',
          }}
        >
          {/* Logo & Desc */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link
              to="/"
              aria-label="RuangUji Beranda"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontWeight: 800,
                fontSize: '1.25rem',
                color: 'var(--primary-blue)',
              }}
            >
              <img
                src={logoRuangUji}
                alt="Logo RuangUji"
                style={{
                  width: 42,
                  height: 42,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <span>RuangUji</span>
            </Link>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                maxWidth: '280px',
              }}
            >
              Simulator latihan sidang untuk membantu mahasiswa mempersiapkan tanya jawab dengan lebih terarah.
            </p>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Navigasi
            </h4>
            <Link to="/" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Beranda
            </Link>
            <Link to="/question-bank" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Bank Pertanyaan
            </Link>
            <Link to="/history" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              Riwayat
            </Link>
            <Link to="/setup" style={{ color: 'var(--primary-blue)', fontSize: '0.9375rem', fontWeight: 600 }}>
              Mulai Latihan
            </Link>
          </div>

          {/* Practice Focus */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Yang Dilatih
            </h4>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Kesiapan Menjawab</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Argumentasi Akademik</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Pemahaman Penelitian</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Evaluasi Diri</span>
          </div>
        </div>

        {/* Bottom */}
        <div
          className="footer-bottom"
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '2.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
            © {new Date().getFullYear()} RuangUji. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
            Tempat berlatih sebelum ruang sidang yang sesungguhnya.
          </p>
        </div>
      </div>
    </footer>
  );
}
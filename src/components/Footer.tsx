import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--white)', borderTop: '1px solid var(--border-color)', paddingTop: '4.5rem', paddingBottom: '2rem' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '3rem', marginBottom: '4rem' }}>
          
          {/* Logo & Desc */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link to="/" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary-blue)' }}>
              RuangUji
            </Link>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, maxWidth: '280px' }}>
              Simulator latihan sidang untuk membantu mahasiswa mempersiapkan tanya jawab dengan lebih terarah.
            </p>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Navigasi</h4>
            <Link to="/" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Beranda</Link>
            <Link to="/question-bank" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Bank Pertanyaan</Link>
            <Link to="/history" style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Riwayat</Link>
            <Link to="/setup" style={{ color: 'var(--primary-blue)', fontSize: '0.9375rem', fontWeight: 600 }}>Mulai Latihan</Link>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Fitur</h4>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Simulasi Penguji</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Upload Dokumen</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Jawaban Suara</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>Evaluasi Akhir</span>
          </div>

        </div>

        {/* Bottom */}
        <div className="footer-bottom" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
            © {new Date().getFullYear()} RuangUji. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
            Dibuat untuk latihan sidang yang lebih percaya diri.
          </p>
        </div>
      </div>
    </footer>
  );
}

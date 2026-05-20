import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { getHistory } from '../lib/storage';

export default function EvaluationPage() {
  const [evalData, setEvalData] = useState<any>(null);

  useEffect(() => {
    // Try to get latest eval from localStorage
    const savedEval = localStorage.getItem('ruanguji_latest_eval');
    if (savedEval) {
      setEvalData(JSON.parse(savedEval));
    } else {
      // Fallback to latest history item
      const history = getHistory();
      if (history.length > 0) {
        const last = history[0];
        setEvalData({
          score: last.score,
          summary: last.summary || 'Selesai simulasi.',
          strengths: ['Penyelesaian sesi tepat waktu'],
          weaknesses: ['Perlu analisis riwayat lebih lanjut'],
          nextPractice: ['Coba mode penguji lain']
        });
      }
    }
  }, []);

  if (!evalData) {
    return (
      <PageShell>
        <div className="section" style={{ minHeight: 'calc(100vh - 73px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card fade-up soft-shadow" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%', margin: '0 1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Belum ada evaluasi</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Selesaikan satu sesi simulasi untuk melihat hasil evaluasi di sini.</p>
            <Link to="/setup" className="btn btn-primary">
              Mulai Latihan
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="section-soft" style={{ minHeight: 'calc(100vh - 73px)', padding: '2rem 1rem' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          
          <div className="fade-up" style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <h1 className="section-title" style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>Evaluasi Akhir</h1>
            <p className="section-desc" style={{ margin: 0, fontSize: '0.9375rem' }}>Hasil performa dan analisis kesiapan Anda selama sesi simulasi.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="eval-grid">
            
            {/* Score Card */}
            <div className="card fade-up delay-1 soft-shadow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: '96px', height: '96px', borderRadius: '50%', border: '6px solid var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', backgroundColor: 'var(--blue-soft)' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-blue)', lineHeight: 1 }}>{evalData.score}</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                {evalData.score >= 80 ? 'Sangat Baik' : evalData.score >= 60 ? 'Cukup Baik' : 'Perlu Latihan'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>{evalData.summary}</p>
              
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexDirection: 'column' }} className="eval-actions">
                <Link to="/setup" className="btn btn-primary" style={{ width: '100%', padding: '0.625rem 1rem' }}>
                  Latihan Lagi
                </Link>
                <Link to="/history" className="btn btn-secondary" style={{ width: '100%', padding: '0.625rem 1rem' }}>
                  Lihat Riwayat
                </Link>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>
              
              {/* Strengths & Weaknesses */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div className="card fade-up delay-3" style={{ padding: '1.25rem', borderTop: '4px solid #16a34a' }}>
                  <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#16a34a', fontSize: '0.9375rem' }}>
                    <CheckCircle2 size={16} /> Kekuatan
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', margin: 0 }}>
                    {evalData.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="card fade-up delay-4" style={{ padding: '1.25rem', borderTop: '4px solid #ea580c' }}>
                  <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#ea580c', fontSize: '0.9375rem' }}>
                    <AlertCircle size={16} /> Area Perbaikan
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', margin: 0 }}>
                    {evalData.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>

              {/* Next Practice */}
              <div className="card fade-up delay-2 soft-shadow" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={18} color="var(--primary-blue)" /> Saran Latihan Selanjutnya
                </h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {evalData.nextPractice.map((p: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--bg-soft)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)', flexShrink: 0 }}></div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .eval-grid {
            grid-template-columns: 1fr 2fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

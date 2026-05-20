import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import EvaluationResultLayout from '../components/EvaluationResultLayout';
import { getHistory } from '../lib/storage';

export default function EvaluationPage() {
  const [evalData, setEvalData] = useState<any>(null);

  useEffect(() => {
    const savedEval = localStorage.getItem('ruanguji_latest_eval');
    if (savedEval) {
      setEvalData(JSON.parse(savedEval));
      return;
    }

    const history = getHistory();
    if (history.length > 0) {
      const last = history[0];
      setEvalData({
        score: last.score,
        summary: last.summary || 'Simulasi selesai.',
        strengths: last.strengths || ['Penyelesaian sesi tepat waktu'],
        weaknesses: last.weaknesses || ['Perlu analisis riwayat lebih lanjut'],
        nextPractice: last.nextPractice || ['Coba mode penguji lain'],
      });
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
      <EvaluationResultLayout
        title="Evaluasi Akhir"
        subtitle="Hasil performa dan analisis kesiapan Anda selama sesi simulasi."
        score={evalData.score}
        summary={evalData.summary}
        strengths={evalData.strengths}
        weaknesses={evalData.weaknesses}
        nextPractice={evalData.nextPractice}
        actions={
          <>
            <Link to="/setup" className="btn btn-primary" style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              Latihan Lagi
            </Link>
            <Link to="/history" className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              Lihat Riwayat
            </Link>
          </>
        }
      />
    </PageShell>
  );
}

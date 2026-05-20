import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import SectionHeader from '../components/SectionHeader';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import { History, ArrowRight, ArrowLeft, Star, Trash2, CalendarDays, BrainCircuit, BarChart3, Award, CheckCircle2, AlertCircle, FileText, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHistory, deleteHistoryItem, clearHistory } from '../lib/storage';
import type { HistoryItem } from '../types';

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    setHistory(getHistory());
    setToastMessage('Riwayat berhasil dihapus.');
    setToastOpen(true);
  };

  const handleClearAll = () => {
    setModalConfig({
      title: 'Hapus semua riwayat?',
      message: 'Tindakan ini akan menghapus seluruh data simulasi yang tersimpan di perangkat ini.',
      onConfirm: () => {
        clearHistory();
        setHistory([]);
        setToastMessage('Semua riwayat berhasil dihapus.');
        setToastOpen(true);
      }
    });
    setModalOpen(true);
  };

  // Calculate metrics
  const totalSessions = history.length;
  const avgScore = totalSessions > 0 ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalSessions) : 0;
  const bestScore = totalSessions > 0 ? Math.max(...history.map(h => h.score)) : 0;

  if (selectedItem) {
    const statusLabel = selectedItem.score >= 80 ? 'Sangat Baik' : selectedItem.score >= 60 ? 'Cukup Baik' : 'Perlu Latihan';
    const strengths = selectedItem.strengths || ['Penyelesaian sesi tepat waktu'];
    const weaknesses = selectedItem.weaknesses || ['Perlu analisis riwayat lebih lanjut'];
    const nextPractice = selectedItem.nextPractice || ['Coba mode penguji lain'];
    const transcript = selectedItem.transcript || [];

    return (
      <PageShell>
        <div className="section-soft" style={{ minHeight: 'calc(100vh - 73px)', padding: '1.25rem 1rem', backgroundColor: '#f8fafc' }}>
          <div className="container" style={{ maxWidth: '1000px' }}>
            
            {/* Back Header */}
            <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <button 
                onClick={() => setSelectedItem(null)} 
                className="btn btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.75rem', backgroundColor: 'var(--white)' }}
              >
                <ArrowLeft size={16} /> Kembali ke Riwayat
              </button>
              <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', textTransform: 'none' }}>
                <CalendarDays size={12} /> {new Date(selectedItem.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div className="fade-up" style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
              <span className="badge" style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                <BrainCircuit size={12} /> Mode: {selectedItem.examinerMode}
              </span>
              <h1 className="section-title" style={{ marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: 800 }}>Detail Evaluasi Simulasi</h1>
              <p className="section-desc" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{selectedItem.title}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="eval-grid">
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Score Card */}
                <div className="card soft-shadow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1.25rem', textAlign: 'center', backgroundColor: 'var(--white)', borderRadius: '22px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '84px', height: '84px', borderRadius: '50%', border: '6px solid var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', backgroundColor: 'var(--blue-soft)' }}>
                    <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--primary-blue)', lineHeight: 1 }}>{selectedItem.score}</span>
                  </div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.375rem' }}>{statusLabel}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0', lineHeight: 1.4 }}>{selectedItem.summary || 'Simulasi selesai.'}</p>
                </div>

                {/* Research Profile Details */}
                <div className="card soft-shadow" style={{ padding: '1.25rem', backgroundColor: 'var(--white)', borderRadius: '22px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Info size={14} color="var(--primary-blue)" /> Info Simulasi
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.8125rem' }}>
                    {selectedItem.sessionType && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Jenis Sidang: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.sessionType}</strong>
                      </div>
                    )}
                    {selectedItem.field && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Bidang: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.field}</strong>
                      </div>
                    )}
                    {selectedItem.method && (
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Metode: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedItem.method}</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Durasi: </span>
                      <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedItem.sessionLength || 'Normal'} ({selectedItem.questionCount} Pertanyaan)</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
                
                {/* Strengths & Weaknesses */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1rem', borderTop: '4px solid #16a34a', backgroundColor: 'var(--white)', borderRadius: '22px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem', color: '#16a34a', fontSize: '0.875rem' }}>
                      <CheckCircle2 size={14} /> Kekuatan
                    </h4>
                    <ul style={{ paddingLeft: '1.125rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: 0 }}>
                      {strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div className="card" style={{ padding: '1rem', borderTop: '4px solid #ea580c', backgroundColor: 'var(--white)', borderRadius: '22px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem', color: '#ea580c', fontSize: '0.875rem' }}>
                      <AlertCircle size={14} /> Area Perbaikan
                    </h4>
                    <ul style={{ paddingLeft: '1.125rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: 0 }}>
                      {weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Next Practice */}
                <div className="card soft-shadow" style={{ padding: '1.25rem', backgroundColor: 'var(--white)', borderRadius: '22px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Award size={16} color="var(--primary-blue)" /> Saran Latihan Selanjutnya
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {nextPractice.map((p: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-soft)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)', flexShrink: 0 }}></div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transcript Record */}
                <div className="card soft-shadow" style={{ padding: '1.25rem', backgroundColor: 'var(--white)', borderRadius: '22px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <FileText size={16} color="var(--primary-blue)" /> Rekaman Percakapan Tanya-Jawab
                  </h3>
                  {transcript.length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Tidak ada rekaman percakapan dalam riwayat ini.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {transcript.map((tItem: any) => {
                        if (tItem.type === 'question') {
                          return (
                            <div key={tItem.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', padding: '0.875rem 1.125rem', borderRadius: '14px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>PENGUJI (PERTANYAAN)</span>
                              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{tItem.content}</p>
                            </div>
                          );
                        }
                        if (tItem.type === 'answer') {
                          return (
                            <div key={tItem.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', backgroundColor: 'var(--blue-soft)', border: '1px solid var(--blue-border)', padding: '0.875rem 1.125rem', borderRadius: '14px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-blue)' }}>ANDA (JAWABAN)</span>
                              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{tItem.content}</p>
                            </div>
                          );
                        }
                        if (tItem.type === 'feedback') {
                          return (
                            <div key={tItem.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.875rem 1.125rem', borderRadius: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803d' }}>UMPAN BALIK</span>
                                {tItem.score !== undefined && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803d', backgroundColor: 'var(--white)', padding: '0.125rem 0.375rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>Skor: {tItem.score}</span>
                                )}
                              </div>
                              <p style={{ fontSize: '0.875rem', color: '#166534', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tItem.content}</p>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
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

  return (
    <PageShell>
      {/* Header Section */}
      <section className="section" style={{ backgroundColor: 'var(--white)', borderBottom: '1px solid var(--border-color)', padding: '2.5rem 0 1.5rem 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <SectionHeader 
                label="Riwayat Simulasi"
                title="Pantau perkembangan latihan sidang Anda."
                subtitle="Lihat skor, mode penguji, dan lembar evaluasi lengkap dari sesi-sesi sebelumnya."
              />
            </div>
            {history.length > 0 && (
              <button 
                onClick={handleClearAll} 
                className="btn" 
                style={{ 
                  backgroundColor: '#fee2e2', 
                  color: '#b91c1c', 
                  border: '1px solid #fca5a5', 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.875rem',
                  borderRadius: '0.75rem',
                  marginTop: '0.5rem'
                }}
              >
                <Trash2 size={16} /> Hapus Semua
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section-soft" style={{ backgroundColor: '#f8fafc', padding: '3.5rem 0', minHeight: '50vh' }}>
        <div className="container">
          
          {history.length === 0 ? (
            <div className="card fade-up soft-shadow" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'var(--white)', borderRadius: '22px', border: '1px solid var(--border-color)', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <History size={32} color="var(--primary-blue)" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Belum ada riwayat simulasi</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem', maxWidth: '340px' }}>Mulai latihan sidang pertama Anda untuk melihat hasil evaluasi di sini.</p>
              <Link to="/setup" className="btn btn-primary" style={{ padding: '0.875rem 2rem', borderRadius: '0.75rem' }}>
                Mulai Latihan <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Summary Cards */}
              <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderRadius: '22px', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', borderRadius: '0.75rem' }}>
                    <History size={24} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Sesi</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{totalSessions} Sesi</h3>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderRadius: '22px', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '0.75rem' }}>
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rata-rata Skor</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{avgScore} / 100</h3>
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderRadius: '22px', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '0.75rem' }}>
                    <Award size={24} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Skor Terbaik</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{bestScore} / 100</h3>
                  </div>
                </div>
              </div>

              {/* Sesi List */}
              <div className="fade-up delay-2" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {history.map((item) => {
                  const statusLabel = item.score >= 80 ? 'Siap' : item.score >= 60 ? 'Cukup Siap' : 'Perlu Latihan';
                  const statusBg = item.score >= 80 ? '#dcfce7' : item.score >= 60 ? '#fef3c7' : '#ffedd5';
                  const statusColor = item.score >= 80 ? '#15803d' : item.score >= 60 ? '#b45309' : '#ea580c';

                  return (
                    <div key={item.id} onClick={() => setSelectedItem(item)} className="card card-hover soft-shadow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', flexWrap: 'wrap', gap: '1.5rem', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '22px', cursor: 'pointer' }}>
                      
                      <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', textTransform: 'none' }}>
                            <CalendarDays size={12} /> {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="badge" style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                            <BrainCircuit size={12} /> {item.examinerMode}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>{item.title}</h4>
                        <p className="line-clamp-4" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                          {item.summary || `Simulasi selesai dengan total ${item.questionCount} pertanyaan.`}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>
                            <Star fill="#f59e0b" color="#f59e0b" size={20} /> {item.score}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, backgroundColor: statusBg, padding: '0.25rem 0.625rem', borderRadius: '1rem' }}>
                            {statusLabel}
                          </span>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          className="btn"
                          style={{ backgroundColor: 'transparent', border: '1px solid #e2e8f0', color: '#94a3b8', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}
                          title="Hapus riwayat"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      </section>

      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText="Hapus Semua"
        cancelText="Batal"
      />

      <Toast 
        isOpen={toastOpen} 
        message={toastMessage} 
        onClose={() => setToastOpen(false)} 
      />
    </PageShell>
  );
}

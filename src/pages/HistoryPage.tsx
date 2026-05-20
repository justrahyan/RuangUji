import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import SectionHeader from '../components/SectionHeader';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import { History, ArrowRight, Star, Trash2, CalendarDays, BrainCircuit, BarChart3, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHistory, deleteHistoryItem, clearHistory } from '../lib/storage';
import type { HistoryItem } from '../types';

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
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
                    <div key={item.id} className="card card-hover soft-shadow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', flexWrap: 'wrap', gap: '1.5rem', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '22px' }}>
                      
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
                          onClick={() => handleDelete(item.id)}
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

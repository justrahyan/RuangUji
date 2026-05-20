import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import type { ExaminerMode, SessionLength, ResearchProfile, DefenseSession } from '../types';
import { saveLatestResearch, saveActiveSession } from '../lib/storage';

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('Seminar Proposal');
  const [field, setField] = useState('');
  const [method, setMethod] = useState('');
  const [abstract, setAbstract] = useState('');
  const [concern, setConcern] = useState('');
  const [examinerMode, setExaminerMode] = useState<ExaminerMode>('kritis');
  const [sessionLength, setSessionLength] = useState<SessionLength>('normal');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || location.state?.q;
    if (q) {
      setConcern(`Fokus latihan pada pertanyaan: "${q}"`);
    }
  }, [location]);

  const handleNextStep1 = () => {
    if (!title.trim()) {
      setError('Judul penelitian tidak boleh kosong.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!method.trim() || !abstract.trim()) {
      setError('Metode dan abstrak penelitian tidak boleh kosong.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleSubmit = () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const questionCount = sessionLength === 'cepat' ? 5 : sessionLength === 'normal' ? 8 : 12;

    const research: ResearchProfile = {
      id,
      title,
      sessionType,
      field,
      method,
      abstract,
      concern,
      examinerMode,
      sessionLength,
      questionCount,
      createdAt: new Date().toISOString()
    };

    const session: DefenseSession = {
      id,
      research,
      transcript: [],
      currentQuestionIndex: 0,
      score: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    saveLatestResearch(research);
    saveActiveSession(session);
    navigate('/defense');
  };

  const examinerOptions: { id: ExaminerMode; label: string; desc: string }[] = [
    { id: 'santai', label: 'Santai', desc: 'Pertanyaan ringan dan membantu membangun percaya diri.' },
    { id: 'kritis', label: 'Kritis', desc: 'Pertanyaan tajam, tetapi tetap objektif.' },
    { id: 'killer', label: 'Killer', desc: 'Simulasi tekanan tinggi dengan pertanyaan sulit.' },
    { id: 'metodologi', label: 'Metodologi', desc: 'Fokus pada tahapan penelitian, validitas, dan alasan metode.' },
    { id: 'statistik', label: 'Statistik/Data', desc: 'Fokus pada data, metrik, evaluasi, dan pembuktian hasil.' },
    { id: 'novelty', label: 'Novelty', desc: 'Fokus pada kebaruan, kontribusi, dan pembeda penelitian.' },
    { id: 'implementasi', label: 'Implementasi', desc: 'Fokus pada penerapan, sistem, alur kerja, dan dampak praktis.' }
  ];

  const lengthOptions: { id: SessionLength; label: string; count: number }[] = [
    { id: 'cepat', label: 'Cepat', count: 5 },
    { id: 'normal', label: 'Normal', count: 8 },
    { id: 'intensif', label: 'Intensif', count: 12 }
  ];

  return (
    <PageShell>
      <div className="section-soft" style={{ minHeight: 'calc(100vh - 73px)' }}>
        <div className="container" style={{ maxWidth: '960px' }}>
          
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <ArrowLeft size={16} /> Kembali
            </Link>
            <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>Siapkan Sidangmu</h1>
            <p className="section-desc" style={{ margin: 0 }}>Lengkapi informasi penelitian agar simulasi pertanyaan menjadi lebih relevan.</p>
          </div>
          
          <div className="card fade-up delay-1 soft-shadow" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--white)' }}>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-blue)', marginBottom: '0.25rem' }}>
                  Tahap {step} dari 3
                </p>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {step === 1 ? 'Informasi Penelitian' : step === 2 ? 'Detail Penelitian' : 'Gaya Penguji'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <div style={{ width: '40px', height: '6px', backgroundColor: step >= 1 ? 'var(--primary-blue)' : 'var(--bg-soft)', borderRadius: '99px', transition: 'background-color 0.3s' }}></div>
                <div style={{ width: '40px', height: '6px', backgroundColor: step >= 2 ? 'var(--primary-blue)' : 'var(--bg-soft)', borderRadius: '99px', transition: 'background-color 0.3s' }}></div>
                <div style={{ width: '40px', height: '6px', backgroundColor: step >= 3 ? 'var(--primary-blue)' : 'var(--bg-soft)', borderRadius: '99px', transition: 'background-color 0.3s' }}></div>
              </div>
            </div>

            <div style={{ padding: '2rem', backgroundColor: 'var(--white)' }}>
              
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="fade-up" style={{ display: 'grid', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Judul Penelitian <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Masukkan judul penelitian Anda..." 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Jenis Sidang <span style={{ color: '#ef4444' }}>*</span></label>
                      <select 
                        className="input" 
                        value={sessionType}
                        onChange={(e) => setSessionType(e.target.value)}
                      >
                        <option value="Seminar Proposal">Seminar Proposal</option>
                        <option value="Seminar Hasil">Seminar Hasil</option>
                        <option value="Sidang Skripsi">Sidang Skripsi</option>
                        <option value="Presentasi Paper">Presentasi Paper</option>
                        <option value="Ujian Tugas Akhir">Ujian Tugas Akhir</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Bidang / Topik</label>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Contoh: Machine Learning, Sistem Pakar, Pendidikan..." 
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="fade-up" style={{ display: 'grid', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Metode Penelitian <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Contoh: Random Forest, AdaBoost, Forward Chaining, CNN..." 
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Abstrak / Ringkasan Penelitian <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea 
                      className="textarea" 
                      rows={5} 
                      placeholder="Jelaskan latar belakang, tujuan, metode, data, dan hasil utama penelitianmu..." 
                      value={abstract}
                      onChange={(e) => setAbstract(e.target.value)}
                    ></textarea>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Bagian yang Masih Dikhawatirkan (Opsional)</label>
                    <textarea 
                      className="textarea" 
                      rows={3} 
                      placeholder="Contoh: Saya masih kurang yakin menjelaskan validasi model dan alasan pemilihan metode..." 
                      value={concern}
                      onChange={(e) => setConcern(e.target.value)}
                    ></textarea>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="fade-up" style={{ display: 'grid', gap: '2rem' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Pilih Mode Penguji</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      {examinerOptions.map((opt) => (
                        <div 
                          key={opt.id}
                          onClick={() => setExaminerMode(opt.id)}
                          style={{
                            padding: '1rem',
                            border: examinerMode === opt.id ? '2px solid var(--primary-blue)' : '1px solid var(--border-color)',
                            backgroundColor: examinerMode === opt.id ? 'var(--blue-soft)' : 'var(--white)',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.375rem'
                          }}
                        >
                          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: examinerMode === opt.id ? 'var(--primary-blue)' : 'var(--text-primary)' }}>{opt.label}</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{opt.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Durasi Sesi</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {lengthOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setSessionLength(opt.id)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            border: sessionLength === opt.id ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: sessionLength === opt.id ? 'var(--primary-blue)' : 'var(--white)',
                            color: sessionLength === opt.id ? 'var(--white)' : 'var(--text-primary)',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '1rem' }}>{opt.label}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{opt.count} Pertanyaan</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                {step === 1 ? (
                  <Link to="/" className="btn btn-secondary">
                    Kembali ke Beranda
                  </Link>
                ) : (
                  <button className="btn btn-secondary" onClick={() => { setStep(step - 1); setError(''); }}>
                    Kembali
                  </button>
                )}

                {step === 1 && (
                  <button className="btn btn-primary" onClick={handleNextStep1}>
                    Lanjut <ArrowRight size={18} />
                  </button>
                )}
                {step === 2 && (
                  <button className="btn btn-primary" onClick={handleNextStep2}>
                    Lanjut <ArrowRight size={18} />
                  </button>
                )}
                {step === 3 && (
                  <button className="btn btn-primary" onClick={handleSubmit}>
                    Masuki Ruang Sidang <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}

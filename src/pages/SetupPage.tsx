import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { ArrowLeft, ArrowRight, AlertCircle, UploadCloud, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';
import type { ExaminerMode, SessionLength, ResearchProfile, DefenseSession } from '../types';
import { saveLatestResearch, saveActiveSession } from '../lib/storage';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  // Step 1
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('Sidang Skripsi');
  const [field, setField] = useState('');
  const [keywords, setKeywords] = useState('');

  // Step 2
  const [researchApproach, setResearchApproach] = useState('');
  const [method, setMethod] = useState('');
  const [abstract, setAbstract] = useState('');
  const [concern, setConcern] = useState('');

  // Document Upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [documentText, setDocumentText] = useState('');      // full extracted text for AI context
  const [documentPreview, setDocumentPreview] = useState(''); // short preview / ringkasan for user
  const [showUseExtracted, setShowUseExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [examinerMode, setExaminerMode] = useState<ExaminerMode>('kritis');
  const [sessionLength, setSessionLength] = useState<SessionLength>('normal');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || location.state?.q;
    if (q) setConcern(`Fokus latihan pada pertanyaan: "${q}"`);
  }, [location]);

  // Upload Handlers
  const handleFileSelect = async (file: File) => {
    // Client-side validation
    if (file.size > 15 * 1024 * 1024) {
      setUploadedFile(file);
      setUploadStatus('error');
      setUploadError('Ukuran berkas melebihi batas 15 MB. Harap kompres atau pilih berkas yang lebih kecil.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext || '')) {
      setUploadedFile(file);
      setUploadStatus('error');
      setUploadError('Format berkas tidak didukung. Hanya PDF dan DOCX yang diizinkan.');
      return;
    }

    setUploadedFile(file);
    setUploadStatus('loading');
    setUploadError('');
    setDocumentText('');
    setDocumentPreview('');
    setShowUseExtracted(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-document', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.ok && data.text) {
        setDocumentText(data.text);             // full context for AI
        setDocumentPreview(data.preview || '');  // short preview for user
        setUploadStatus('success');
        // Never auto-fill abstract — always show button
        setShowUseExtracted(true);
      } else {
        setUploadStatus('error');
        setUploadError(data.error || 'Tidak dapat membaca isi dokumen.');
      }
    } catch {
      setUploadStatus('error');
      setUploadError('Gagal menghubungi server. Pastikan server berjalan dan coba lagi.');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove file but do NOT clear abstract (preserve user's typed text)
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadStatus('idle');
    setUploadError('');
    setDocumentText('');
    setDocumentPreview('');
    setShowUseExtracted(false);
    // abstract stays as-is — don't clear user's text
  };

  const handleUseExtracted = () => {
    // Fill abstract with the short preview, not the full document text
    setAbstract(documentPreview || documentText.substring(0, 2000));
    setShowUseExtracted(false);
  };

  // Navigation
  const handleNextStep1 = () => {
    if (!title.trim()) { setError('Judul penelitian tidak boleh kosong.'); return; }
    if (!field.trim()) { setError('Bidang / Topik penelitian tidak boleh kosong.'); return; }
    setError(''); setStep(2);
  };

  const handleNextStep2 = () => {
    if (!researchApproach) { setError('Pendekatan penelitian tidak boleh kosong.'); return; }
    if (!method.trim()) { setError('Metode / Teknik utama tidak boleh kosong.'); return; }
    if (!abstract.trim()) { setError('Ringkasan / Abstrak penelitian tidak boleh kosong. Ketik langsung atau unggah dokumen untuk mengisi otomatis.'); return; }
    setError(''); setStep(3);
  };

  const handleSubmit = () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const questionCount = sessionLength === 'cepat' ? 5 : sessionLength === 'normal' ? 8 : 12;

    const research: ResearchProfile = {
      id, title, sessionType, field, keywords,
      researchApproach, method, abstract, concern,
      documentText: documentText || undefined,
      documentPreview: documentPreview || undefined,
      documentName: uploadedFile?.name,
      documentSize: uploadedFile?.size,
      examinerMode, sessionLength, questionCount,
      createdAt: new Date().toISOString()
    };

    const session: DefenseSession = {
      id, research, transcript: [],
      currentQuestionIndex: 0, score: 0,
      status: 'active', createdAt: new Date().toISOString()
    };

    saveLatestResearch(research);
    saveActiveSession(session);
    navigate('/defense');
  };

  // Static Options
  const examinerOptions: { id: ExaminerMode; label: string; desc: string }[] = [
    { id: 'santai', label: 'Santai', desc: 'Pertanyaan ringan dan membantu membangun percaya diri.' },
    { id: 'kritis', label: 'Kritis', desc: 'Pertanyaan tajam, tetapi tetap objektif.' },
    { id: 'killer', label: 'Killer', desc: 'Simulasi tekanan tinggi dengan pertanyaan sulit.' },
    { id: 'metodologi', label: 'Metodologi', desc: 'Fokus pada tahapan penelitian, validitas, dan alasan metode.' },
    { id: 'statistik', label: 'Statistik / Data', desc: 'Fokus pada data, metrik, evaluasi, dan pembuktian hasil.' },
    { id: 'novelty', label: 'Novelty', desc: 'Fokus pada kebaruan, kontribusi, dan pembeda penelitian.' },
    { id: 'implementasi', label: 'Implementasi', desc: 'Fokus pada penerapan, alur kerja, dan dampak praktis.' },
  ];

  const lengthOptions: { id: SessionLength; label: string; count: number }[] = [
    { id: 'cepat', label: 'Cepat', count: 5 },
    { id: 'normal', label: 'Normal', count: 8 },
    { id: 'intensif', label: 'Intensif', count: 12 },
  ];

  const approachOptions = ['Kuantitatif', 'Kualitatif', 'Mixed Methods', 'R&D / Pengembangan', 'Eksperimen', 'Studi Literatur', 'Lainnya'];
  const sessionTypeOptions = ['Ujian Proposal', 'Seminar Hasil', 'Sidang Skripsi', 'Presentasi Paper', 'Presentasi Tugas Akhir', 'Lainnya'];

  // Styles
  const label = (text: string, required = false, optional = false) => (
    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
      {text}
      {required && <span style={{ color: '#ef4444' }}> *</span>}
      {optional && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (opsional)</span>}
    </label>
  );

  const hint = (text: string) => (
    <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.375rem', lineHeight: 1.5 }}>{text}</p>
  );

  const col2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1.375rem',
  };

  // JS
  return (
    <PageShell>
      <div className="section-soft" style={{ minHeight: 'calc(100vh - 73px)', padding: '2rem 0 3.5rem 0' }}>
        {/* Wider container: 1120px */}
        <div className="container" style={{ maxWidth: '1120px' }}>

          {/* Page Header */}
          <div className="fade-up" style={{ marginBottom: '1.75rem' }}>
            <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
              <ArrowLeft size={16} /> Kembali
            </Link>
            <h1 className="section-title" style={{ marginBottom: '0.375rem' }}>Siapkan Sidangmu</h1>
            <p className="section-desc" style={{ margin: 0 }}>
              Lengkapi informasi penelitian agar simulasi pertanyaan menjadi lebih relevan untuk bidang Anda.
            </p>
          </div>

          {/* Card */}
          <div className="card fade-up delay-1 soft-shadow" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Step Header */}
            <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--white)' }}>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-blue)', marginBottom: '0.2rem' }}>
                  Tahap {step} dari 3
                </p>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>
                  {step === 1 ? 'Informasi Penelitian' : step === 2 ? 'Detail Penelitian' : 'Mode Simulasi'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ width: '40px', height: '6px', backgroundColor: step >= s ? 'var(--primary-blue)' : 'var(--bg-soft)', borderRadius: '99px', transition: 'background-color 0.3s' }} />
                ))}
              </div>
            </div>

            {/* Form Body */}
            <div style={{ padding: '2rem', backgroundColor: 'var(--white)' }}>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              {/* ════════════════════════════════
                  STEP 1 – Informasi Penelitian
                  ════════════════════════════════ */}
              {step === 1 && (
                <div className="fade-up" style={{ display: 'grid', gap: '1.375rem' }}>

                  {/* Judul — full width */}
                  <div>
                    {label('Judul Penelitian', true)}
                    <input
                      type="text"
                      className="input"
                      placeholder="Contoh: Analisis Pengaruh Media Sosial terhadap Pola Belajar Mahasiswa"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>

                  {/* Jenis Sidang + Bidang/Topik — 2 kolom */}
                  <div style={col2}>
                    <div>
                      {label('Jenis Sidang / Presentasi', true)}
                      <select className="input" value={sessionType} onChange={e => setSessionType(e.target.value)}>
                        {sessionTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      {label('Bidang / Topik', true)}
                      <input
                        type="text"
                        className="input"
                        placeholder="Contoh: pendidikan, kesehatan masyarakat, hukum, ekonomi, teknologi"
                        value={field}
                        onChange={e => setField(e.target.value)}
                      />
                      {hint('Pisahkan beberapa topik dengan koma.')}
                    </div>
                  </div>

                  {/* Kata Kunci — full width */}
                  <div>
                    {label('Kata Kunci / Fokus Kajian', false, true)}
                    <input
                      type="text"
                      className="input"
                      placeholder="Contoh: motivasi belajar, kualitas layanan, perilaku konsumen, kebijakan publik"
                      value={keywords}
                      onChange={e => setKeywords(e.target.value)}
                    />
                    {hint('Kata kunci membantu AI memahami fokus penelitian Anda secara lebih spesifik.')}
                  </div>

                </div>
              )}

              {/* ════════════════════════════════
                  STEP 2 – Detail Penelitian
                  ════════════════════════════════ */}
              {step === 2 && (
                <div className="fade-up" style={{ display: 'grid', gap: '1.375rem' }}>

                  {/* Pendekatan + Metode — 2 kolom */}
                  <div style={col2}>
                    <div>
                      {label('Pendekatan Penelitian', true)}
                      <select
                        className="input"
                        value={researchApproach}
                        onChange={e => setResearchApproach(e.target.value)}
                      >
                        <option value="">Pilih pendekatan</option>
                        {approachOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {hint('Pilih pendekatan umum yang paling sesuai dengan desain penelitian Anda.')}
                    </div>
                    <div>
                      {label('Metode / Teknik Utama', true)}
                      <input
                        type="text"
                        className="input"
                        placeholder="Contoh: survei, wawancara, analisis regresi, studi kasus, pengembangan sistem"
                        value={method}
                        onChange={e => setMethod(e.target.value)}
                      />
                      {hint('Isi dengan metode atau teknik inti yang digunakan.')}
                    </div>
                  </div>

                  {/* Upload Dokumen — full width */}
                  <div>
                    {label('Unggah Dokumen Penelitian', false, true)}

                    {uploadedFile ? (
                      /* File Info Card */
                      <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem 1.25rem', backgroundColor: 'var(--bg-soft)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                            <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileText size={18} color="var(--primary-blue)" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }}>
                                {uploadedFile.name}
                              </p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatBytes(uploadedFile.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={handleRemoveFile}
                            title="Hapus berkas"
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', borderRadius: '4px', display: 'flex' }}
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* Status */}
                        <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {uploadStatus === 'loading' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--primary-blue)', fontSize: '0.8125rem' }}>
                              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                              Membaca isi dokumen…
                            </span>
                          )}
                          {uploadStatus === 'success' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#16a34a', fontSize: '0.8125rem', fontWeight: 600 }}>
                              <CheckCircle2 size={14} />
                              Berhasil dibaca.
                            </span>
                          )}
                          {uploadStatus === 'error' && (
                            <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', color: '#b91c1c', fontSize: '0.8125rem', fontWeight: 500 }}>
                              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                              {uploadError}
                            </span>
                          )}
                          {showUseExtracted && uploadStatus === 'success' && (
                            <button
                              onClick={handleUseExtracted}
                              style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary-blue)', backgroundColor: 'var(--blue-soft)', border: '1px solid var(--primary-blue)', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Gunakan hasil ekstraksi dokumen
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Dropzone */
                      <div
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: '2px dashed var(--border-color)', borderRadius: '0.75rem', padding: '1.75rem 1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s, background-color 0.2s', backgroundColor: 'var(--bg-soft)' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--primary-blue)';
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--blue-soft)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)';
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-soft)';
                        }}
                      >
                        <UploadCloud size={30} color="var(--text-muted)" style={{ marginBottom: '0.625rem' }} />
                        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                          Klik atau seret berkas ke sini
                        </p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          PDF atau DOCX · maks. 15 MB · Dokumen akan digunakan sebagai konteks tambahan oleh AI.
                        </p>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      style={{ display: 'none' }}
                      onChange={handleFileInputChange}
                    />
                  </div>

                  {/* Abstrak — full width */}
                  <div>
                    {label('Ringkasan / Abstrak Penelitian', true)}
                    <textarea
                      className="textarea"
                      rows={7}
                      placeholder="Jelaskan latar belakang, tujuan, metode, data/sumber informasi, dan hasil atau kontribusi utama penelitian Anda."
                      value={abstract}
                      onChange={e => setAbstract(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                    {hint('Bisa diisi manual atau diisi otomatis dari unggahan dokumen di atas.')}
                  </div>

                  {/* Hal yang Dikhawatirkan — full width */}
                  <div>
                    {label('Hal yang Ingin Dilatih / Dikhawatirkan', false, true)}
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Contoh: saya masih kurang yakin menjelaskan alasan memilih metode, validitas data, kontribusi penelitian, atau perbedaan dengan penelitian sebelumnya."
                      value={concern}
                      onChange={e => setConcern(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                    {hint('Bagian ini membantu penguji memberi pertanyaan yang lebih sesuai dengan kelemahan yang ingin Anda latih.')}
                  </div>

                </div>
              )}

              {/* ════════════════════════════════
                  STEP 3 – Mode Simulasi
                  ════════════════════════════════ */}
              {step === 3 && (
                <div className="fade-up" style={{ display: 'grid', gap: '2rem' }}>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Pilih Mode Penguji</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      {examinerOptions.map(opt => (
                        <div
                          key={opt.id}
                          onClick={() => setExaminerMode(opt.id)}
                          style={{
                            padding: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                            border: examinerMode === opt.id ? '2px solid var(--primary-blue)' : '1px solid var(--border-color)',
                            backgroundColor: examinerMode === opt.id ? 'var(--blue-soft)' : 'var(--white)',
                            borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem'
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
                      {lengthOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setSessionLength(opt.id)}
                          style={{
                            padding: '0.75rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s',
                            border: sessionLength === opt.id ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: sessionLength === opt.id ? 'var(--primary-blue)' : 'var(--white)',
                            color: sessionLength === opt.id ? 'var(--white)' : 'var(--text-primary)',
                            borderRadius: '0.5rem', fontWeight: 600,
                            display: 'flex', flexDirection: 'column', alignItems: 'center'
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

              {/* Footer Nav */}
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                {step === 1
                  ? <Link to="/" className="btn btn-secondary">Kembali ke Beranda</Link>
                  : <button className="btn btn-secondary" onClick={() => { setStep(step - 1); setError(''); }}>Kembali</button>
                }
                {step === 1 && <button className="btn btn-primary" onClick={handleNextStep1}>Lanjut <ArrowRight size={18} /></button>}
                {step === 2 && <button className="btn btn-primary" onClick={handleNextStep2}>Lanjut <ArrowRight size={18} /></button>}
                {step === 3 && <button className="btn btn-primary" onClick={handleSubmit}>Masuki Ruang Sidang <ArrowRight size={18} /></button>}
              </div>

            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </PageShell>
  );
}

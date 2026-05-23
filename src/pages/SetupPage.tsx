import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { ArrowRight, AlertCircle, UploadCloud, FileText, X, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import type { ExaminerMode, SessionLength, ResearchProfile, DefenseSession, TrainingUsageStatus } from '../types';
import {
  saveLatestResearch,
  saveActiveSession,
  setInMemoryDocumentText,
  getSetupCacheConsent,
  setSetupCacheConsent,
  saveSetupDraft,
  getSetupDraft,
  clearSetupDraft,
} from '../lib/storage';
import RuangUjiBot from '../components/RuangUjiBot';
import SectionHeader from '../components/SectionHeader';

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
  const [usageStatus, setUsageStatus] = useState<TrainingUsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaModalMessage, setQuotaModalMessage] = useState('');

  const [setupCacheConsent, setSetupCacheConsentState] = useState<'accepted' | 'declined' | null>(() => getSetupCacheConsent());
  const [showCacheConsent, setShowCacheConsent] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

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
  const [docId, setDocId] = useState('');
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

  useEffect(() => {
    refreshUsageStatus();
  }, []);

  useEffect(() => {
    if (setupCacheConsent === null) {
      setShowCacheConsent(true);
      return;
    }

    if (setupCacheConsent !== 'accepted' || draftRestored) return;

    const draft = getSetupDraft();
    if (!draft) {
      setDraftRestored(true);
      return;
    }

    setTitle(draft.title || '');
    setSessionType(draft.sessionType || 'Sidang Skripsi');
    setField(draft.field || '');
    setKeywords(draft.keywords || '');
    setResearchApproach(draft.researchApproach || '');
    setMethod(draft.method || '');
    setAbstract(draft.abstract || '');
    setConcern(draft.concern || '');
    setExaminerMode((draft.examinerMode as ExaminerMode) || 'kritis');
    setSessionLength((draft.sessionLength as SessionLength) || 'normal');

    if (draft.documentPreview || draft.documentName || draft.docId) {
      setDocumentPreview(draft.documentPreview || '');
      setDocId(draft.docId || '');
      if (draft.documentName) {
        setUploadedFile({
          name: draft.documentName,
          size: draft.documentSize || 0,
        } as File);
        setUploadStatus('success');
      }
    }

    setDraftRestored(true);
  }, [setupCacheConsent, draftRestored]);

  useEffect(() => {
    if (setupCacheConsent !== 'accepted') return;

    const timer = window.setTimeout(() => {
      saveSetupDraft({
        title,
        sessionType,
        field,
        keywords,
        researchApproach,
        method,
        abstract,
        concern,
        examinerMode,
        sessionLength,
        documentPreview,
        documentName: uploadedFile?.name,
        documentSize: uploadedFile?.size,
        docId,
        updatedAt: new Date().toISOString(),
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    setupCacheConsent,
    title,
    sessionType,
    field,
    keywords,
    researchApproach,
    method,
    abstract,
    concern,
    examinerMode,
    sessionLength,
    documentPreview,
    uploadedFile,
    docId,
  ]);

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
    setDocId('');
    setShowUseExtracted(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-document', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.ok && data.text) {
        setDocumentText(data.text);             // full context for AI
        setDocumentPreview(data.preview || '');  // short preview for user
        if (data.docId) {
          setDocId(data.docId);
          setInMemoryDocumentText(data.docId, data.text);
        }
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
    setDocId('');
    setShowUseExtracted(false);
    // abstract stays as-is — don't clear user's text
  };

  const handleUseExtracted = () => {
    // Fill abstract with the short preview, not the full document text
    setAbstract(documentPreview || documentText.substring(0, 2000));
    setShowUseExtracted(false);
  };

  const formatResetTime = (value?: string) => {
    if (!value) return '-';

    try {
      return new Date(value).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const formatShortResetTime = (value?: string) => {
    if (!value) return '-';

    try {
      return new Date(value).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const refreshUsageStatus = async () => {
    setUsageLoading(true);

    try {
      const res = await fetch('/api/usage/status');
      const data = await res.json();

      if (res.ok && data) {
        setUsageStatus(data);
      }
    } catch (err) {
      console.warn('Gagal mengambil status limit latihan:', err);
    } finally {
      setUsageLoading(false);
    }
  };

  const showQuotaModal = (message?: string, status?: TrainingUsageStatus | null) => {
    const activeStatus = status || usageStatus;

    const resetText = activeStatus?.resetAt
      ? ` Reset pada ${formatResetTime(activeStatus.resetAt)}.`
      : '';

    setQuotaModalMessage(
      message ||
      `Batas latihan untuk periode ini sudah habis.${resetText}`
    );

    setQuotaModalOpen(true);
  };

  // Navigation
  const handleNextStep1 = () => {
    if (usageStatus?.blocked || usageStatus?.remaining === 0) {
      showQuotaModal(undefined, usageStatus);
      return;
    }
    if (!title.trim()) { setError('Judul penelitian tidak boleh kosong.'); return; }
    if (!field.trim()) { setError('Bidang / Topik penelitian tidak boleh kosong.'); return; }
    setError(''); setStep(2);
  };

  const handleNextStep2 = () => {
    if (usageStatus?.blocked || usageStatus?.remaining === 0) {
      showQuotaModal(undefined, usageStatus);
      return;
    }
    if (!researchApproach) { setError('Pendekatan penelitian tidak boleh kosong.'); return; }
    if (!method.trim()) { setError('Metode / Teknik utama tidak boleh kosong.'); return; }
    if (!abstract.trim()) { setError('Ringkasan / Abstrak penelitian tidak boleh kosong. Ketik langsung atau unggah dokumen untuk mengisi otomatis.'); return; }
    setError(''); setStep(3);
  };

  const handleSubmit = async () => {
    if (startSessionLoading) return;

    if (usageStatus?.blocked || usageStatus?.remaining === 0) {
      showQuotaModal(undefined, usageStatus);
      return;
    }

    setStartSessionLoading(true);
    setError('');

    try {
      const usageRes = await fetch('/api/usage/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const usageData = await usageRes.json();

      setUsageStatus(usageData);

      if (!usageRes.ok || usageData.blocked || usageData.remaining < 0) {
        showQuotaModal(
          usageData.error ||
          `Batas latihan sudah habis. Silakan coba lagi setelah reset berikutnya.`,
          usageData
        );
        return;
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const questionCount = sessionLength === 'cepat' ? 5 : sessionLength === 'normal' ? 8 : 12;

      // Cache the document text under the new research ID as well
      if (docId && documentText) {
        setInMemoryDocumentText(id, documentText);
      }

      const research: ResearchProfile = {
        id, title, sessionType, field, keywords,
        researchApproach, method, abstract, concern,
        // Omit documentText from localStorage to avoid quota limits
        documentPreview: documentPreview || undefined,
        documentName: uploadedFile?.name,
        documentSize: uploadedFile?.size,
        docId: docId || undefined,
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
      clearSetupDraft();
      navigate('/defense');
    } catch (err) {
      console.error('Gagal memulai sesi:', err);
      setError('Gagal memulai sesi. Pastikan server berjalan, lalu coba lagi.');
    } finally {
      setStartSessionLoading(false);
    }
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

  const approachOptions = [
    'Kuantitatif',
    'Kualitatif',
    'Mixed Methods',
    'R&D / Pengembangan',
    'Eksperimen',
    'Studi Kasus',
    'Studi Literatur',
    'Systematic Review',
    'Perancangan / Implementasi Sistem',
    'Analisis Data / Komputasional',
    'Lainnya',
  ];
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
      <section className="section" style={{ backgroundColor: 'var(--white)', borderBottom: '1px solid var(--border-color)', padding: '2.5rem 0 0 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <SectionHeader
                label="Siapkan Sidangmu"
                title="Bangun simulasi sidang yang sesuai dengan penelitian Anda."
                subtitle="Isi informasi utama penelitian, unggah dokumen pendukung bila perlu, lalu pilih mode penguji untuk memulai latihan."
              />
            </div>
          </div>
        </div>
      </section>

      <div className="section-soft" style={{ minHeight: 'calc(100vh - 73px)', padding: '2rem 0 3.5rem 0' }}>
        {/* Wider container: 1120px */}
        <div className="container" style={{ maxWidth: '1120px' }}>

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
              <div className="setup-step-right">
                {step > 1 && usageStatus && (
                  <span className={`setup-quota-mini ${usageStatus.blocked || usageStatus.remaining === 0 ? 'blocked' : ''}`}>
                    {usageStatus.blocked || usageStatus.remaining === 0
                      ? 'Batas habis'
                      : `Sisa ${usageStatus.remaining}/${usageStatus.limit}`}
                  </span>
                )}

                <div className="setup-progress-bars">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={step >= s ? 'active' : ''}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="setup-quota-wrap">
              <div className={`setup-quota-card fade-up ${usageStatus?.blocked ? 'is-blocked' : ''}`}>
                <div className="setup-quota-top">
                  <div className="setup-quota-left">
                    <div className="setup-quota-icon">
                      {usageStatus?.blocked ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
                    </div>

                    <p className="setup-quota-title">
                      {usageStatus?.blocked ? 'Batas latihan habis' : 'Kuota latihan tersedia'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={refreshUsageStatus}
                    disabled={usageLoading}
                    className="setup-quota-refresh"
                  >
                    {usageLoading ? 'Cek...' : 'Refresh'}
                  </button>
                </div>

                <p className="setup-quota-meta">
                  {usageLoading
                    ? 'Memeriksa kuota...'
                    : usageStatus
                      ? `Sisa ${usageStatus.remaining}/${usageStatus.limit} sesi · Reset ${formatShortResetTime(usageStatus.resetAt)}`
                      : 'Status kuota belum tersedia.'}
                </p>
              </div>
            </div>

            {/* Form Body */}
            <div style={{ padding: '1.35rem 2rem 2rem', backgroundColor: 'var(--white)' }}>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              {/* STEP 1 – Informasi Penelitian */}
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

              {/* STEP 2 – Detail Penelitian */}
              {step === 2 && (
                <div className="fade-up" style={{ display: 'grid', gap: '1.375rem' }}>

                  {/* Pendekatan + Metode — 2 kolom */}
                  <div style={col2}>
                    <div>
                      {label('Pendekatan / Desain Penelitian', true)}
                      <select
                        className="input"
                        value={researchApproach}
                        onChange={e => setResearchApproach(e.target.value)}
                      >
                        <option value="">Pilih pendekatan</option>
                        {approachOptions.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {hint('Pilih desain umum penelitian. Jika tidak pas, pilih “Lainnya” lalu jelaskan di metode utama.')}
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
                      {hint('Isi dengan metode, teknik, model, instrumen, atau prosedur inti yang paling menentukan penelitian Anda.')}
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

              {/* STEP 3 – Mode Simulasi */}
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
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '1rem',
                      }}
                    >
                      Durasi Sesi
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '0.5rem',
                        width: '100%',
                      }}
                    >
                      {lengthOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setSessionLength(opt.id)}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            padding: '0.7rem 0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: sessionLength === opt.id ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: sessionLength === opt.id ? 'var(--primary-blue)' : 'var(--white)',
                            color: sessionLength === opt.id ? 'var(--white)' : 'var(--text-primary)',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 'clamp(0.78rem, 2.8vw, 1rem)',
                              lineHeight: 1.2,
                            }}
                          >
                            {opt.label}
                          </span>

                          <span
                            style={{
                              fontSize: 'clamp(0.62rem, 2.3vw, 0.75rem)',
                              opacity: 0.8,
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {opt.count} Pertanyaan
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Footer Nav */}
              <div className="setup-footer-nav">
                {step === 1
                  ? <Link to="/" className="btn btn-secondary setup-footer-btn">Kembali</Link>
                  : <button className="btn btn-secondary setup-footer-btn" onClick={() => { setStep(step - 1); setError(''); }}>Kembali</button>
                }
                {step === 1 && (
                  <button
                    className="btn btn-primary setup-footer-btn"
                    onClick={handleNextStep1}
                    disabled={usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0}
                    style={{
                      opacity: usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 0.65 : 1,
                      cursor: usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title={usageStatus?.blocked || usageStatus?.remaining === 0 ? 'Batas latihan sudah habis untuk periode ini.' : undefined}
                  >
                    {usageStatus?.blocked || usageStatus?.remaining === 0 ? 'Batas Latihan Habis' : <>Lanjut <ArrowRight size={18} /></>}
                  </button>
                )}
                {step === 2 && (
                  <button
                    className="btn btn-primary setup-footer-btn"
                    onClick={handleNextStep2}
                    disabled={usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0}
                    style={{
                      opacity: usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 0.65 : 1,
                      cursor: usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title={usageStatus?.blocked || usageStatus?.remaining === 0 ? 'Batas latihan sudah habis untuk periode ini.' : undefined}
                  >
                    {usageStatus?.blocked || usageStatus?.remaining === 0 ? 'Batas Latihan Habis' : <>Lanjut <ArrowRight size={18} /></>}
                  </button>
                )}
                {step === 3 && (
                  <button
                    className="btn btn-primary setup-footer-btn"
                    onClick={handleSubmit}
                    disabled={startSessionLoading || usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0}
                    style={{
                      opacity: startSessionLoading || usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 0.65 : 1,
                      cursor: startSessionLoading || usageLoading || usageStatus?.blocked || usageStatus?.remaining === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title={usageStatus?.blocked || usageStatus?.remaining === 0 ? 'Batas latihan sudah habis untuk periode ini.' : undefined}
                  >
                    {startSessionLoading ? (
                      <>
                        <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                        Menyiapkan Sesi...
                      </>
                    ) : usageStatus?.blocked || usageStatus?.remaining === 0 ? (
                      <>
                        Batas Latihan Habis
                      </>
                    ) : (
                      <>
                        Masuki Ruang Sidang <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {quotaModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={() => setQuotaModalOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
            }}
          />

          <div
            className="card fade-up"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 460,
              backgroundColor: 'var(--white)',
              borderRadius: 24,
              padding: '1.5rem',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={24} />
            </div>

            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              Batas Latihan Tercapai
            </h3>

            <p
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: '1rem',
              }}
            >
              {quotaModalMessage}
            </p>

            {usageStatus && (
              <div
                style={{
                  padding: '0.875rem',
                  borderRadius: 14,
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>
                  Sisa sesi: {usageStatus.remaining}/{usageStatus.limit}
                </strong>
                <br />
                Reset berikutnya: {formatResetTime(usageStatus.resetAt)}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuotaModalOpen(false);
                  refreshUsageStatus();
                }}
              >
                Cek Ulang
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setQuotaModalOpen(false)}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {showCacheConsent && setupCacheConsent !== 'accepted' && (
        <div
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 9999,
            width: 'min(420px, calc(100vw - 2rem))',
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border-color)',
            borderRadius: 24,
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
            padding: '1rem',
          }}
          className="fade-up"
        >
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              <RuangUjiBot state="idle" size={58} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                <ShieldCheck size={16} color="var(--primary-blue)" />
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  Simpan draft?
                </h3>
              </div>

              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Aktifkan agar isian latihan tidak hilang saat halaman refresh.
              </p>

              <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>
                File asli tidak disimpan di browser.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.9rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem', borderRadius: '999px' }}
                  onClick={() => {
                    setSetupCacheConsent('declined');
                    setSetupCacheConsentState('declined');
                    setShowCacheConsent(false);
                    clearSetupDraft();
                  }}
                >
                  Tidak sekarang
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', borderRadius: '999px' }}
                  onClick={() => {
                    setSetupCacheConsent('accepted');
                    setSetupCacheConsentState('accepted');
                    setShowCacheConsent(false);
                  }}
                >
                  Aktifkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {setupCacheConsent === 'declined' && !showCacheConsent && (
        <button
          type="button"
          className="setup-cache-fab"
          onClick={() => setShowCacheConsent(true)}
          aria-label="Aktifkan penyimpanan draft setup"
        >
          <RuangUjiBot state="idle" size={46} />

          <span className="setup-cache-fab-bubble">
            Aktifkan draft agar isian latihan tetap tersimpan saat refresh.
          </span>
        </button>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .setup-cache-fab {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 9998;
          width: 64px;
          height: 64px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--white);
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .setup-cache-fab:hover {
          transform: translateY(-3px);
          box-shadow: 0 22px 60px rgba(37, 99, 235, 0.22);
        }

        .setup-cache-fab-bubble {
          position: absolute;
          right: calc(100% + 12px);
          bottom: 10px;
          width: 230px;
          padding: 0.7rem 0.8rem;
          border-radius: 16px;
          background: #0f172a;
          color: #ffffff;
          font-size: 0.76rem;
          font-weight: 600;
          line-height: 1.45;
          text-align: left;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22);
          opacity: 0;
          transform: translateX(8px) translateY(4px);
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .setup-cache-fab-bubble::after {
          content: '';
          position: absolute;
          right: -6px;
          bottom: 18px;
          width: 12px;
          height: 12px;
          background: #0f172a;
          transform: rotate(45deg);
        }

        .setup-cache-fab:hover .setup-cache-fab-bubble {
          opacity: 1;
          transform: translateX(0) translateY(0);
        }

        @media (max-width: 640px) {
          .setup-cache-fab {
            right: 14px;
            bottom: 14px;
            width: 58px;
            height: 58px;
          }

          .setup-cache-fab-bubble {
            display: none;
          }
        }
      `}</style>
    </PageShell>
  );
}

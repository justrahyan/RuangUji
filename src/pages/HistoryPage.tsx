import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import SectionHeader from '../components/SectionHeader';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import EvaluationResultLayout from '../components/EvaluationResultLayout';
import { History, ArrowRight, ArrowLeft, Star, Trash2, CalendarDays, BrainCircuit, BarChart3, Award, Download } from 'lucide-react';
import { getHistory, deleteHistoryItem, clearHistory } from '../lib/storage';
import type { HistoryItem } from '../types';
import jsPDF from 'jspdf';

type TranscriptPdfGroup = {
  number: number;
  question?: string;
  answer?: string;
  feedback?: string;
  score?: number;
};

function sanitizePdfFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'transkrip-ruanguji';
}

function formatPdfDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTranscriptPdfGroups(transcript: HistoryItem['transcript'] = []): TranscriptPdfGroup[] {
  const groups: TranscriptPdfGroup[] = [];

  transcript.forEach((item) => {
    if (item.type === 'question') {
      groups.push({
        number: groups.length + 1,
        question: item.content,
      });
      return;
    }

    if (item.type === 'answer') {
      const target = [...groups].reverse().find((group) => !group.answer);
      if (target) target.answer = item.content;
      return;
    }

    if (item.type === 'feedback') {
      const target = [...groups].reverse().find((group) => !group.feedback);
      if (target) {
        target.feedback = item.content;
        target.score = item.score;
      }
    }
  });

  return groups;
}

function downloadTranscriptPdf(item: HistoryItem) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (height = 12) => {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  const addWrappedText = (
    text: string,
    options?: {
      size?: number;
      style?: 'normal' | 'bold';
      color?: [number, number, number];
      lineHeight?: number;
      indent?: number;
    }
  ) => {
    const size = options?.size ?? 10;
    const style = options?.style ?? 'normal';
    const color = options?.color ?? [15, 23, 42];
    const lineHeight = options?.lineHeight ?? 5.5;
    const indent = options?.indent ?? 0;

    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text || '-', contentWidth - indent);

    lines.forEach((line: string) => {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    });
  };

  const addLabelValue = (label: string, value?: string | number | null) => {
    if (value === undefined || value === null || String(value).trim() === '') return;

    ensureSpace(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const valueLines = doc.splitTextToSize(String(value), contentWidth - 46);
    doc.text(valueLines, margin + 46, y);
    y += Math.max(7, valueLines.length * 5);
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(14);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(37, 99, 235);
    doc.text(title, margin, y);
    y += 7;
  };

  // Cover header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Transkrip Simulasi RuangUji', margin, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Dokumen hasil latihan tanya-jawab sidang akademik', margin, 25);

  y = 45;

  // Score card
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentWidth, 28, 4, 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.text(String(item.score ?? 0), margin + 8, y + 18);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Skor Akhir', margin + 31, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(item.summary || 'Simulasi selesai.', margin + 31, y + 18, {
    maxWidth: contentWidth - 38,
  });

  y += 40;

  addSectionTitle('Informasi Simulasi');
  addLabelValue('Judul', item.title);
  addLabelValue('Tanggal', formatPdfDate(item.createdAt));
  addLabelValue('Jenis Sidang', item.sessionType);
  addLabelValue('Bidang', item.field);
  addLabelValue('Metode', item.method);
  addLabelValue('Mode Penguji', item.examinerMode);
  addLabelValue('Durasi', `${item.sessionLength || 'Normal'} (${item.questionCount} Pertanyaan)`);

  addSectionTitle('Ringkasan Evaluasi');
  addWrappedText(item.summary || 'Simulasi selesai.', {
    size: 10,
    color: [51, 65, 85],
    lineHeight: 5.5,
  });

  if (item.strengths?.length) {
    addSectionTitle('Kekuatan');
    item.strengths.forEach((strength, index) => {
      addWrappedText(`${index + 1}. ${strength}`, {
        size: 10,
        color: [22, 101, 52],
        lineHeight: 5.5,
      });
    });
  }

  if (item.weaknesses?.length) {
    addSectionTitle('Area Perbaikan');
    item.weaknesses.forEach((weakness, index) => {
      addWrappedText(`${index + 1}. ${weakness}`, {
        size: 10,
        color: [154, 52, 18],
        lineHeight: 5.5,
      });
    });
  }

  if (item.nextPractice?.length) {
    addSectionTitle('Saran Latihan Selanjutnya');
    item.nextPractice.forEach((practice, index) => {
      addWrappedText(`${index + 1}. ${practice}`, {
        size: 10,
        color: [30, 64, 175],
        lineHeight: 5.5,
      });
    });
  }

  const groups = buildTranscriptPdfGroups(item.transcript);

  addSectionTitle('Rekaman Percakapan Tanya-Jawab');

  if (groups.length === 0) {
    addWrappedText('Tidak ada data transkrip pada riwayat ini.', {
      size: 10,
      color: [100, 116, 139],
    });
  }

  groups.forEach((group) => {
    ensureSpace(24);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 11, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text(`PERTANYAAN ${group.number}`, margin + 4, y + 7);

    if (typeof group.score === 'number') {
      doc.setTextColor(21, 128, 61);
      doc.text(`Skor: ${group.score}`, pageWidth - margin - 24, y + 7);
    }

    y += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Penguji', margin, y);
    y += 5;
    addWrappedText(group.question || '-', {
      size: 10,
      color: [15, 23, 42],
      lineHeight: 5.3,
      indent: 2,
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.text('Anda', margin, y);
    y += 5;
    addWrappedText(group.answer || '-', {
      size: 10,
      color: [30, 64, 175],
      lineHeight: 5.3,
      indent: 2,
    });

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('Umpan Balik', margin, y);
    y += 5;
    addWrappedText(group.feedback || '-', {
      size: 10,
      color: [22, 101, 52],
      lineHeight: 5.3,
      indent: 2,
    });

    y += 6;
  });

  // Footer page number
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`RuangUji • Halaman ${i} dari ${totalPages}`, margin, pageHeight - 8);
  }

  const filename = `transkrip-ruanguji-${sanitizePdfFilename(item.title)}.pdf`;
  doc.save(filename);
}

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
  }>({ title: '', message: '', onConfirm: () => { } });

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
        setModalOpen(false);
        setToastMessage('Semua riwayat berhasil dihapus.');
        setToastOpen(true);
      },
    });
    setModalOpen(true);
  };

  const totalSessions = history.length;
  const avgScore = totalSessions > 0 ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalSessions) : 0;
  const bestScore = totalSessions > 0 ? Math.max(...history.map((h) => h.score)) : 0;

  if (selectedItem) {
    const createdDate = new Date(selectedItem.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <PageShell>
        <>
          <EvaluationResultLayout
            title="Detail Evaluasi Simulasi"
            subtitle={selectedItem.title}
            score={selectedItem.score}
            summary={selectedItem.summary || 'Simulasi selesai.'}
            strengths={selectedItem.strengths || ['Penyelesaian sesi tepat waktu']}
            weaknesses={selectedItem.weaknesses || ['Perlu analisis riwayat lebih lanjut']}
            nextPractice={selectedItem.nextPractice || ['Coba mode penguji lain']}
            transcript={selectedItem.transcript || []}
            showTranscript
            topAction={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() => setSelectedItem(null)}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--white)',
                  }}
                >
                  <ArrowLeft size={16} /> Kembali ke Riwayat
                </button>

                <button
                  onClick={() => {
                    downloadTranscriptPdf(selectedItem);
                    setToastMessage('Transkrip PDF berhasil dibuat.');
                    setToastOpen(true);
                  }}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.75rem',
                  }}
                >
                  <Download size={16} /> Download Transkrip PDF
                </button>
              </div>
            }
            badges={
              <>
                <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', textTransform: 'none' }}>
                  <CalendarDays size={12} /> {createdDate}
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                  <BrainCircuit size={12} /> Mode: {selectedItem.examinerMode}
                </span>
              </>
            }
            metadata={[
              { label: 'Jenis Sidang', value: selectedItem.sessionType },
              { label: 'Bidang', value: selectedItem.field },
              { label: 'Metode', value: selectedItem.method },
              { label: 'Durasi', value: `${selectedItem.sessionLength || 'Normal'} (${selectedItem.questionCount} Pertanyaan)` },
            ]}
          />

          <Toast isOpen={toastOpen} message={toastMessage} onClose={() => setToastOpen(false)} />
        </>
      </PageShell>
    );
  }

  return (
    <PageShell>
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
                  marginTop: '0.5rem',
                }}
              >
                <Trash2 size={16} /> Hapus Semua
              </button>
            )}
          </div>
        </div>
      </section>

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
              <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <SummaryCard icon={<History size={24} />} label="Total Sesi" value={`${totalSessions} Sesi`} color="var(--primary-blue)" bg="var(--blue-soft)" />
                <SummaryCard icon={<BarChart3 size={24} />} label="Rata-rata Skor" value={`${avgScore} / 100`} color="#b45309" bg="#fef3c7" />
                <SummaryCard icon={<Award size={24} />} label="Skor Terbaik" value={`${bestScore} / 100`} color="#15803d" bg="#dcfce7" />
              </div>

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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.summary || `Simulasi selesai dengan total ${item.questionCount} pertanyaan.`}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>
                            <Star fill="#f59e0b" color="#f59e0b" size={20} /> {item.score}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, backgroundColor: statusBg, padding: '0.25rem 0.625rem', borderRadius: '1rem' }}>
                            {statusLabel}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
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

      <Toast isOpen={toastOpen} message={toastMessage} onClose={() => setToastOpen(false)} />
    </PageShell>
  );
}

function SummaryCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', borderRadius: '22px', backgroundColor: 'var(--white)', border: '1px solid var(--border-color)' }}>
      <div style={{ padding: '0.75rem', backgroundColor: bg, color, borderRadius: '0.75rem', display: 'flex' }}>{icon}</div>
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</p>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{value}</h3>
      </div>
    </div>
  );
}

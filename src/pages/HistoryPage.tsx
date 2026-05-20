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

  const colors = {
    blue: [37, 99, 235] as [number, number, number],
    blueDark: [30, 64, 175] as [number, number, number],
    blueSoft: [239, 246, 255] as [number, number, number],
    green: [22, 101, 52] as [number, number, number],
    greenSoft: [240, 253, 244] as [number, number, number],
    orange: [154, 52, 18] as [number, number, number],
    orangeSoft: [255, 247, 237] as [number, number, number],
    slate: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    soft: [248, 250, 252] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  };

  let y = 18;

  const setColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const ensureSpace = (height = 20) => {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  const split = (text: string, width: number, size = 10) => {
    doc.setFontSize(size);
    return doc.splitTextToSize(text || '-', width) as string[];
  };

  const addFooter = () => {
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);

      doc.setDrawColor(...colors.border);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setColor([148, 163, 184]);
      doc.text(`RuangUji • Halaman ${i} dari ${totalPages}`, margin, pageHeight - 8);
    }
  };

  const addSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 18 : 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setColor(colors.blue);
    doc.text(title, margin, y);

    y += 6;

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(colors.muted);
      const lines = split(subtitle, contentWidth, 9);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 2;
    } else {
      y += 2;
    }
  };

  const addParagraph = (
    text: string,
    options?: {
      size?: number;
      color?: [number, number, number];
      indent?: number;
      lineHeight?: number;
      width?: number;
    }
  ) => {
    const size = options?.size ?? 9.5;
    const color = options?.color ?? colors.slate;
    const indent = options?.indent ?? 0;
    const lineHeight = options?.lineHeight ?? 5;
    const width = options?.width ?? contentWidth - indent;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    setColor(color);

    const lines = split(text || '-', width, size);

    lines.forEach((line) => {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    });
  };

  const drawRoundedCard = (
    x: number,
    yPos: number,
    width: number,
    height: number,
    fill: [number, number, number] = colors.white,
    border: [number, number, number] = colors.border
  ) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, yPos, width, height, 4, 4, 'FD');
  };

  const addInfoGrid = () => {
    const leftX = margin;
    const rightX = margin + contentWidth / 2 + 4;
    const colWidth = contentWidth / 2 - 4;
    const rowHeight = 15;

    const fields = [
      ['Judul', item.title],
      ['Tanggal', formatPdfDate(item.createdAt)],
      ['Jenis Sidang', item.sessionType || '-'],
      ['Bidang', item.field || '-'],
      ['Metode', item.method || '-'],
      ['Mode Penguji', item.examinerMode || '-'],
      ['Durasi', `${item.sessionLength || 'Normal'} (${item.questionCount} Pertanyaan)`],
    ];

    let currentX = leftX;
    let currentY = y;

    fields.forEach(([label, value], index) => {
      if (index % 2 === 0) {
        currentX = leftX;
        if (index > 0) currentY += rowHeight + 3;
      } else {
        currentX = rightX;
      }

      drawRoundedCard(currentX, currentY, colWidth, rowHeight, colors.soft, colors.border);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      setColor(colors.muted);
      doc.text(label.toUpperCase(), currentX + 4, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setColor(colors.slate);

      const valueLines = split(String(value || '-'), colWidth - 8, 8.5).slice(0, 2);
      doc.text(valueLines, currentX + 4, currentY + 10);
    });

    y = currentY + rowHeight + 8;
  };

  const addSmallCardList = (
    title: string,
    items: string[] | undefined,
    tone: 'green' | 'orange' | 'blue'
  ) => {
    const color =
      tone === 'green' ? colors.green : tone === 'orange' ? colors.orange : colors.blueDark;
    const fill =
      tone === 'green' ? colors.greenSoft : tone === 'orange' ? colors.orangeSoft : colors.blueSoft;

    const list = items?.length ? items : ['Tidak ada.'];
    const lineCount = list.reduce((acc, text) => acc + split(text, contentWidth - 14, 9).length, 0);
    const cardHeight = Math.max(22, 14 + lineCount * 5 + list.length * 2);

    ensureSpace(cardHeight + 8);

    drawRoundedCard(margin, y, contentWidth, cardHeight, fill, colors.border);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(color);
    doc.text(title, margin + 5, y + 8);

    y += 14;

    list.forEach((text, index) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(color);

      const lines = split(`${index + 1}. ${text}`, contentWidth - 14, 9);
      doc.text(lines, margin + 6, y);
      y += lines.length * 5 + 1.5;
    });

    y += 8;
  };

  const addTranscriptGroup = (group: TranscriptPdfGroup) => {
    ensureSpace(36);

    const headerHeight = 12;
    drawRoundedCard(margin, y, contentWidth, headerHeight, colors.soft, colors.border);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setColor(colors.blue);
    doc.text(`PERTANYAAN ${group.number}`, margin + 5, y + 7.7);

    if (typeof group.score === 'number') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setColor(colors.green);
      doc.text(`Skor: ${group.score}`, pageWidth - margin - 24, y + 7.7);
    }

    y += headerHeight + 5;

    const addTranscriptBlock = (
      label: string,
      text: string,
      tone: 'neutral' | 'blue' | 'green'
    ) => {
      const labelColor =
        tone === 'blue' ? colors.blueDark : tone === 'green' ? colors.green : colors.muted;
      const fill =
        tone === 'blue' ? colors.blueSoft : tone === 'green' ? colors.greenSoft : colors.white;

      const lines = split(text || '-', contentWidth - 12, 9.2);
      const height = Math.max(20, 11 + lines.length * 5);

      ensureSpace(height + 5);
      drawRoundedCard(margin, y, contentWidth, height, fill, colors.border);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setColor(labelColor);
      doc.text(label.toUpperCase(), margin + 5, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      setColor(tone === 'green' ? colors.green : tone === 'blue' ? colors.blueDark : colors.slate);
      doc.text(lines, margin + 5, y + 12);

      y += height + 4;
    };

    addTranscriptBlock('Penguji', group.question || '-', 'neutral');
    addTranscriptBlock('Anda', group.answer || '-', 'blue');
    addTranscriptBlock('Umpan Balik', group.feedback || '-', 'green');

    y += 2;
  };

  // Header
  doc.setFillColor(...colors.blue);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  setColor(colors.white);
  doc.text('Transkrip Simulasi RuangUji', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Hasil latihan tanya-jawab sidang akademik', margin, 21);

  y = 42;

  // Score summary card
  const scoreCardHeight = 26;
  drawRoundedCard(margin, y, contentWidth, scoreCardHeight, colors.white, colors.blue);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  setColor(colors.blue);
  doc.text(String(item.score ?? 0), margin + 8, y + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(colors.slate);
  doc.text('Skor Akhir', margin + 32, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  setColor(colors.muted);
  const summaryLines = split(item.summary || 'Simulasi selesai.', contentWidth - 42, 8.8).slice(0, 2);
  doc.text(summaryLines, margin + 32, y + 17);

  y += scoreCardHeight + 14;

  addSectionTitle('Informasi Simulasi');
  addInfoGrid();

  addSectionTitle('Ringkasan Evaluasi');
  addParagraph(item.summary || 'Simulasi selesai.', {
    size: 9.5,
    color: colors.slate,
    lineHeight: 5,
  });

  y += 4;

  addSmallCardList('Kekuatan', item.strengths, 'green');
  addSmallCardList('Area Perbaikan', item.weaknesses, 'orange');
  addSmallCardList('Saran Latihan Selanjutnya', item.nextPractice, 'blue');

  const groups = buildTranscriptPdfGroups(item.transcript);

  addSectionTitle(
    'Rekaman Percakapan Tanya-Jawab',
    'Berisi urutan pertanyaan penguji, jawaban Anda, dan umpan balik yang diberikan selama sesi.'
  );

  if (groups.length === 0) {
    addParagraph('Tidak ada data transkrip pada riwayat ini.', {
      size: 9.5,
      color: colors.muted,
    });
  } else {
    groups.forEach(addTranscriptGroup);
  }

  addFooter();

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

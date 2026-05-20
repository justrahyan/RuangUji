import { useMemo, useState, type ReactNode } from 'react';
import { Award, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react';
import type { TranscriptItem } from '../types';

type MetadataItem = {
    label: string;
    value?: string | number | null;
};

type TranscriptGroup = {
    id: string;
    number: number;
    question?: TranscriptItem;
    answer?: TranscriptItem;
    feedback?: TranscriptItem;
};

type EvaluationResultLayoutProps = {
    title: string;
    subtitle?: string;
    score: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    nextPractice?: string[];
    actions?: ReactNode;
    topAction?: ReactNode;
    badges?: ReactNode;
    metadata?: MetadataItem[];
    transcript?: TranscriptItem[];
    showTranscript?: boolean;
};

function safeList(list: unknown, fallback: string[]) {
    if (!Array.isArray(list)) return fallback;
    const cleaned = list.map((item) => String(item || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned : fallback;
}

function scoreStatus(score: number) {
    if (score >= 80) return 'Sangat Baik';
    if (score >= 60) return 'Cukup Baik';
    return 'Perlu Latihan';
}

function previewText(text = '', max = 240) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return '-';
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, max).trim()}...`;
}

function buildTranscriptGroups(transcript: TranscriptItem[] = []): TranscriptGroup[] {
    const groups: TranscriptGroup[] = [];

    transcript.forEach((item) => {
        if (item.type === 'question') {
            groups.push({
                id: item.id || `q-${groups.length}`,
                number: groups.length + 1,
                question: item,
            });
            return;
        }

        if (item.type === 'answer') {
            const target = [...groups].reverse().find((group) => !group.answer);
            if (target) target.answer = item;
            else {
                groups.push({
                    id: item.id || `a-${groups.length}`,
                    number: groups.length + 1,
                    answer: item,
                });
            }
            return;
        }

        if (item.type === 'feedback') {
            const target = [...groups].reverse().find((group) => !group.feedback);
            if (target) target.feedback = item;
            else {
                groups.push({
                    id: item.id || `f-${groups.length}`,
                    number: groups.length + 1,
                    feedback: item,
                });
            }
        }
    });

    return groups;
}

function DetailModal({ group, onClose }: { group: TranscriptGroup | null; onClose: () => void }) {
    if (!group) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="eval-detail-overlay"
        >
            <div onClick={(e) => e.stopPropagation()} className="eval-detail-modal">
                <div className="eval-detail-header">
                    <div>
                        <p className="eval-detail-kicker">PERTANYAAN {group.number}</p>
                        <h3 className="eval-detail-title">Detail Tanya-Jawab</h3>
                    </div>
                    <button onClick={onClose} className="eval-detail-close" aria-label="Tutup modal">
                        <X size={18} />
                    </button>
                </div>

                <div className="custom-scrollbar eval-detail-body">
                    <TranscriptBlock label="Penguji" content={group.question?.content || '-'} tone="neutral" />
                    <TranscriptBlock label="Anda" content={group.answer?.content || '-'} tone="blue" />
                    <TranscriptBlock label="Umpan Balik" content={group.feedback?.content || '-'} tone="green" score={group.feedback?.score} />
                </div>
            </div>
        </div>
    );
}

function TranscriptBlock({ label, content, tone, score }: { label: string; content: string; tone: 'neutral' | 'blue' | 'green'; score?: number }) {
    const styleMap = {
        neutral: { bg: '#f8fafc', border: '#e5e7eb', label: 'var(--text-muted)', text: 'var(--text-primary)' },
        blue: { bg: '#eff6ff', border: '#bfdbfe', label: 'var(--primary-blue)', text: '#1e3a8a' },
        green: { bg: '#f0fdf4', border: '#bbf7d0', label: '#15803d', text: '#166534' },
    }[tone];

    return (
        <div style={{ backgroundColor: styleMap.bg, border: `1px solid ${styleMap.border}`, borderRadius: '18px', padding: '1rem 1.125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: styleMap.label, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
                {typeof score === 'number' && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', backgroundColor: 'var(--white)', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '0.2rem 0.55rem' }}>Skor: {score}</span>
                )}
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: styleMap.text, whiteSpace: 'pre-wrap' }}>{content}</p>
        </div>
    );
}

function TranscriptPreview({ transcript }: { transcript?: TranscriptItem[] }) {
    const [selectedGroup, setSelectedGroup] = useState<TranscriptGroup | null>(null);
    const groups = useMemo(() => buildTranscriptGroups(transcript || []), [transcript]);

    return (
        <>
            <div className="card soft-shadow fade-up transcript-card">
                <h3 className="transcript-title">
                    <FileText size={16} color="var(--primary-blue)" /> Rekaman Percakapan Tanya-Jawab
                </h3>

                {groups.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>Tidak ada rekaman percakapan dalam riwayat ini.</p>
                ) : (
                    <div className="transcript-list">
                        {groups.map((group) => (
                            <div key={group.id} className="transcript-item">
                                <div className="transcript-item-head">
                                    <div style={{ minWidth: 0 }}>
                                        <p className="transcript-kicker" style={{ fontSize: '12px' }}>Pertanyaan {group.number}</p>
                                        <p className="transcript-question">{previewText(group.question?.content, 190)}</p>
                                    </div>
                                    {typeof group.feedback?.score === 'number' && (
                                        <span className="transcript-score">Skor {group.feedback.score}</span>
                                    )}
                                </div>

                                <button onClick={() => setSelectedGroup(group)} className="transcript-detail-btn" style={{ fontSize: '12px' }}>
                                    Lihat detail lengkap
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DetailModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />
        </>
    );
}

export default function EvaluationResultLayout({
    title,
    subtitle,
    score,
    summary,
    strengths,
    weaknesses,
    nextPractice,
    actions,
    topAction,
    badges,
    metadata,
    transcript,
    showTranscript = false,
}: EvaluationResultLayoutProps) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const safeStrengths = safeList(strengths, ['Penyelesaian sesi tepat waktu']);
    const safeWeaknesses = safeList(weaknesses, ['Perlu memperjelas jawaban pada beberapa bagian']);
    const safeNextPractice = safeList(nextPractice, ['Coba mode penguji lain']);
    const visibleMetadata = (metadata || []).filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

    return (
        <div className="section-soft eval-page-shell">
            <div className="container eval-container">
                <div className="eval-topbar fade-up">
                    <div>{topAction}</div>
                    {badges && <div className="eval-badges">{badges}</div>}
                </div>

                <div className="fade-up eval-heading">
                    <h1 className="section-title eval-title">{title}</h1>
                    {subtitle && <p className="section-desc eval-subtitle">{subtitle}</p>}
                </div>

                <div className="eval-result-grid">
                    <div className="eval-left-col">
                        <div className="card fade-up delay-1 soft-shadow eval-score-card">
                            <div className="eval-score-circle">
                                <span>{safeScore}</span>
                            </div>
                            <h2>{scoreStatus(safeScore)}</h2>
                            <p>{summary || 'Simulasi selesai.'}</p>
                            {actions && <div className="eval-actions">{actions}</div>}
                        </div>

                        {visibleMetadata.length > 0 && (
                            <div className="card fade-up delay-2 soft-shadow eval-info-card">
                                <h3>Info Simulasi</h3>
                                <div className="eval-info-list">
                                    {visibleMetadata.map((item) => (
                                        <div key={item.label}>
                                            <span>{item.label}: </span>
                                            <strong>{item.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="eval-main-col">
                        <div className="eval-mini-cards">
                            <div className="card fade-up delay-3 eval-mini-card eval-mini-card-green">
                                <h4><CheckCircle2 size={14} /> Kekuatan</h4>
                                <ul>
                                    {safeStrengths.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </div>

                            <div className="card fade-up delay-4 eval-mini-card eval-mini-card-orange">
                                <h4><AlertCircle size={14} /> Area Perbaikan</h4>
                                <ul>
                                    {safeWeaknesses.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="card fade-up delay-2 soft-shadow eval-practice-card">
                            <h3><Award size={16} color="var(--primary-blue)" /> Saran Latihan Selanjutnya</h3>
                            <div className="eval-practice-list">
                                {safeNextPractice.map((item, index) => (
                                    <div key={index}>
                                        <div />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {showTranscript && <TranscriptPreview transcript={transcript} />}
                    </div>
                </div>
            </div>

            <style>{`
        .eval-page-shell {
          min-height: calc(100vh - 73px);
          padding: 2rem 1rem 4rem;
          background-color: #f8fafc;
        }

        .eval-container {
          max-width: 1120px !important;
        }

        .eval-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .eval-badges {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .eval-heading {
          text-align: left;
          margin-bottom: 1.5rem;
        }

        .eval-title {
          margin-bottom: 0.25rem;
          font-size: clamp(1.65rem, 3vw, 2.35rem);
        }

        .eval-subtitle {
          margin: 0;
          max-width: 760px;
          font-size: 0.95rem;
        }

        .eval-result-grid {
          display: grid;
          grid-template-columns: minmax(260px, 0.9fr) minmax(0, 2fr);
          gap: 1.25rem;
          align-items: start;
        }

        .eval-left-col,
        .eval-main-col {
          display: grid;
          gap: 1.25rem;
          align-content: start;
        }

        .eval-score-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.75rem 1.4rem;
          text-align: center;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          background-color: var(--white);
        }

        .eval-score-circle {
          width: 92px;
          height: 92px;
          border-radius: 50%;
          border: 7px solid var(--primary-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.9rem;
          background-color: var(--blue-soft);
        }

        .eval-score-circle span {
          font-size: 2.45rem;
          font-weight: 800;
          color: var(--primary-blue);
          line-height: 1;
        }

        .eval-score-card h2 {
          font-size: 1.25rem;
          font-weight: 800;
          margin-bottom: 0.45rem;
        }

        .eval-score-card p {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin: 0;
          line-height: 1.55;
        }

        .eval-actions {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          flex-direction: column;
          margin-top: 1.25rem;
        }

        .eval-info-card {
          padding: 1.25rem;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          background-color: var(--white);
        }

        .eval-info-card h3 {
          font-size: 1rem;
          font-weight: 800;
          margin-bottom: 0.85rem;
          color: var(--text-primary);
        }

        .eval-info-list {
          display: grid;
          gap: 0.65rem;
        }

        .eval-info-list div {
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .eval-info-list span {
          color: var(--text-secondary);
        }

        .eval-info-list strong {
          color: var(--text-primary);
        }

        .eval-mini-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
        }

        .eval-mini-card {
          padding: 1.15rem;
          border-radius: 24px;
          border-left: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
          background-color: var(--white);
        }

        .eval-mini-card-green {
          border-top: 4px solid #16a34a;
        }

        .eval-mini-card-orange {
          border-top: 4px solid #ea580c;
        }

        .eval-mini-card h4 {
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.6rem;
          font-size: 0.95rem;
        }

        .eval-mini-card-green h4 {
          color: #16a34a;
        }

        .eval-mini-card-orange h4 {
          color: #ea580c;
        }

        .eval-mini-card ul {
          padding-left: 1.1rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          margin: 0;
          line-height: 1.6;
        }

        .eval-practice-card,
        .transcript-card {
          padding: 1.25rem;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          background-color: var(--white);
        }

        .eval-practice-card h3,
        .transcript-title {
          font-size: 1rem;
          font-weight: 800;
          margin-bottom: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-primary);
        }

        .eval-practice-list {
          display: grid;
          gap: 0.55rem;
        }

        .eval-practice-list > div {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background-color: var(--bg-soft);
          padding: 0.65rem 0.85rem;
          border-radius: 10px;
        }

        .eval-practice-list > div > div {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--primary-blue);
          flex-shrink: 0;
        }

        .eval-practice-list span {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.5;
        }

        .transcript-list {
          display: grid;
          gap: 1rem;
        }

        .transcript-item {
          border: 1px solid var(--border-color);
          border-radius: 20px;
          background-color: #ffffff;
          overflow: hidden;
        }

        .transcript-item-head {
          padding: 1rem 1.1rem;
          background-color: #f8fafc;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.85rem;
        }

        .transcript-kicker {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--primary-blue);
          margin-bottom: 0.25rem;
        }

        .transcript-question {
          margin: 0;
          font-size: 0.9rem;
          color: var(--text-primary);
          line-height: 1.5;
        }

        .transcript-score {
          flex-shrink: 0;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--primary-blue);
          background-color: var(--blue-soft);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
        }

        .transcript-mini-grid {
          padding: 1rem 1.1rem 0;
          display: grid;
          gap: 0.75rem;
        }

        .transcript-mini {
          border-radius: 16px;
          padding: 0.85rem 0.95rem;
        }

        .transcript-mini span {
          font-size: 0.68rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .transcript-mini p {
          margin: 0.28rem 0 0;
          font-size: 0.86rem;
          line-height: 1.55;
        }

        .transcript-mini-blue {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .transcript-mini-blue span,
        .transcript-mini-blue p {
          color: #1e3a8a;
        }

        .transcript-mini-green {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .transcript-mini-green span,
        .transcript-mini-green p {
          color: #166534;
        }

        .transcript-detail-btn {
          margin: 0.75rem 1.1rem 1rem;
          border: none;
          background: transparent;
          color: var(--primary-blue);
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          padding: 0;
        }

        .eval-detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background-color: rgba(15, 23, 42, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          backdrop-filter: blur(6px);
        }

        .eval-detail-modal {
          width: min(820px, calc(100vw - 2rem));
          max-height: min(86vh, 820px);
          background-color: var(--white);
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          box-shadow: 0 28px 90px rgba(15, 23, 42, 0.28);
          display: flex;
          flex-direction: column;
        }

        .eval-detail-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--white);
        }

        .eval-detail-kicker {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--primary-blue);
          margin-bottom: 0.25rem;
        }

        .eval-detail-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .eval-detail-close {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background-color: var(--white);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .eval-detail-body {
          overflow-y: auto;
          padding: 1.5rem;
          display: grid;
          gap: 1rem;
        }

        @media (max-width: 900px) {
          .eval-result-grid {
            grid-template-columns: 1fr;
          }

          .eval-mini-cards {
            grid-template-columns: 1fr;
          }

          .eval-topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .eval-badges {
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .eval-page-shell {
            padding: 1rem 0.75rem 2.5rem;
          }

          .eval-score-card,
          .eval-info-card,
          .eval-practice-card,
          .transcript-card,
          .eval-mini-card {
            border-radius: 18px;
          }

          .eval-detail-modal {
            width: calc(100vw - 1rem);
            max-height: 88vh;
            border-radius: 20px;
          }

          .eval-detail-header,
          .eval-detail-body {
            padding: 1rem;
          }
        }
      `}</style>
        </div>
    );
}
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

function scoreTone(score: number) {
  if (score >= 80) return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
  if (score >= 60) return { bg: '#eff6ff', color: 'var(--primary-blue)', border: '#bfdbfe' };
  return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
}

function previewText(text = '', max = 180) {
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

function CompactListCard({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  tone: 'green' | 'orange' | 'blue';
}) {
  return (
    <div className={`eval-card eval-list-card eval-list-${tone}`}>
      <div className="eval-list-head">
        <h4>
          {icon}
          {title}
        </h4>

        <span className="eval-list-count">
          {items.length} poin
        </span>
      </div>

      <div className="eval-list-body">
        <div className="custom-scrollbar eval-list-scroll">
          <ul>
            {items.map((item, index) => (
              <li key={`${title}-${index}`}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ group, onClose }: { group: TranscriptGroup | null; onClose: () => void }) {
  if (!group) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="eval-detail-overlay">
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
          <TranscriptBlock
            label="Umpan Balik"
            content={group.feedback?.content || '-'}
            tone="green"
            score={group.feedback?.score}
          />
        </div>
      </div>
    </div>
  );
}

function TranscriptBlock({
  label,
  content,
  tone,
  score,
}: {
  label: string;
  content: string;
  tone: 'neutral' | 'blue' | 'green';
  score?: number;
}) {
  const styleMap = {
    neutral: { bg: '#f8fafc', border: '#e5e7eb', label: 'var(--text-muted)', text: 'var(--text-primary)' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', label: 'var(--primary-blue)', text: '#1e3a8a' },
    green: { bg: '#f0fdf4', border: '#bbf7d0', label: '#15803d', text: '#166534' },
  }[tone];

  return (
    <div
      style={{
        backgroundColor: styleMap.bg,
        border: `1px solid ${styleMap.border}`,
        borderRadius: '18px',
        padding: '1rem 1.125rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '0.625rem',
        }}
      >
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: styleMap.label,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </span>
        {typeof score === 'number' && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              color: '#15803d',
              backgroundColor: 'var(--white)',
              border: '1px solid #bbf7d0',
              borderRadius: '999px',
              padding: '0.2rem 0.55rem',
            }}
          >
            Skor: {score}
          </span>
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.65,
          color: styleMap.text,
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </p>
    </div>
  );
}

function TranscriptPreview({ transcript }: { transcript?: TranscriptItem[] }) {
  const [selectedGroup, setSelectedGroup] = useState<TranscriptGroup | null>(null);
  const groups = useMemo(() => buildTranscriptGroups(transcript || []), [transcript]);

  return (
    <>
      <div className="eval-card transcript-card">
        <div className="transcript-title-row">
          <div>
            <h3 className="transcript-title">
              <FileText size={16} color="var(--primary-blue)" /> Rekaman Percakapan Tanya-Jawab
            </h3>
            <p>Ringkasan tiap pertanyaan. Buka detail untuk melihat jawaban dan umpan balik lengkap.</p>
          </div>
          <span>{groups.length} pertanyaan</span>
        </div>

        {groups.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Tidak ada rekaman percakapan dalam riwayat ini.
          </p>
        ) : (
          <div className="transcript-list">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className="transcript-item"
              >
                <div className="transcript-item-head">
                  <div style={{ minWidth: 0 }}>
                    <p className="transcript-kicker">Pertanyaan {group.number}</p>
                    <p className="transcript-question">{previewText(group.question?.content, 155)}</p>
                  </div>

                  {typeof group.feedback?.score === 'number' && (
                    <span className="transcript-score">Skor {group.feedback.score}</span>
                  )}
                </div>

                <div className="transcript-item-footer">
                  <span>{previewText(group.answer?.content || 'Belum ada jawaban.', 90)}</span>
                  <strong>Lihat detail</strong>
                </div>
              </button>
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
  const tone = scoreTone(safeScore);
  const safeStrengths = safeList(strengths, ['Penyelesaian sesi tepat waktu']);
  const safeWeaknesses = safeList(weaknesses, ['Perlu memperjelas jawaban pada beberapa bagian']);
  const safeNextPractice = safeList(nextPractice, ['Coba mode penguji lain']);
  const visibleMetadata = (metadata || []).filter(
    (item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== ''
  );

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

        <div className="eval-result-layout">
          <aside className="eval-left-panel">
            <div className="eval-card eval-score-card">
              <div
                className="eval-score-ring"
                style={{
                  backgroundColor: tone.bg,
                  borderColor: tone.border,
                  color: tone.color,
                }}
              >
                <span>{safeScore}</span>
              </div>

              <div>
                <h2>{scoreStatus(safeScore)}</h2>
                <p>{previewText(summary || 'Simulasi selesai.', 360)}</p>
              </div>

              {actions && <div className="eval-actions">{actions}</div>}
            </div>

            {visibleMetadata.length > 0 && (
              <div className="eval-card eval-info-card">
                <h3>Info Simulasi</h3>
                <div className="eval-info-list">
                  {visibleMetadata.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="eval-main-panel">
            <div className="eval-card eval-summary-card">
              <div>
                <span className="eval-section-kicker">Ringkasan Evaluasi</span>
                <h3>Gambaran performa sesi</h3>
              </div>
              <p>{summary || 'Simulasi selesai.'}</p>
            </div>

            <div className="eval-list-grid">
              <CompactListCard
                title="Kekuatan"
                icon={<CheckCircle2 size={15} />}
                items={safeStrengths}
                tone="green"
              />

              <CompactListCard
                title="Area Perbaikan"
                icon={<AlertCircle size={15} />}
                items={safeWeaknesses}
                tone="orange"
              />

              <CompactListCard
                title="Saran Latihan"
                icon={<Award size={15} />}
                items={safeNextPractice}
                tone="blue"
              />
            </div>

            {showTranscript && <TranscriptPreview transcript={transcript} />}
          </main>
        </div>
      </div>

      <style>{`
        .eval-page-shell {
          min-height: calc(100vh - 73px);
          padding: 2rem 1rem 4rem;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.06), transparent 28rem),
            #f8fafc;
        }

        .eval-container {
          width: min(100%, 1240px) !important;
          max-width: 1240px !important;
          margin: 0 auto;
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
          margin-bottom: 1.25rem;
        }

        .eval-title {
          margin-bottom: 0.25rem;
          font-size: clamp(1.65rem, 3vw, 2.35rem);
        }

        .eval-subtitle {
          margin: 0;
          max-width: 820px;
          font-size: 0.95rem;
        }

        .eval-result-layout {
          display: grid;
          grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
          gap: 1.25rem;
          align-items: start;
        }

        .eval-left-panel {
          display: grid;
          gap: 1rem;
          position: sticky;
          top: 92px;
          align-self: start;
        }

        .eval-main-panel {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .eval-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid var(--border-color);
          border-radius: 22px;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.045);
        }

        .eval-score-card {
          padding: 1.25rem;
          display: grid;
          gap: 1rem;
        }

        .eval-score-ring {
          width: 86px;
          height: 86px;
          border-radius: 50%;
          border: 6px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .eval-score-ring span {
          font-size: 2.25rem;
          font-weight: 900;
          line-height: 1;
        }

        .eval-score-card h2 {
          font-size: 1.15rem;
          font-weight: 900;
          margin: 0 0 0.4rem;
          color: var(--text-primary);
        }

        .eval-score-card p {
          color: var(--text-secondary);
          font-size: 0.86rem;
          margin: 0;
          line-height: 1.55;
        }

        .eval-actions {
          display: grid;
          gap: 0.5rem;
          width: 100%;
        }

        .eval-info-card {
          padding: 1.1rem;
        }

        .eval-info-card h3 {
          font-size: 0.92rem;
          font-weight: 900;
          margin-bottom: 0.85rem;
          color: var(--text-primary);
        }

        .eval-info-list {
          display: grid;
          gap: 0.55rem;
        }

        .eval-info-list div {
          display: grid;
          gap: 0.15rem;
          padding-bottom: 0.55rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .eval-info-list div:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .eval-info-list span {
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .eval-info-list strong {
          color: var(--text-primary);
          font-size: 0.86rem;
          line-height: 1.45;
        }

        .eval-summary-card {
          padding: 1.25rem 1.35rem;
        }

        .eval-section-kicker {
          color: var(--primary-blue);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .eval-summary-card h3 {
          margin: 0.2rem 0 0.65rem;
          color: var(--text-primary);
          font-size: 1.05rem;
          font-weight: 900;
        }

        .eval-summary-card p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.7;
          font-size: 0.92rem;
        }

        .eval-list-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          align-items: stretch;
        }

        .eval-list-card {
          padding: 1rem;
          max-height: 365px;
          min-height: 0;
          height: auto;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .eval-list-green {
          border-top: 4px solid #16a34a;
        }

        .eval-list-orange {
          border-top: 4px solid #ea580c;
        }

        .eval-list-blue {
          border-top: 4px solid var(--primary-blue);
        }

        .eval-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-shrink: 0;
        }

        .eval-list-head h4 {
          font-size: 0.9rem;
          font-weight: 900;
          color: var(--text-primary);
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          margin: 0;
        }

        .eval-list-green h4 {
          color: #15803d;
        }

        .eval-list-orange h4 {
          color: #c2410c;
        }

        .eval-list-blue h4 {
          color: var(--primary-blue);
        }

        .eval-list-count {
          border: 0;
          background: #f8fafc;
          color: var(--text-secondary);
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.35rem 0.6rem;
          white-space: nowrap;
        }

        .eval-list-body {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .eval-list-scroll {
          max-height: 292px;
          overflow-y: auto;
          padding-right: 0.35rem;
          padding-bottom: 0.25rem;
        }

        .eval-list-scroll ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 0.7rem;
        }

        .eval-list-scroll li {
          display: flex;
          gap: 0.55rem;
          align-items: flex-start;
          color: var(--text-secondary);
          font-size: 0.86rem;
          line-height: 1.58;
        }

        .eval-list-scroll li span {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #f8fafc;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 0.05rem;
        }

        .eval-list-scroll li p {
          margin: 0;
        }

        .transcript-card {
          padding: 1.15rem;
        }

        .transcript-title-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 0.9rem;
        }

        .transcript-title {
          font-size: 1rem;
          font-weight: 900;
          margin: 0 0 0.2rem;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: var(--text-primary);
        }

        .transcript-title-row p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .transcript-title-row > span {
          flex-shrink: 0;
          background: var(--blue-soft);
          color: var(--primary-blue);
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 900;
          padding: 0.35rem 0.65rem;
        }

        .transcript-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .transcript-item {
          border: 1px solid var(--border-color);
          border-radius: 18px;
          background-color: #ffffff;
          overflow: hidden;
          text-align: left;
          cursor: pointer;
          padding: 0;
          transition: all 0.18s ease;
        }

        .transcript-item:hover {
          transform: translateY(-2px);
          border-color: #bfdbfe;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.08);
        }

        .transcript-item-head {
          padding: 0.9rem 1rem;
          background-color: #f8fafc;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .transcript-kicker {
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--primary-blue);
          margin: 0 0 0.25rem;
        }

        .transcript-question {
          margin: 0;
          font-size: 0.84rem;
          color: var(--text-primary);
          line-height: 1.45;
        }

        .transcript-score {
          flex-shrink: 0;
          font-size: 0.7rem;
          font-weight: 900;
          color: var(--primary-blue);
          background-color: var(--blue-soft);
          border-radius: 999px;
          padding: 0.3rem 0.55rem;
        }

        .transcript-item-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
        }

        .transcript-item-footer span {
          min-width: 0;
          color: var(--text-secondary);
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .transcript-item-footer strong {
          color: var(--primary-blue);
          font-size: 0.75rem;
          font-weight: 900;
          flex-shrink: 0;
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
          width: min(860px, calc(100vw - 2rem));
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
          font-weight: 900;
          color: var(--primary-blue);
          margin: 0 0 0.25rem;
        }

        .eval-detail-title {
          font-size: 1.125rem;
          font-weight: 900;
          color: var(--text-primary);
          margin: 0;
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

        @media (max-width: 1100px) {
          .eval-list-grid {
            grid-template-columns: 1fr;
          }

          .transcript-list {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .eval-result-layout {
            grid-template-columns: 1fr;
          }

          .eval-left-panel {
            position: static;
          }

          .eval-score-card {
            grid-template-columns: auto 1fr;
            align-items: center;
          }

          .eval-actions {
            grid-column: 1 / -1;
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

          .eval-card {
            border-radius: 18px;
          }

          .eval-score-card {
            grid-template-columns: 1fr;
          }

          .eval-score-ring {
            width: 76px;
            height: 76px;
          }

          .eval-score-ring span {
            font-size: 2rem;
          }

          .transcript-title-row {
            flex-direction: column;
          }

          .eval-detail-modal {
            width: calc(100vw - 1rem);
            max-height: 88vh;
            border-radius: 20px;
          }

          .eval-list-card {
            max-height: 320px;
            height: auto;
            min-height: 0;
          }

          .eval-list-scroll {
            max-height: 250px;
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
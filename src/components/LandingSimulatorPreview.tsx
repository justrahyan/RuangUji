import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Bot,
    FileText,
    MessageSquare,
    Send,
    Sparkles,
    Volume2,
    CheckCircle2,
    ChevronRight,
} from 'lucide-react';
import SectionHeader from './SectionHeader';
import RuangUjiBot from './RuangUjiBot';

type DemoPhase = 'question' | 'typing' | 'thinking' | 'feedback' | 'next';

const demoQuestion =
    'Apa alasan utama Anda memilih topik penelitian ini, dan bagaimana topik tersebut relevan dengan kebutuhan akademik atau masyarakat saat ini?';

const demoAnswer =
    'Saya memilih topik ini karena masalah yang dibahas dekat dengan kondisi nyata. Penelitian ini diharapkan membantu menjelaskan faktor utama yang memengaruhi fenomena tersebut dan memberi dasar untuk pengambilan keputusan yang lebih baik.';

const demoFeedback =
    'Jawaban sudah relevan dan menjawab inti pertanyaan. Akan lebih kuat jika ditambahkan data awal, contoh kasus, atau gap penelitian sebelumnya.';

function getBotState(phase: DemoPhase) {
    if (phase === 'typing') return 'listening';
    if (phase === 'thinking') return 'thinking';
    if (phase === 'question' || phase === 'feedback') return 'speaking';
    return 'idle';
}

export default function LandingSimulatorPreview() {
    const [phase, setPhase] = useState<DemoPhase>('question');
    const [typedAnswer, setTypedAnswer] = useState('');

    const botState = useMemo(() => getBotState(phase), [phase]);
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let timer: number | undefined;

        if (phase === 'question') {
            timer = window.setTimeout(() => {
                setTypedAnswer('');
                setPhase('typing');
            }, 1500);
        }

        if (phase === 'typing') {
            if (typedAnswer.length < demoAnswer.length) {
                timer = window.setTimeout(() => {
                    setTypedAnswer(demoAnswer.slice(0, typedAnswer.length + 2));
                }, 18);
            } else {
                timer = window.setTimeout(() => setPhase('thinking'), 750);
            }
        }

        if (phase === 'thinking') {
            timer = window.setTimeout(() => setPhase('feedback'), 1200);
        }

        if (phase === 'feedback') {
            timer = window.setTimeout(() => setPhase('next'), 2200);
        }

        if (phase === 'next') {
            timer = window.setTimeout(() => {
                setTypedAnswer('');
                setPhase('question');
            }, 1900);
        }

        return () => {
            if (timer) window.clearTimeout(timer);
        };
    }, [phase, typedAnswer]);

    useEffect(() => {
        const el = chatScrollRef.current;
        if (!el) return;

        el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth',
        });
    }, [phase, typedAnswer]);

    return (
        <section className="section lp-simulator-section">
            <div className="container lp-simulator-container">
                <SectionHeader
                    label="Preview Simulator"
                    title="Rasakan alur latihan sebelum masuk ruang sidang."
                    subtitle="Preview ini menampilkan gambaran cara RuangUji memberi pertanyaan, membaca jawaban, lalu memberikan feedback secara otomatis."
                    centered
                />

                <div className="lp-simulator-shell fade-up">
                    <div className="lp-simulator-grid no-topbar">
                        <aside className="lp-simulator-info">
                            <div className="lp-simulator-panel-title">
                                <span>Informasi Latihan</span>
                                <h4>Detail Penelitian</h4>
                            </div>

                            <div className="lp-info-list">
                                <div className="lp-info-item">
                                    <span>Judul Penelitian</span>
                                    <div className="lp-skeleton wide" />
                                    <div className="lp-skeleton medium" />
                                </div>

                                <div className="lp-info-item">
                                    <span>Jenis Sidang</span>
                                    <strong>Presentasi Tugas Akhir</strong>
                                </div>

                                <div className="lp-info-item">
                                    <span>Bidang / Topik</span>
                                    <strong>Pendidikan dan Sosial</strong>
                                </div>

                                <div className="lp-info-item">
                                    <span>Pendekatan</span>
                                    <strong>Mixed Methods</strong>
                                </div>

                                <div className="lp-info-item">
                                    <span>Metode Utama</span>
                                    <div className="lp-skeleton short" />
                                </div>
                            </div>
                        </aside>

                        <main className="lp-simulator-main">
                            <div className="lp-main-header">
                                <div>
                                    <span>Panel Penguji</span>
                                    <strong>Pertanyaan 1 dari 5</strong>
                                </div>

                                <div className="lp-main-actions">
                                    <span className="lp-audio-pill">
                                        <Volume2 size={14} />
                                        Suara AI Aktif
                                    </span>

                                    <span className="lp-speaking-pill">
                                        <i className={phase !== 'next' ? 'active' : ''} />
                                        {phase === 'thinking'
                                            ? 'Menilai'
                                            : phase === 'typing'
                                                ? 'Mendengar'
                                                : 'Siap menguji'}
                                    </span>
                                </div>
                            </div>

                            <div className="lp-chat-area" ref={chatScrollRef}>
                                <div className="lp-chat-warning">
                                    <Sparkles size={14} />
                                    <span>RuangUji bisa keliru. Gunakan sebagai bahan latihan.</span>
                                </div>

                                <div className="lp-chat-row left">
                                    <div className="lp-chat-bubble question">
                                        <div className="lp-chat-label">
                                            <Bot size={14} />
                                            <span>Penguji</span>
                                        </div>
                                        <p>{demoQuestion}</p>
                                    </div>
                                </div>

                                {(phase === 'typing' || phase === 'thinking' || phase === 'feedback' || phase === 'next') && (
                                    <div className="lp-chat-row right">
                                        <div className="lp-chat-bubble answer">
                                            <div className="lp-chat-label answer-label">Anda</div>
                                            <p>
                                                {typedAnswer}
                                                {phase === 'typing' && <span className="lp-cursor">|</span>}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {phase === 'thinking' && (
                                    <div className="lp-chat-row left">
                                        <div className="lp-chat-bubble thinking">
                                            <div className="lp-thinking-dots">
                                                <span />
                                                <span />
                                                <span />
                                            </div>
                                            <p>RuangUji sedang menilai jawaban...</p>
                                        </div>
                                    </div>
                                )}

                                {(phase === 'feedback' || phase === 'next') && (
                                    <div className="lp-chat-row left">
                                        <div className="lp-chat-bubble feedback">
                                            <div className="lp-chat-label feedback-label">
                                                <span>
                                                    <MessageSquare size={14} />
                                                    Umpan Balik
                                                </span>
                                                <strong>Skor: 82</strong>
                                            </div>
                                            <p>{demoFeedback}</p>

                                            <button type="button" className="lp-detail-link">
                                                Lihat lengkap
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {phase === 'next' && (
                                    <div className="lp-next-card">
                                        <CheckCircle2 size={16} />
                                        <div>
                                            <strong>Evaluasi singkat selesai</strong>
                                            <p>Jawaban relevan, tetapi masih perlu dukungan data dan contoh spesifik.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="lp-input-area">
                                <div className="lp-input-shell">
                                    <span>
                                        {phase === 'typing'
                                            ? typedAnswer || 'Mengetik jawaban...'
                                            : phase === 'question'
                                                ? 'Jawaban akan diketik otomatis...'
                                                : 'Jawaban terkirim'}
                                    </span>

                                    <button type="button" aria-label="Kirim jawaban preview">
                                        <Send size={16} />
                                    </button>
                                </div>

                                <p>RuangUji bisa keliru. Gunakan sebagai bahan latihan.</p>
                            </div>
                        </main>

                        <aside className="lp-simulator-side">
                            <div className={`lp-bot-card ${phase !== 'next' ? 'active' : ''}`}>
                                <div className="lp-bot-orbit big" />
                                <div className="lp-bot-orbit small" />

                                <RuangUjiBot state={botState} size={112} />

                                <div className="lp-bot-dots">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </div>

                            <div className="lp-bot-caption">
                                <strong>
                                    {phase === 'typing'
                                        ? 'Mendengarkan'
                                        : phase === 'thinking'
                                            ? 'Menilai jawaban'
                                            : phase === 'feedback'
                                                ? 'Memberi feedback'
                                                : 'Siap menguji'}
                                </strong>
                                <span>Preview mode chat aktif.</span>
                            </div>

                            <div className="lp-transcript-preview">
                                <div className="lp-transcript-head">
                                    <div>
                                        <span>Transkrip Sesi</span>
                                        <p>Riwayat percakapan</p>
                                    </div>
                                    <FileText size={15} />
                                </div>

                                <div className="lp-transcript-list">
                                    <div className="lp-transcript-item neutral">
                                        <span>Penguji</span>
                                        <p>{demoQuestion}</p>
                                    </div>

                                    {(phase === 'typing' || phase === 'thinking' || phase === 'feedback' || phase === 'next') && (
                                        <div className="lp-transcript-item blue">
                                            <span>Anda</span>
                                            <p>{typedAnswer || 'Jawaban sedang diketik...'}</p>
                                        </div>
                                    )}

                                    {(phase === 'feedback' || phase === 'next') && (
                                        <div className="lp-transcript-item green">
                                            <span>Umpan Balik</span>
                                            <p>{demoFeedback}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Link to="/setup" className="lp-preview-cta">
                                Coba Simulasi Penuh <ChevronRight size={16} />
                            </Link>
                        </aside>
                    </div>
                </div>
            </div>
        </section>
    );
}
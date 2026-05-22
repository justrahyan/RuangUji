import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Bot,
  Send,
  Speech,
  PanelLeftClose,
  PanelRightClose,
  Info,
  FileText,
  Loader2,
  AudioLines,
} from 'lucide-react';
import type { DefenseSession, TranscriptItem } from '../types';
import {
  getActiveSession,
  clearActiveSession,
  saveActiveSession,
  saveHistoryItem,
  getInMemoryDocumentText,
} from '../lib/storage';
import { evaluateAnswer, generateFinalEvaluation } from '../lib/localEngine';
import { speakText, stopSpeaking, handleMuteToggle } from '../lib/speech';

import VoiceAnswer from '../components/VoiceAnswer';
import ConfirmModal from '../components/ConfirmModal';
import SessionTranscript from '../components/SessionTranscript';
import TextDetailModal from '../components/TextDetailModal';
import RuangUjiBot from '../components/RuangUjiBot';
import logoRuangUji from '../assets/logo-ruanguji.png';

function normalizeFeedback(evaluation: any) {
  let score = Number(evaluation.score);
  if (isNaN(score)) score = 0;
  score = Math.max(0, Math.min(100, score));

  let strengths: string[] = [];
  if (Array.isArray(evaluation.strengths)) {
    strengths = evaluation.strengths.map((s: any) => String(s).trim()).filter(Boolean);
  } else if (typeof evaluation.strengths === 'string') {
    strengths = evaluation.strengths
      .split('\n')
      .map((s: string) => s.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter(Boolean);
  }
  if (strengths.length === 0) strengths = ['Belum terdeteksi secara jelas.'];

  let weaknesses: string[] = [];
  if (Array.isArray(evaluation.weaknesses)) {
    weaknesses = evaluation.weaknesses.map((w: any) => String(w).trim()).filter(Boolean);
  } else if (typeof evaluation.weaknesses === 'string') {
    weaknesses = evaluation.weaknesses
      .split('\n')
      .map((w: string) => w.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter(Boolean);
  }
  if (weaknesses.length === 0) weaknesses = ['Tidak ada.'];

  let suggestion = evaluation.suggestion || evaluation.saran;
  if (!suggestion || typeof suggestion !== 'string' || !suggestion.trim()) {
    suggestion = 'Pertahankan struktur jawaban dan sesuaikan dengan inti pertanyaan.';
  } else {
    suggestion = suggestion.trim().replace(/\s+/g, ' ');
  }

  const speechText =
    typeof evaluation.speechText === 'string' && evaluation.speechText.trim()
      ? evaluation.speechText.trim()
      : '';

  const normalizedAnswer =
    typeof evaluation.normalizedAnswer === 'string' && evaluation.normalizedAnswer.trim()
      ? evaluation.normalizedAnswer.trim()
      : '';

  return {
    score,
    strengths,
    weaknesses,
    suggestion,
    speechText,
    normalizedAnswer,
    answerCategory: evaluation.answerCategory || '',
  };
}

export default function DefenseRoomPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<DefenseSession | null>(null);

  const [isVoiceMode, setIsVoiceMode] = useState(false);

  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  const [orbState, setOrbState] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [, setSpokenText] = useState('');
  const [, setSpokenMode] = useState<'question' | 'feedback' | 'listening'>('question');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('ruanguji_voice_muted') !== 'true');
  const [voiceProfile, setVoiceProfile] = useState(localStorage.getItem('ruanguji_voice_profile') || 'Formal');
  const [hasFeedback, setHasFeedback] = useState(false);

  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const [chatInput, setChatInput] = useState('');

  const [showBackModal, setShowBackModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalContent] = useState({ title: '', content: '' });

  const middleScrollRef = useRef<HTMLDivElement>(null);

  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    text: string;
    category: string;
    source: 'ai' | 'local-fallback';
    locked: boolean;
  } | null>(null);

  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState(false);
  const [quotaMode, setQuotaMode] = useState(false);
  const [, setQuotaModeReason] = useState('');
  const [, setAiStatus] = useState<'idle' | 'generating-question' | 'evaluating' | 'fallback' | 'error'>('idle');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const questionRequestIdRef = useRef(0);
  const hasUserAnsweredRef = useRef(false);

  const toggleItemExpand = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    const active = getActiveSession();

    if (active) {
      setSession(active);
      setQuotaMode(Boolean(active.quotaMode));
      setQuotaModeReason(active.quotaModeReason || '');

      if (active.transcript.length === 0) {
        handleGenerateQuestion(active);
      } else {
        const lastItem = active.transcript[active.transcript.length - 1];
        setSpokenText(lastItem.content);
        setSpokenMode(lastItem.type === 'feedback' ? 'feedback' : 'question');
        setHasFeedback(lastItem.type === 'feedback');

        const lastQItem = active.transcript.slice().reverse().find((t) => t.type === 'question');

        if (lastQItem) {
          setCurrentQuestion({
            id: lastQItem.id,
            text: lastQItem.content,
            category: lastQItem.questionId || 'umum',
            source: lastQItem.questionText ? 'ai' : 'local-fallback',
            locked: true,
          });

          hasUserAnsweredRef.current = lastItem.type !== 'question';
        }
      }
    }
  }, []);

  useEffect(() => {
    if (middleScrollRef.current && !isVoiceMode) {
      middleScrollRef.current.scrollTop = middleScrollRef.current.scrollHeight;
    }
  }, [session?.transcript, isVoiceMode, isGeneratingQuestion, isEvaluatingAnswer]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!isVoiceMode) {
      setIsVoiceListening(false);
    }
  }, [isVoiceMode]);

  const toggleVoice = () => {
    const newVal = !voiceEnabled;

    setVoiceEnabled(newVal);
    localStorage.setItem('ruanguji_voice_muted', newVal ? 'false' : 'true');

    handleMuteToggle();
  };

  const buildResearchPayload = (research: DefenseSession['research']) => {
    const memText =
      getInMemoryDocumentText(research.id) ||
      getInMemoryDocumentText(research.docId || '') ||
      research.documentText;

    return {
      ...research,
      documentText: research.docId ? undefined : memText,
    };
  };

  const addTranscript = (item: TranscriptItem, currentSession: DefenseSession) => {
    const updated = {
      ...currentSession,
      transcript: [...currentSession.transcript, item],
    };

    setSession(updated);
    saveActiveSession(updated);
    return updated;
  };

  const handleGenerateQuestion = async (currentSession: DefenseSession) => {
    setIsGeneratingQuestion(true);
    setAiStatus('generating-question');
    setOrbState('thinking');
    setSpokenMode('question');
    setSpokenText('Menyiapkan pertanyaan...');
    setHasFeedback(false);

    const previousQuestions = Array.from(
      new Set(
        currentSession.transcript
          .filter((t) => t.type === 'question')
          .map((t) => t.content.trim())
          .filter(Boolean)
      )
    );

    const requestId = ++questionRequestIdRef.current;
    const researchPayload = buildResearchPayload(currentSession.research);
    const currentIndex = currentSession.currentQuestionIndex;

    const publishQuestion = (
      baseSession: DefenseSession,
      questionData: {
        question: string;
        speechText?: string;
        category?: string;
        provider?: string;
        modelUsed?: string;
      }
    ) => {
      if (requestId !== questionRequestIdRef.current) return;
      if (hasUserAnsweredRef.current) return;

      const questionText = String(questionData.question || '').trim();
      const questionSpeechText = String(questionData.speechText || questionText).trim();

      if (!questionText) {
        throw new Error('Pertanyaan kosong dari AI.');
      }

      const questionId = Date.now().toString();

      const newQuestion = {
        id: questionId,
        text: questionText,
        category: questionData.category || 'umum',
        source: 'ai' as const,
        locked: true,
      };

      const qItem: TranscriptItem = {
        id: questionId,
        type: 'question',
        content: questionText,
        questionId,
        questionText,
        speechText: questionSpeechText,
        createdAt: new Date().toISOString(),
      };

      const updatedSession: DefenseSession = {
        ...baseSession,
        transcript: [...baseSession.transcript, qItem],
      };

      setCurrentQuestion(newQuestion);
      setSession(updatedSession);
      saveActiveSession(updatedSession);

      setSpokenText(questionText);
      setIsGeneratingQuestion(false);
      setAiStatus('idle');

      setOrbState('speaking');

      speakText(
        questionSpeechText,
        () => setOrbState('speaking'),
        () => setOrbState('idle')
      );
    };

    try {
      const cachedQuestion = currentSession.questionBank?.find((item) => item.index === currentIndex);

      if (cachedQuestion?.question) {
        publishQuestion(currentSession, cachedQuestion);
        return;
      }

      const remainingQuestions = Math.max(1, currentSession.research.questionCount - currentIndex);
      const batchSize = remainingQuestions;

      const res = await fetch('/api/ai/questions-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research: researchPayload,
          examinerMode: currentSession.research.examinerMode,
          questionIndex: currentIndex,
          batchSize,
          previousQuestions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'AI gagal membuat batch pertanyaan.');
      }

      const incomingQuestions = Array.isArray(data?.questions)
        ? data.questions
          .map((item: any) => {
            const question = String(item.question || '').trim();

            return {
              index: Number(item.index),
              question,
              speechText: String(item.speechText || question).trim(),
              category: String(item.category || 'umum').trim(),
              provider: String(item.provider || data.provider || 'gemini'),
              modelUsed: String(item.modelUsed || data.modelUsed || ''),
              quotaMode: Boolean(item.quotaMode || data.quotaMode),
              fallbackReason: String(item.fallbackReason || data.fallbackReason || ''),
            };
          })
          .filter((item: any) => Number.isFinite(item.index) && item.question.length > 10)
        : [];

      if (!incomingQuestions.length) {
        throw new Error('Respons AI tidak memiliki daftar pertanyaan yang valid.');
      }

      const oldBank = currentSession.questionBank || [];
      const incomingIndexes = new Set(incomingQuestions.map((q: any) => q.index));

      const mergedBank = [
        ...oldBank.filter((q) => !incomingIndexes.has(q.index)),
        ...incomingQuestions,
      ].sort((a, b) => a.index - b.index);

      const sessionWithBank: DefenseSession = {
        ...currentSession,
        questionBank: mergedBank,
        quotaMode: Boolean(data.quotaMode || currentSession.quotaMode),
        quotaModeReason: data.fallbackReason || currentSession.quotaModeReason || '',
      };

      if (data.quotaMode) {
        setQuotaMode(true);
        setQuotaModeReason(data.fallbackReason || 'Mode hemat AI aktif karena kuota AI sedang penuh.');
      }

      const selectedQuestion = mergedBank.find((q) => q.index === currentIndex);

      if (!selectedQuestion?.question) {
        throw new Error('Batch pertanyaan berhasil dibuat, tetapi pertanyaan aktif tidak ditemukan.');
      }

      publishQuestion(sessionWithBank, selectedQuestion);
    } catch (error: any) {
      console.error('Gagal generate pertanyaan AI:', error);

      if (requestId !== questionRequestIdRef.current) return;

      setIsGeneratingQuestion(false);
      setAiStatus('error');
      setOrbState('idle');

      const message =
        `Sistem belum dapat menyiapkan pertanyaan.\n\n` +
        `Penyebab: ${error?.message || 'Tidak diketahui'}\n\n` +
        `Silakan coba ulangi sesi beberapa saat lagi atau periksa koneksi server.`;

      const sysItem: TranscriptItem = {
        id: Date.now().toString(),
        type: 'system',
        content: message,
        createdAt: new Date().toISOString(),
      };

      addTranscript(sysItem, currentSession);
    }
  };

  const handleAnswerSubmit = async (answerText: string) => {
    if (!session || !answerText.trim() || !currentQuestion || isGeneratingQuestion || isEvaluatingAnswer) return;

    setIsVoiceListening(false);
    hasUserAnsweredRef.current = true;
    stopSpeaking();
    setIsEvaluatingAnswer(true);
    setAiStatus('evaluating');
    setOrbState('thinking');
    setSpokenMode('feedback');
    setSpokenText('Menganalisis jawaban...');
    setChatInput('');

    const activeAnswerQuestionId = currentQuestion.id;
    const activeAnswerQuestionText = currentQuestion.text;
    const activeAnswerText = answerText.trim();

    const ansItem: TranscriptItem = {
      id: Date.now().toString(),
      type: 'answer',
      content: activeAnswerText,
      questionId: activeAnswerQuestionId,
      questionText: activeAnswerQuestionText,
      answerText: activeAnswerText,
      createdAt: new Date().toISOString(),
    };

    const updatedSession = addTranscript(ansItem, session);
    const researchPayload = buildResearchPayload(updatedSession.research);

    let evaluation;
    let errorOccurred = false;

    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research: researchPayload,
          examinerMode: updatedSession.research.examinerMode,
          question: activeAnswerQuestionText,
          answer: activeAnswerText,
          transcript: updatedSession.transcript,
        }),
      });

      if (!res.ok) throw new Error('API fallback');

      evaluation = await res.json();
    } catch (e) {
      console.warn('Fallback evaluate');
      evaluation = evaluateAnswer(
        activeAnswerQuestionText,
        activeAnswerText,
        researchPayload,
        updatedSession.research.examinerMode
      );
      errorOccurred = true;
    }

    if (currentQuestion.id !== activeAnswerQuestionId) {
      console.warn('Ignored evaluation response: currentQuestion changed while evaluating.');
      setIsEvaluatingAnswer(false);
      setAiStatus('idle');
      setOrbState('idle');
      return;
    }

    const normEval = normalizeFeedback(evaluation);

    if (evaluation?.quotaMode) {
      setQuotaMode(true);
      setQuotaModeReason(evaluation?.reason || 'Mode hemat AI aktif.');
    }

    const strengthsText = normEval.strengths.map((s, idx) => `${idx + 1}) ${s}`).join('\n');
    const weaknessesText = normEval.weaknesses.map((w, idx) => `${idx + 1}) ${w}`).join('\n');

    const feedbackText = `Skor: ${normEval.score}.\n\nKekuatan:\n${strengthsText}\n\nPerlu Diperbaiki:\n${weaknessesText}\n\nSaran:\n${normEval.suggestion}`;

    const speechStrengths = normEval.strengths
      .slice(0, 2)
      .map((item, index) => `${index + 1}. ${item}`)
      .join('. ');

    const speechWeaknesses = normEval.weaknesses
      .slice(0, 2)
      .map((item, index) => `${index + 1}. ${item}`)
      .join('. ');

    const feedbackSpeechText =
      `Skor ${normEval.score}. ` +
      `Kekuatan: ${speechStrengths || 'belum terlihat jelas'}. ` +
      `Yang perlu diperbaiki: ${speechWeaknesses || 'tidak ada catatan utama'}. ` +
      `Saran: ${normEval.suggestion}`;

    const fbItem: TranscriptItem = {
      id: Date.now().toString(),
      type: 'feedback',
      content: feedbackText,
      questionId: activeAnswerQuestionId,
      questionText: activeAnswerQuestionText,
      answerText: activeAnswerText,
      normalizedAnswer: normEval.normalizedAnswer,
      feedback: feedbackText,
      speechText: feedbackSpeechText,
      score: normEval.score,
      createdAt: new Date().toISOString(),
    };

    const sessionAfterFeedback: DefenseSession = {
      ...updatedSession,
      transcript: [...updatedSession.transcript, fbItem],
      quotaMode: Boolean(updatedSession.quotaMode || evaluation?.quotaMode),
      quotaModeReason: evaluation?.reason || updatedSession.quotaModeReason || '',
    };

    setSession(sessionAfterFeedback);
    saveActiveSession(sessionAfterFeedback);

    setSpokenText(feedbackText);
    setHasFeedback(true);
    setIsEvaluatingAnswer(false);
    setAiStatus(errorOccurred ? 'error' : 'idle');

    setOrbState('speaking');

    speakText(
      feedbackSpeechText,
      () => setOrbState('speaking'),
      () => setOrbState('idle')
    );
  };

  const handleNextQuestion = () => {
    if (!session || isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession) return;

    stopSpeaking();

    if (session.currentQuestionIndex + 1 >= session.research.questionCount) {
      executeFinishSession();
      return;
    }

    setChatInput('');
    setHasFeedback(false);
    hasUserAnsweredRef.current = false;

    const updated = {
      ...session,
      currentQuestionIndex: session.currentQuestionIndex + 1,
    };

    setSession(updated);
    saveActiveSession(updated);

    setCurrentQuestion((prev) => (prev ? { ...prev, locked: false } : null));

    handleGenerateQuestion(updated);
  };

  const calculateAverageScore = (transcript: any[]): number => {
    const feedbackItems = transcript.filter((t) => t.type === 'feedback' && typeof t.score === 'number');

    if (feedbackItems.length > 0) {
      const total = feedbackItems.reduce((sum, item) => sum + (item.score || 0), 0);
      const avg = Math.round(total / feedbackItems.length);
      return Math.max(0, Math.min(100, avg));
    }

    const hasAnswers = transcript.some((t) => t.type === 'answer');
    if (hasAnswers) return 50;

    return 0;
  };

  const executeFinishSession = async () => {
    if (isFinishingSession) return;

    const latestSession = getActiveSession() || session;
    if (!latestSession) return;

    setIsFinishingSession(true);
    stopSpeaking();
    setOrbState('thinking');
    setSpokenMode('feedback');
    setSpokenText('Menyusun evaluasi akhir...');

    try {
      const researchPayload = buildResearchPayload(latestSession.research);

      let finalEval;

      try {
        const res = await fetch('/api/ai/final-evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            research: researchPayload,
            examinerMode: latestSession.research.examinerMode,
            transcript: latestSession.transcript,
          }),
        });

        if (!res.ok) throw new Error('fallback');

        finalEval = await res.json();
      } catch (e) {
        console.warn('Fallback final eval');
        finalEval = generateFinalEvaluation({ ...latestSession, research: researchPayload });
      }

      const avgScore = calculateAverageScore(latestSession.transcript);

      let finalScore = Number(finalEval.score);
      if (isNaN(finalScore) || finalScore === 0) {
        finalScore = avgScore > 0 ? avgScore : isNaN(finalScore) ? 0 : finalScore;
      }

      finalScore = Math.max(0, Math.min(100, finalScore));
      finalEval.score = finalScore;

      const hasAnswers = latestSession.transcript.some((t) => t.type === 'answer');

      if (hasAnswers) {
        saveHistoryItem({
          id: latestSession.id,
          title: latestSession.research.title,
          examinerMode: latestSession.research.examinerMode,
          score: finalScore,
          questionCount: latestSession.research.questionCount,
          summary: finalEval.summary,
          createdAt: new Date().toISOString(),
          sessionType: latestSession.research.sessionType,
          field: latestSession.research.field,
          method: latestSession.research.method,
          sessionLength: latestSession.research.sessionLength,
          transcript: latestSession.transcript,
          strengths: finalEval.strengths,
          weaknesses: finalEval.weaknesses,
          nextPractice: finalEval.nextPractice || ['Terus berlatih'],
        });

        localStorage.setItem(
          'ruanguji_latest_eval',
          JSON.stringify({
            score: finalScore,
            summary: finalEval.summary,
            strengths: finalEval.strengths,
            weaknesses: finalEval.weaknesses,
            nextPractice: finalEval.nextPractice || ['Terus berlatih'],
          })
        );

        clearActiveSession();
        navigate('/evaluation');
        return;
      }

      clearActiveSession();
      navigate('/setup');
    } catch (error) {
      console.error('Gagal menyelesaikan sesi:', error);
      setIsFinishingSession(false);
      setOrbState('idle');

      const sysItem: TranscriptItem = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Gagal menyusun evaluasi akhir. Silakan coba klik tombol selesai sekali lagi.',
        createdAt: new Date().toISOString(),
      };

      addTranscript(sysItem, latestSession);
    }
  };

  if (!session) {
    return (
      <div className="defense-empty">
        <div className="card soft-shadow defense-empty-card">
          <h2>Belum ada sesi aktif</h2>
          <p>Mulai dari halaman persiapan untuk membuat simulasi sidang.</p>
          <Link to="/setup" className="btn btn-primary">
            Siapkan Sidang
          </Link>
        </div>
      </div>
    );
  }

  const { research, currentQuestionIndex } = session;
  const currentQ = currentQuestionIndex + 1;

  const effectiveOrbState =
    isVoiceListening
      ? 'listening'
      : isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession
        ? 'thinking'
        : orbState;

  const botIsActive =
    isGeneratingQuestion ||
    isEvaluatingAnswer ||
    isFinishingSession ||
    isVoiceListening ||
    effectiveOrbState === 'speaking' ||
    effectiveOrbState === 'listening' ||
    effectiveOrbState === 'thinking';

  const botVisualState = botIsActive ? effectiveOrbState : 'idle';

  const orbStateLabel = isVoiceListening
    ? 'Mendengarkan jawaban'
    : isGeneratingQuestion
      ? 'Menyiapkan pertanyaan'
      : isEvaluatingAnswer
        ? 'Menilai jawaban'
        : isFinishingSession
          ? 'Menyusun evaluasi'
          : effectiveOrbState === 'speaking'
            ? 'Sedang berbicara'
            : 'Siap menguji';

  const quotaMessage = 'Mode hemat AI aktif karena kuota penuh.';
  const aiDisclaimerMessage = 'RuangUji bisa keliru. Gunakan sebagai latihan, bukan penilaian final.';

  const activeQuestionItem = session.transcript.slice().reverse().find((t) => t.type === 'question');
  const activeQuestion = activeQuestionItem ? activeQuestionItem.content : '';

  const finishingTitle = 'Menyusun Evaluasi Akhir';
  const finishingMessage =
    'Mohon tunggu sebentar. RuangUji sedang menyimpan transkrip, menghitung skor akhir, dan menyiapkan halaman evaluasi.';

  return (
    <div className="defense-root">
      <div
        className={`mobile-overlay ${showLeftDrawer || showRightDrawer ? 'open' : ''}`}
        onClick={() => {
          setShowLeftDrawer(false);
          setShowRightDrawer(false);
        }}
      />

      <header className="defense-header">
        <div className="defense-header-inner">
          <div className="defense-header-side defense-header-left">
            <button onClick={() => setShowBackModal(true)} className="defense-back-btn">
              <ArrowLeft size={18} />
              <span className="defense-back-text">Kembali</span>
            </button>

            <div className="defense-brand-separator" />

            <div className="defense-brand">
              <img src={logoRuangUji} alt="Logo RuangUji" className="defense-brand-logo" />
              <span>RuangUji</span>
            </div>
          </div>

          <div className="defense-header-title">
            <h1>Ruang Sidang</h1>
            <p>
              Pertanyaan {currentQ} dari {research.questionCount}
            </p>
          </div>

          <div className="defense-header-side defense-header-right">
            <span className="badge defense-desktop-only defense-mode-badge">Mode: {research.examinerMode}</span>
            <span className="badge defense-desktop-only defense-duration-badge">Durasi: {research.sessionLength}</span>

            <div
              className="defense-desktop-only defense-voice-control"
              title="Pilih gaya suara RuangUji"
            >
              <AudioLines size={15} />
              <select
                value={voiceProfile}
                onChange={(e) => {
                  setVoiceProfile(e.target.value);
                  localStorage.setItem('ruanguji_voice_profile', e.target.value);
                }}
                aria-label="Pilih gaya suara RuangUji"
              >
                <option value="Tenang">Tenang</option>
                <option value="Formal">Formal</option>
                <option value="Hangat">Hangat</option>
                <option value="Tegas">Tegas</option>
                <option value="Cepat">Cepat</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (!isFinishingSession) setShowEndModal(true);
              }}
              disabled={isFinishingSession}
              className="btn btn-secondary defense-end-btn"
            >
              {isFinishingSession ? 'Menyimpan...' : 'Akhiri Sesi'}
            </button>
          </div>
        </div>
      </header>

      <div className="defense-mobile-tabs">
        <button
          onClick={() => setShowLeftDrawer((prev) => !prev)}
          className={`defense-mobile-tab-btn ${showLeftDrawer ? 'active' : ''}`}
        >
          <Info size={14} />
          Info
        </button>

        <button
          onClick={() => setShowRightDrawer((prev) => !prev)}
          className={`defense-mobile-tab-btn ${showRightDrawer ? 'active' : ''}`}
        >
          <FileText size={14} />
          Transkrip
        </button>
      </div>

      <main className="defense-workspace-grid">
        <div className={`defense-panel-left defense-panel ${showLeftDrawer ? 'open' : ''}`}>
          <div className="defense-panel-header">
            <div>
              <p>Informasi Latihan</p>
              <h3>Detail Penelitian</h3>
            </div>

            <button onClick={() => setShowLeftDrawer(false)} className="mobile-drawer-toggles">
              <PanelLeftClose size={20} />
            </button>
          </div>

          <div className="custom-scrollbar defense-info-body">
            <div className="defense-info-list">
              <InfoBlock label="Judul Penelitian" value={research.title} strong />
              <InfoBlock label="Jenis Sidang" value={research.sessionType} />
              <InfoBlock label="Bidang / Topik" value={research.field || '-'} />

              {research.keywords && <InfoBlock label="Kata Kunci / Fokus" value={research.keywords} />}

              <InfoBlock label="Pendekatan Penelitian" value={research.researchApproach || '-'} />
              <InfoBlock label="Metode" value={research.method} />

              {research.documentName && (
                <InfoBlock
                  label="Dokumen Diunggah"
                  value={research.documentName}
                  helper="Digunakan sebagai konteks AI"
                  strong
                />
              )}

              {research.concern && <InfoBlock label="Concern / Kekhawatiran" value={research.concern} danger />}

              <div>
                <p className="defense-info-label">Abstrak</p>
                <div className="custom-scrollbar defense-abstract-box">
                  {research.abstract || 'Belum ada abstrak.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="defense-panel-main defense-panel">
          <div className="defense-main-header">
            <p>{isVoiceMode ? 'Voice Stage' : 'Panel Penguji'}</p>

            <div className="defense-main-header-actions">
              <button
                onClick={toggleVoice}
                className={`defense-audio-pill ${voiceEnabled ? 'active' : ''}`}
                title={voiceEnabled ? 'Mute Suara AI' : 'Unmute Suara AI'}
              >
                {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{voiceEnabled ? 'Suara AI Aktif' : 'Mute'}</span>
              </button>

              <div className="defense-status-pill">
                <span className={orbState !== 'idle' ? 'active' : ''} />
                <p>{orbStateLabel}</p>
              </div>
            </div>
          </div>

          <div className="defense-mobile-bot-strip">
            <RuangUjiBot state={botVisualState} size={46} />
            <div>
              <strong>{orbStateLabel}</strong>
              <span>
                {isVoiceMode
                  ? 'Mode voice aktif. Jawab dengan suara saat siap.'
                  : 'Mode chat aktif. Ketik jawaban Anda.'}
              </span>
            </div>
          </div>

          <div className={`defense-main-content ${isVoiceMode ? 'voice-layout' : 'chat-layout'}`}>
            <div ref={middleScrollRef} className="custom-scrollbar defense-center-scroll">
              {quotaMode && !isVoiceMode && (
                <div className="defense-warning-card quota">
                  <Info size={15} />
                  <span>{quotaMessage}</span>
                </div>
              )}

              {isVoiceMode ? (
                <div className="fade-up voice-stage-container">
                  {isGeneratingQuestion ? (
                    <VoiceQuestionState text="Menyiapkan pertanyaan..." />
                  ) : isEvaluatingAnswer ? (
                    <VoiceQuestionState text="Menganalisis jawaban..." blue />
                  ) : activeQuestion ? (
                    <div className="voice-question-card">
                      <p className="voice-question-label">Pertanyaan Aktif</p>
                      <p className={expandedItems[activeQuestionItem?.id || ''] ? 'voice-question-text open' : 'voice-question-text'}>
                        {activeQuestion}
                      </p>

                      {activeQuestion.length > 130 && (
                        <button onClick={() => toggleItemExpand(activeQuestionItem?.id || '')} className="text-link-btn">
                          {expandedItems[activeQuestionItem?.id || ''] ? 'Sembunyikan' : 'Lihat lengkap'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  {session.transcript.map((item) => {
                    if (item.type === 'question') {
                      return (
                        <ChatBubble
                          key={item.id}
                          item={item}
                          role="question"
                          expanded={Boolean(expandedItems[item.id])}
                          onToggle={() => toggleItemExpand(item.id)}
                        />
                      );
                    }

                    if (item.type === 'feedback') {
                      return (
                        <ChatBubble
                          key={item.id}
                          item={item}
                          role="feedback"
                          expanded={Boolean(expandedItems[item.id])}
                          onToggle={() => toggleItemExpand(item.id)}
                        />
                      );
                    }

                    if (item.type === 'answer') {
                      return (
                        <ChatBubble
                          key={item.id}
                          item={item}
                          role="answer"
                          expanded={Boolean(expandedItems[item.id])}
                          onToggle={() => toggleItemExpand(item.id)}
                        />
                      );
                    }

                    return null;
                  })}

                  {isGeneratingQuestion && (
                    <div className="fade-up chat-loading-bubble">
                      <Loader2 size={16} />
                      <p>Menyiapkan pertanyaan...</p>
                    </div>
                  )}

                  {isEvaluatingAnswer && (
                    <div className="fade-up chat-loading-bubble evaluating">
                      <Loader2 size={16} />
                      <span>RuangUji sedang memikirkan dan menilai jawaban Anda...</span>
                    </div>
                  )}

                  {hasFeedback && (
                    <div className="next-question-wrap">
                      <button
                        className="btn btn-primary fade-up defense-next-wide"
                        onClick={handleNextQuestion}
                        disabled={isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession}
                      >
                        {isFinishingSession
                          ? 'Menyusun Evaluasi...'
                          : currentQ >= research.questionCount
                            ? 'Selesai & Lihat Evaluasi'
                            : 'Lanjut ke Pertanyaan Berikutnya'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="defense-footer-input">
            {isVoiceMode ? (
              <div className="defense-action-row">
                <button
                  onClick={() => {
                    setIsVoiceMode(false);
                  }}
                  disabled={isFinishingSession}
                  className="btn btn-secondary defense-mode-btn"
                >
                  Kembali ke Chat
                </button>

                <div className="defense-action-right">
                  {hasFeedback ? (
                    <button
                      className="btn btn-primary fade-up defense-next-btn"
                      onClick={handleNextQuestion}
                      disabled={isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession}
                    >
                      {isFinishingSession
                        ? 'Menyusun...'
                        : currentQ >= research.questionCount
                          ? 'Selesai'
                          : 'Pertanyaan Berikutnya'}
                    </button>
                  ) : (
                    <div className="voice-answer-compact">
                      <VoiceAnswer
                        key={currentQuestionIndex}
                        onSubmit={handleAnswerSubmit}
                        disabled={orbState !== 'idle' && orbState !== 'listening'}
                        isThinking={orbState === 'thinking'}
                        autoMode
                        onListeningChange={(listening) => {
                          setIsVoiceListening(listening);

                          if (listening) {
                            stopSpeaking();
                            setOrbState('listening');
                            return;
                          }

                          if (!isGeneratingQuestion && !isEvaluatingAnswer && !isFinishingSession) {
                            setOrbState('idle');
                          }
                        }}
                      />
                    </div>
                  )}

                  <button
                    onClick={toggleVoice}
                    className={`defense-circle-btn ${voiceEnabled ? 'voice-on' : 'voice-off'}`}
                    title={voiceEnabled ? 'Mute Suara AI' : 'Aktifkan Suara AI'}
                  >
                    {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="defense-chat-input-shell">
                <textarea
                  className="custom-scrollbar"
                  rows={Math.min(chatInput.split('\n').length || 1, 4)}
                  placeholder="Ketik jawaban Anda di sini..."
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    if (e.target.value.trim().length > 0) {
                      hasUserAnsweredRef.current = true;
                    }
                  }}
                  disabled={hasFeedback || orbState === 'thinking' || isGeneratingQuestion || isEvaluatingAnswer}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAnswerSubmit(chatInput);
                    }
                  }}
                />

                <div className="defense-input-actions">
                  {chatInput.trim() ? (
                    <button
                      onClick={() => handleAnswerSubmit(chatInput)}
                      disabled={hasFeedback || orbState === 'thinking' || isGeneratingQuestion || isEvaluatingAnswer}
                      className="defense-circle-btn defense-send-btn"
                      title="Kirim jawaban"
                    >
                      <Send size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsVoiceMode(true)}
                      disabled={isGeneratingQuestion || isEvaluatingAnswer}
                      className="defense-circle-btn voice-on"
                      title="Masuk Voice Stage"
                    >
                      <Speech size={16} />
                    </button>
                  )}

                  <button
                    onClick={toggleVoice}
                    className={`defense-circle-btn ${voiceEnabled ? 'voice-on' : 'voice-off'}`}
                    title={voiceEnabled ? 'Mute Suara AI' : 'Aktifkan Suara AI'}
                  >
                    {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>
              </div>
            )}

            <p className="defense-bottom-disclaimer">
              {aiDisclaimerMessage}
            </p>
          </div>
        </div>

        <div className={`defense-panel-right defense-panel ${showRightDrawer ? 'open' : ''}`}>
          <div className="defense-side-bot-card">
            <div className={`defense-side-bot-stage ${botIsActive ? 'active' : ''}`}>
              <div className="defense-ai-orbit orbit-large" />
              <div className="defense-ai-orbit orbit-small" />

              <RuangUjiBot state={botVisualState} size={118} />

              {botIsActive && (
                <div className="defense-ai-dots">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>

            <div className="defense-side-bot-caption">
              <strong>{orbStateLabel}</strong>
              <span>
                {isVoiceMode ? 'Mode voice aktif.' : 'Mode chat aktif.'}
              </span>
            </div>
          </div>

          <div className="defense-panel-header transcript-header">
            <div>
              <p>Transkrip Sesi</p>
              <span>Riwayat lengkap obrolan</span>
            </div>

            <button onClick={() => setShowRightDrawer(false)} className="mobile-drawer-toggles">
              <PanelRightClose size={20} />
            </button>
          </div>

          <div className="defense-transcript-body">
            <SessionTranscript transcript={session.transcript} />
          </div>
        </div>
      </main>

      {isFinishingSession && (
        <div role="status" aria-live="polite" aria-label="Menyusun evaluasi akhir" className="finishing-overlay">
          <div className="fade-up finishing-card">
            <div className="finishing-icon">
              <Loader2 size={30} />
            </div>

            <h3>{finishingTitle}</h3>
            <p>{finishingMessage}</p>

            <div className="finishing-note">Jangan tutup halaman ini sampai proses selesai.</div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showBackModal}
        title="Keluar dari ruang sidang?"
        message="Sesi masih berjalan. Anda bisa kembali nanti dan progres latihan tetap tersimpan."
        confirmText="Keluar"
        cancelText="Tetap di Sini"
        type="info"
        onConfirm={() => {
          setShowBackModal(false);
          navigate('/');
        }}
        onClose={() => setShowBackModal(false)}
      />

      <ConfirmModal
        isOpen={showEndModal}
        title="Akhiri sesi sekarang?"
        message={`Anda sedang berada di pertanyaan ${currentQ} dari ${research.questionCount}. Hasil latihan akan disimpan ke riwayat.`}
        confirmText="Akhiri Sesi"
        cancelText="Batal"
        type="danger"
        onConfirm={() => {
          setShowEndModal(false);
          window.setTimeout(() => {
            executeFinishSession();
          }, 80);
        }}
        onClose={() => setShowEndModal(false)}
      />

      <TextDetailModal
        open={detailModalOpen}
        title={detailModalContent.title}
        content={detailModalContent.content}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
}

function InfoBlock({
  label,
  value,
  helper,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  helper?: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="defense-info-block">
      <p className="defense-info-label">{label}</p>
      <p className={`defense-info-value ${strong ? 'strong' : ''} ${danger ? 'danger' : ''}`}>{value}</p>
      {helper && <p className="defense-info-helper">{helper}</p>}
    </div>
  );
}

function VoiceQuestionState({ text, blue = false }: { text: string; blue?: boolean }) {
  return (
    <div className={`voice-question-card loading ${blue ? 'blue' : ''}`}>
      <Loader2 size={16} />
      <p>{text}</p>
    </div>
  );
}

function ChatBubble({
  item,
  role,
  expanded,
  onToggle,
}: {
  item: TranscriptItem;
  role: 'question' | 'answer' | 'feedback';
  expanded: boolean;
  onToggle: () => void;
}) {
  const isAnswer = role === 'answer';
  const isFeedback = role === 'feedback';
  const shouldShowToggle = item.content.length > 200;

  return (
    <div className={`fade-up chat-row ${isAnswer ? 'right' : 'left'}`}>
      <div className={`chat-bubble ${role}`}>
        {isFeedback ? (
          <div className="chat-label feedback-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={16} color="#15803d" />
              <span>Umpan Balik</span>
            </div>

            {item.score !== undefined && <span className="chat-score">Skor: {item.score}</span>}
          </div>
        ) : isAnswer ? (
          <div className="chat-label answer-label">
            <span>Anda</span>
          </div>
        ) : (
          <div className="chat-label">
            <Bot size={16} color="var(--text-muted)" />
            <span>Penguji</span>
          </div>
        )}

        <p className={`chat-content ${expanded ? '' : 'collapsed'}`}>{item.content}</p>

        {shouldShowToggle && (
          <button onClick={onToggle} className="chat-toggle-btn">
            {expanded ? 'Sembunyikan' : 'Lihat lengkap'}
          </button>
        )}
      </div>
    </div>
  );
}
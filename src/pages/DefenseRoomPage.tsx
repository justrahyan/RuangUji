import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Bot, Mic, Send, Speech, PanelLeftClose, PanelRightClose, Info, FileText, Loader2 } from 'lucide-react';
import type { DefenseSession, TranscriptItem } from '../types';
import { getActiveSession, clearActiveSession, saveActiveSession, saveHistoryItem, getInMemoryDocumentText } from '../lib/storage';
import { evaluateAnswer, generateFinalEvaluation } from '../lib/localEngine';
import { speakText, stopSpeaking, handleMuteToggle } from '../lib/speech';

import VoiceOrb from '../components/VoiceOrb';
import VoiceAnswer from '../components/VoiceAnswer';
import ConfirmModal from '../components/ConfirmModal';
import SessionTranscript from '../components/SessionTranscript';
import TextDetailModal from '../components/TextDetailModal';

function normalizeFeedback(evaluation: any) {
  let score = Number(evaluation.score);
  if (isNaN(score)) {
    score = 0;
  }
  score = Math.max(0, Math.min(100, score));

  let strengths: string[] = [];
  if (Array.isArray(evaluation.strengths)) {
    strengths = evaluation.strengths.map((s: any) => String(s).trim()).filter(Boolean);
  } else if (typeof evaluation.strengths === 'string') {
    strengths = evaluation.strengths.split('\n').map((s: string) => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
  }
  if (strengths.length === 0) {
    strengths = ["Belum terdeteksi secara jelas."];
  }

  let weaknesses: string[] = [];
  if (Array.isArray(evaluation.weaknesses)) {
    weaknesses = evaluation.weaknesses.map((w: any) => String(w).trim()).filter(Boolean);
  } else if (typeof evaluation.weaknesses === 'string') {
    weaknesses = evaluation.weaknesses.split('\n').map((w: string) => w.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
  }
  if (weaknesses.length === 0) {
    weaknesses = ["Tidak ada."];
  }

  let suggestion = evaluation.suggestion || evaluation.saran;
  if (!suggestion || typeof suggestion !== 'string' || !suggestion.trim()) {
    suggestion = "Pertahankan struktur jawaban dan sesuaikan dengan inti pertanyaan.";
  } else {
    suggestion = suggestion.trim().replace(/\s+/g, ' ');
  }

  const speechText =
    typeof evaluation.speechText === 'string' && evaluation.speechText.trim()
      ? evaluation.speechText.trim()
      : '';

  return {
    score,
    strengths,
    weaknesses,
    suggestion,
    speechText,
    answerCategory: evaluation.answerCategory || ''
  };
}

export default function DefenseRoomPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<DefenseSession | null>(null);

  // Modes
  const [isVoiceMode, setIsVoiceMode] = useState(false); // DEFAULT = CHAT MODE

  // Mobile Drawers
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  // States
  const [orbState, setOrbState] = useState<'idle' | 'speaking' | 'listening' | 'thinking'>('idle');
  const [, setSpokenText] = useState('');
  const [, setSpokenMode] = useState<'question' | 'feedback' | 'listening'>('question');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('ruanguji_voice_muted') !== 'true');
  const [voiceProfile, setVoiceProfile] = useState(localStorage.getItem('ruanguji_voice_profile') || 'Formal');
  const [hasFeedback, setHasFeedback] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const dictationRef = useRef<any>(null);

  const [showBackModal, setShowBackModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalContent,] = useState({ title: '', content: '' });

  const middleScrollRef = useRef<HTMLDivElement>(null);

  // New stabilization states & refs
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
  const [, setAiStatus] = useState<'idle' | 'generating-question' | 'evaluating' | 'fallback' | 'error'>('idle');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const questionRequestIdRef = useRef(0);
  const hasUserAnsweredRef = useRef(false);

  useEffect(() => {
    const active = getActiveSession();
    if (active) {
      setSession(active);
      if (active.transcript.length === 0) {
        handleGenerateQuestion(active);
      } else {
        const lastItem = active.transcript[active.transcript.length - 1];
        setSpokenText(lastItem.content);
        setSpokenMode(lastItem.type === 'feedback' ? 'feedback' : 'question');
        setHasFeedback(lastItem.type === 'feedback');

        // Restore currentQuestion state from transcript
        const lastQItem = active.transcript.slice().reverse().find(t => t.type === 'question');
        if (lastQItem) {
          setCurrentQuestion({
            id: lastQItem.id,
            text: lastQItem.content,
            category: lastQItem.questionId || 'umum',
            source: (lastQItem.questionText ? 'ai' : 'local-fallback'),
            locked: true
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
      if (dictationRef.current) dictationRef.current.stop();
    };
  }, []);

  const toggleVoice = () => {
    const newVal = !voiceEnabled;

    setVoiceEnabled(newVal);
    localStorage.setItem('ruanguji_voice_muted', newVal ? 'false' : 'true');

    handleMuteToggle();

    // Jangan set orbState ke idle saat mute.
    // Mute hanya membisukan/menahan suara, bukan membatalkan bacaan.
  };

  const buildResearchPayload = (research: DefenseSession['research']) => {
    const memText = getInMemoryDocumentText(research.id) || getInMemoryDocumentText(research.docId || '') || research.documentText;

    // Jika ada docId, server sudah menyimpan dokumen penuh di documentCache.
    // Jangan kirim teks penuh lewat JSON karena bisa kepotong / kena limit request.
    // documentText hanya dipakai sebagai fallback untuk mode lokal tanpa docId.
    return {
      ...research,
      documentText: research.docId ? undefined : memText
    };
  };

  const addTranscript = (item: TranscriptItem, currentSession: DefenseSession) => {
    const updated = { ...currentSession, transcript: [...currentSession.transcript, item] };
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
          .filter(t => t.type === 'question')
          .map(t => t.content.trim())
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
      const cachedQuestion = currentSession.questionBank?.find(
        item => item.index === currentIndex
      );

      if (cachedQuestion?.question) {
        publishQuestion(currentSession, cachedQuestion);
        return;
      }

      const remainingQuestions = Math.max(
        1,
        currentSession.research.questionCount - currentIndex
      );

      const batchSize = Math.min(5, remainingQuestions);

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
        ...oldBank.filter(q => !incomingIndexes.has(q.index)),
        ...incomingQuestions,
      ].sort((a, b) => a.index - b.index);

      const sessionWithBank: DefenseSession = {
        ...currentSession,
        questionBank: mergedBank,
      };

      const selectedQuestion = mergedBank.find(q => q.index === currentIndex);

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
        `AI gagal membuat pertanyaan dari dokumen.\n\n` +
        `Penyebab: ${error?.message || 'Tidak diketahui'}\n\n` +
        `Sistem sudah mencoba batch pertanyaan dan fallback beberapa model Gemini. ` +
        `Jika tetap gagal, kemungkinan semua quota/rate limit model sedang habis. ` +
        `Pertanyaan localEngine tetap dimatikan agar tidak muncul pertanyaan template yang tidak sesuai konteks.`;

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

    hasUserAnsweredRef.current = true;
    stopSpeaking();
    setIsEvaluatingAnswer(true);
    setAiStatus('evaluating');
    setOrbState('thinking');
    setSpokenMode('feedback');
    setSpokenText('Menganalisis jawaban...');
    setChatInput('');
    if (isDictating) toggleDictation();

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
      createdAt: new Date().toISOString()
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
          transcript: updatedSession.transcript
        })
      });
      if (!res.ok) throw new Error('API fallback');
      evaluation = await res.json();
    } catch (e) {
      console.warn('Fallback evaluate');
      evaluation = evaluateAnswer(activeAnswerQuestionText, activeAnswerText, researchPayload, updatedSession.research.examinerMode);
      errorOccurred = true;
    }

    // Ignore response if question was changed in the meantime
    if (currentQuestion.id !== activeAnswerQuestionId) {
      console.warn("Ignored evaluation response: currentQuestion changed while evaluating.");
      setIsEvaluatingAnswer(false);
      setAiStatus('idle');
      setOrbState('idle');
      return;
    }

    const normEval = normalizeFeedback(evaluation);
    const strengthsText = normEval.strengths.map((s, idx) => `${idx + 1}) ${s}`).join('\n');
    const weaknessesText = normEval.weaknesses.map((w, idx) => `${idx + 1}) ${w}`).join('\n');

    const feedbackText = `Skor: ${normEval.score}.\n\nKekuatan:\n${strengthsText}\n\nPerlu Diperbaiki:\n${weaknessesText}\n\nSaran:\n${normEval.suggestion}`;
    const feedbackSpeechText =
      normEval.speechText ||
      `Skor ${normEval.score}. ${normEval.suggestion}`;

    const fbItem: TranscriptItem = {
      id: Date.now().toString(),
      type: 'feedback',
      content: feedbackText,
      questionId: activeAnswerQuestionId,
      questionText: activeAnswerQuestionText,
      answerText: activeAnswerText,
      feedback: feedbackText,
      speechText: feedbackSpeechText,
      score: normEval.score,
      createdAt: new Date().toISOString()
    };

    addTranscript(fbItem, updatedSession);
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
    } else {
      setChatInput('');
      setHasFeedback(false);
      hasUserAnsweredRef.current = false;

      const updated = { ...session, currentQuestionIndex: session.currentQuestionIndex + 1 };
      setSession(updated);
      saveActiveSession(updated);

      setCurrentQuestion(prev => prev ? { ...prev, locked: false } : null);

      handleGenerateQuestion(updated);
    }
  };

  const calculateAverageScore = (transcript: any[]): number => {
    const feedbackItems = transcript.filter(t => t.type === 'feedback' && typeof t.score === 'number');
    if (feedbackItems.length > 0) {
      const total = feedbackItems.reduce((sum, item) => sum + (item.score || 0), 0);
      const avg = Math.round(total / feedbackItems.length);
      return Math.max(0, Math.min(100, avg));
    }

    const hasAnswers = transcript.some(t => t.type === 'answer');
    if (hasAnswers) {
      return 50;
    }
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
            transcript: latestSession.transcript
          })
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
        if (avgScore > 0) {
          finalScore = avgScore;
        } else {
          finalScore = isNaN(finalScore) ? 0 : finalScore;
        }
      }

      finalScore = Math.max(0, Math.min(100, finalScore));
      finalEval.score = finalScore;

      const hasAnswers = latestSession.transcript.some(t => t.type === 'answer');

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
          nextPractice: finalEval.nextPractice || ['Terus berlatih']
        });

        localStorage.setItem('ruanguji_latest_eval', JSON.stringify({
          score: finalScore,
          summary: finalEval.summary,
          strengths: finalEval.strengths,
          weaknesses: finalEval.weaknesses,
          nextPractice: finalEval.nextPractice || ['Terus berlatih']
        }));

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

  const toggleDictation = () => {
    if (isDictating) {
      if (dictationRef.current) dictationRef.current.stop();
      setIsDictating(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Browser tidak mendukung speech-to-text. Silakan gunakan Chrome.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setChatInput(prev => {
          const newText = prev ? prev + ' ' + text : text;
          if (newText.trim().length > 0) {
            hasUserAnsweredRef.current = true;
          }
          return newText;
        });
      };

      recognition.onend = () => setIsDictating(false);
      recognition.onerror = () => setIsDictating(false);

      dictationRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    }
  };

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div className="card soft-shadow" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '500px', width: '100%', margin: '0 1rem', backgroundColor: 'var(--white)', borderRadius: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Belum ada sesi aktif</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Mulai dari halaman persiapan untuk membuat simulasi sidang.</p>
          <Link to="/setup" className="btn btn-primary">
            Siapkan Sidang
          </Link>
        </div>
      </div>
    );
  }

  const { research, currentQuestionIndex } = session;
  const currentQ = currentQuestionIndex + 1;

  const orbStateLabel = isGeneratingQuestion ? 'Menyiapkan' :
    isEvaluatingAnswer ? 'Menganalisis jawaban' :
      orbState === 'idle' ? 'Siap menguji' :
        orbState === 'speaking' ? 'Sedang berbicara' :
          orbState === 'listening' ? 'Mendengarkan' : 'Menganalisis';

  const activeQuestionItem = session.transcript.slice().reverse().find(t => t.type === 'question');
  const activeQuestion = activeQuestionItem ? activeQuestionItem.content : '';

  const finishingTitle = 'Menyusun Evaluasi Akhir';
  const finishingMessage =
    'Mohon tunggu sebentar. RuangUji sedang menyimpan transkrip, menghitung skor akhir, dan menyiapkan halaman evaluasi.';

  return (
    <div
      className="defense-root"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        overflow: 'hidden'
      }}
    >
      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-overlay ${showLeftDrawer || showRightDrawer ? 'open' : ''}`}
        onClick={() => { setShowLeftDrawer(false); setShowRightDrawer(false); }}
      ></div>

      {/* Header Fullscreen Workspace */}
      <header className="defense-header">
        <div className="defense-header-inner">

          {/* Left: Back */}
          <div className="defense-header-side defense-header-left">
            <button
              onClick={() => setShowBackModal(true)}
              className="defense-back-btn"
            >
              <ArrowLeft size={18} />
              <span className="defense-back-text">Kembali</span>
            </button>

            <div className="defense-brand-separator"></div>

            <div className="defense-brand">
              RuangUji
            </div>
          </div>

          {/* Center: Title */}
          <div className="defense-header-title">
            <h1>Ruang Sidang</h1>
            <p>Pertanyaan {currentQ} dari {research.questionCount}</p>
          </div>

          {/* Right: Actions */}
          <div className="defense-header-side defense-header-right">
            <span className="badge defense-desktop-only" style={{ backgroundColor: '#fef3c7', color: '#b45309', textTransform: 'capitalize' }}>
              Mode: {research.examinerMode}
            </span>

            <span className="badge defense-desktop-only" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              Durasi: {research.sessionLength}
            </span>

            <select
              value={voiceProfile}
              onChange={(e) => {
                setVoiceProfile(e.target.value);
                localStorage.setItem('ruanguji_voice_profile', e.target.value);
              }}
              className="badge defense-desktop-only"
              style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer', textTransform: 'capitalize' }}
            >
              <option value="Tenang">Tenang</option>
              <option value="Formal">Formal</option>
              <option value="Hangat">Hangat</option>
              <option value="Tegas">Tegas</option>
              <option value="Cepat">Cepat</option>
            </select>

            <button
              onClick={() => {
                if (!isFinishingSession) setShowEndModal(true);
              }}
              disabled={isFinishingSession}
              className="btn btn-secondary defense-end-btn"
              style={{
                opacity: isFinishingSession ? 0.65 : 1,
                cursor: isFinishingSession ? 'wait' : 'pointer',
              }}
            >
              {isFinishingSession ? 'Menyimpan...' : 'Akhiri Sesi'}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Panel Switcher */}
      <div className="defense-mobile-tabs">
        <button
          onClick={() => { setShowLeftDrawer(prev => !prev); }}
          className={`defense-mobile-tab-btn ${showLeftDrawer ? 'active' : ''}`}
        >
          <Info size={14} />
          Info
        </button>

        <button
          onClick={() => { setShowRightDrawer(prev => !prev); }}
          className={`defense-mobile-tab-btn ${showRightDrawer ? 'active' : ''}`}
        >
          <FileText size={14} />
          Transkrip
        </button>
      </div>

      {/* Body Workspace 3 Panel */}
      <main className="defense-workspace-grid">

        {/* Panel 1: Info Penelitian */}
        <div
          className={`defense-panel-left defense-panel ${showLeftDrawer ? 'open' : ''}`}
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Informasi Latihan</p>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Detail Penelitian</h3>
            </div>
            {/* Close button for mobile */}
            <button onClick={() => setShowLeftDrawer(false)} className="mobile-drawer-toggles" style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <PanelLeftClose size={20} />
            </button>
          </div>

          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Judul Penelitian</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{research.title}</p>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Jenis Sidang</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{research.sessionType}</p>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Bidang / Topik</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{research.field || '-'}</p>
              </div>
              {research.keywords && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Kata Kunci / Fokus
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {research.keywords}
                    </p>
                  </div>
                </>
              )}

              <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Pendekatan Penelitian
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {research.researchApproach || '-'}
                </p>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Metode</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{research.method}</p>
              </div>

              {research.documentName && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Dokumen Diunggah
                    </p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {research.documentName}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.25rem', fontWeight: 600 }}>
                      Digunakan sebagai konteks AI
                    </p>
                  </div>
                </>
              )}

              {research.concern && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Concern (Kekhawatiran)</p>
                    <p style={{ fontSize: '0.875rem', color: '#ea580c' }}>{research.concern}</p>
                  </div>
                </>
              )}

              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Abstrak</p>
                <div className="custom-scrollbar" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '16px', maxHeight: '220px', overflowY: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
                  {research.abstract || 'Belum ada abstrak.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Obrolan / Voice Stage */}
        <div
          className="defense-panel-main defense-panel"
          style={{
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-soft)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>{isVoiceMode ? 'Voice Stage' : 'Panel Penguji'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={toggleVoice}
                style={{
                  background: 'none',
                  border: 'none',
                  color: voiceEnabled ? 'var(--primary-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  backgroundColor: voiceEnabled ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148, 163, 184, 0.08)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                title={voiceEnabled ? "Mute Suara AI" : "Unmute Suara AI"}
              >
                {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{voiceEnabled ? 'Suara AI Aktif' : 'Mute'}</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: orbState === 'idle' ? '#94a3b8' : 'var(--primary-blue)', animation: orbState !== 'idle' ? 'orbPulse 2s infinite' : 'none' }}></div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: orbState === 'idle' ? 'var(--text-secondary)' : 'var(--primary-blue)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {orbStateLabel}
                </p>
              </div>
            </div>
          </div>

          <div ref={middleScrollRef} className="custom-scrollbar defense-center-scroll" style={{ flex: 1, overflowY: 'auto', padding: isVoiceMode ? '0' : '24px', display: 'flex', flexDirection: 'column', alignItems: isVoiceMode ? 'center' : 'stretch', gap: isVoiceMode ? '0' : '20px', scrollBehavior: 'smooth' }}>

            {isVoiceMode ? (
              // VOICE STAGE UI
              <div className="fade-up voice-stage-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '16px' }}>

                {isGeneratingQuestion ? (
                  <div className="voice-question-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '14px 18px', borderRadius: '18px', width: '92%', maxWidth: '78%', textAlign: 'center', margin: '16px auto 0', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', borderTopColor: 'var(--primary-blue)', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Menyiapkan pertanyaan...</p>
                  </div>
                ) : isEvaluatingAnswer ? (
                  <div className="voice-question-card" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px 18px', borderRadius: '18px', width: '92%', maxWidth: '78%', textAlign: 'center', margin: '16px auto 0', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #bfdbfe', borderTopColor: '#1e3a8a', animation: 'spin 0.8s linear infinite' }}></div>
                    <p style={{ fontSize: '15px', color: '#1e3a8a' }}>Menganalisis jawaban...</p>
                  </div>
                ) : activeQuestion ? (
                  <div className="voice-question-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '14px 18px', borderRadius: '18px', width: '92%', maxWidth: '78%', textAlign: 'center', margin: '16px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Pertanyaan Aktif</p>
                    <p className="voice-question-text" style={expandedItems[activeQuestionItem?.id || ''] ? {
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap'
                    } : {
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      lineHeight: 1.55,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{activeQuestion}</p>
                    {activeQuestion.length > 130 && (
                      <button onClick={() => toggleItemExpand(activeQuestionItem?.id || '')} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '6px', padding: 0 }}>
                        {expandedItems[activeQuestionItem?.id || ''] ? 'Sembunyikan' : 'Lihat lengkap'}
                      </button>
                    )}
                  </div>
                ) : null}

                <div className="voice-blob-wrapper" style={{ margin: '48px 0 22px 0', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <VoiceOrb state={orbState} label="" />
                </div>

              </div>
            ) : (
              // TEXT/CHAT UI
              <>
                {session.transcript.map((item) => {
                  if (item.type === 'question') {
                    return (
                      <div key={item.id} className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '78%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Bot size={16} color="var(--text-muted)" />
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Penguji</p>
                          </div>
                          <p style={expandedItems[item.id] ? {
                            color: '#0f172a',
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            whiteSpace: 'pre-wrap'
                          } : {
                            color: '#0f172a',
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => toggleItemExpand(item.id)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>
                              {expandedItems[item.id] ? 'Sembunyikan' : 'Lihat lengkap'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (item.type === 'feedback') {
                    return (
                      <div key={item.id} className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '78%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Bot size={16} color="#15803d" />
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>Umpan Balik</p>
                            </div>
                            {item.score !== undefined && (
                              <span className="badge" style={{ backgroundColor: 'var(--white)', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: '#15803d', fontWeight: 700, border: '1px solid #bbf7d0' }}>Skor: {item.score}</span>
                            )}
                          </div>
                          <p style={expandedItems[item.id] ? {
                            color: '#166534',
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            whiteSpace: 'pre-wrap'
                          } : {
                            color: '#166534',
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => toggleItemExpand(item.id)} style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>
                              {expandedItems[item.id] ? 'Sembunyikan' : 'Lihat lengkap'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (item.type === 'answer') {
                    return (
                      <div key={item.id} className="fade-up" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ backgroundColor: '#2563eb', color: 'var(--white)', padding: '1rem 1.25rem', borderRadius: '20px 20px 4px 20px', maxWidth: '78%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8 }}>Anda</p>
                          </div>
                          <p style={expandedItems[item.id] ? {
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            whiteSpace: 'pre-wrap'
                          } : {
                            lineHeight: 1.6,
                            fontSize: '0.9375rem',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => toggleItemExpand(item.id)} style={{ background: 'none', border: 'none', color: '#bfdbfe', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>
                              {expandedItems[item.id] ? 'Sembunyikan' : 'Lihat lengkap'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {isGeneratingQuestion && (
                  <div className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '78%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', borderTopColor: 'var(--primary-blue)', animation: 'spin 0.8s linear infinite' }}></div>
                      <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>Menyiapkan pertanyaan...</p>
                    </div>
                  </div>
                )}

                {isEvaluatingAnswer && (
                  <div className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '78%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #bfdbfe', borderTopColor: '#1e3a8a', animation: 'spin 0.8s linear infinite' }}></div>
                      <p style={{ fontSize: '0.9375rem', color: '#1e3a8a' }}>Menganalisis jawaban...</p>
                    </div>
                  </div>
                )}

                {/* Next Question Button inside Chat flow */}
                {hasFeedback && !isVoiceMode && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', paddingBottom: '1rem' }}>
                    <button
                      className="btn btn-primary fade-up"
                      onClick={handleNextQuestion}
                      disabled={isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession}
                      style={{
                        padding: '0.875rem 2rem',
                        fontSize: '0.9375rem',
                        borderRadius: '999px',
                        boxShadow: '0 4px 14px 0 rgba(37,99,235,0.39)',
                        opacity: isFinishingSession ? 0.75 : 1,
                        cursor: isFinishingSession ? 'wait' : 'pointer',
                      }}
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

          {/* Action Bar / Input Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}>

            {isVoiceMode ? (
              // VOICE MODE CONTROLS
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => setIsVoiceMode(false)} disabled={isGeneratingQuestion || isEvaluatingAnswer} className="btn btn-secondary" style={{ padding: '0.625rem 1rem', borderRadius: '999px', fontSize: '0.875rem' }}>
                  Kembali ke Chat
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={toggleVoice} className="btn btn-secondary" style={{ padding: '0.625rem', borderRadius: '50%' }} title={voiceEnabled ? 'Matikan Suara AI' : 'Aktifkan Suara AI'}>
                    {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                </div>

                <div>
                  {hasFeedback ? (
                    <button
                      className="btn btn-primary fade-up"
                      onClick={handleNextQuestion}
                      disabled={isGeneratingQuestion || isEvaluatingAnswer || isFinishingSession}
                      style={{
                        padding: '0.625rem 1.5rem',
                        fontSize: '0.875rem',
                        borderRadius: '999px',
                        boxShadow: '0 4px 14px 0 rgba(37,99,235,0.39)',
                        opacity: isFinishingSession ? 0.75 : 1,
                        cursor: isFinishingSession ? 'wait' : 'pointer',
                      }}
                    >
                      {isFinishingSession
                        ? 'Menyusun...'
                        : currentQ >= research.questionCount
                          ? 'Selesai'
                          : 'Pertanyaan Berikutnya'}
                    </button>
                  ) : (
                    <VoiceAnswer
                      key={currentQuestionIndex}
                      onSubmit={handleAnswerSubmit}
                      disabled={orbState !== 'idle' && orbState !== 'listening'}
                      isThinking={orbState === 'thinking'}
                      autoMode={true}
                    />
                  )}
                </div>
              </div>
            ) : (
              // CHAT MODE INPUT
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', backgroundColor: 'var(--bg-soft)', padding: '0.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
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
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: 'none',
                    background: 'transparent',
                    padding: '0.5rem 1rem',
                    fontSize: '0.9375rem',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    maxHeight: '120px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAnswerSubmit(chatInput);
                    }
                  }}
                />

                <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.25rem', paddingRight: '0.5rem' }}>
                  {chatInput.trim() ? (
                    <button
                      onClick={() => handleAnswerSubmit(chatInput)}
                      disabled={hasFeedback || orbState === 'thinking' || isGeneratingQuestion || isEvaluatingAnswer}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)', color: 'var(--white)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
                    >
                      <Send size={16} style={{ marginLeft: '2px' }} />
                    </button>
                  ) : (
                    <button
                      onClick={toggleDictation}
                      disabled={hasFeedback || orbState === 'thinking' || isGeneratingQuestion || isEvaluatingAnswer}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isDictating ? '#ef4444' : 'var(--white)', color: isDictating ? 'var(--white)' : 'var(--text-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                      title="Speech to Text"
                    >
                      <Mic size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsVoiceMode(true)}
                    disabled={isGeneratingQuestion || isEvaluatingAnswer}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Masuk Voice Stage"
                  >
                    <Speech size={16} />
                  </button>
                  <button
                    onClick={toggleVoice}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: voiceEnabled ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148, 163, 184, 0.08)',
                      color: voiceEnabled ? 'var(--primary-blue)' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title={voiceEnabled ? 'Mute Suara AI' : 'Aktifkan Suara AI'}
                  >
                    {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Transkrip Sesi */}
        <div
          className={`defense-panel-right defense-panel ${showRightDrawer ? 'open' : ''}`}
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Transkrip Sesi</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Riwayat lengkap obrolan</p>
            </div>
            {/* Close button for mobile */}
            <button onClick={() => setShowRightDrawer(false)} className="mobile-drawer-toggles" style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <PanelRightClose size={20} />
            </button>
          </div>
          <SessionTranscript transcript={session.transcript} />
        </div>

      </main>

      {isFinishingSession && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Menyusun evaluasi akhir"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(15, 23, 42, 0.52)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            className="fade-up"
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: 'var(--white)',
              borderRadius: 28,
              padding: '1.5rem',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 30px 80px rgba(15, 23, 42, 0.28)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                margin: '0 auto 1rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#eff6ff',
                color: 'var(--primary-blue)',
                border: '1px solid #bfdbfe',
              }}
            >
              <Loader2 size={30} style={{ animation: 'spin 0.85s linear infinite' }} />
            </div>

            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              {finishingTitle}
            </h3>

            <p
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: '0 auto 1rem auto',
                maxWidth: 360,
              }}
            >
              {finishingMessage}
            </p>

            <div
              style={{
                padding: '0.8rem 1rem',
                borderRadius: 16,
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              }}
            >
              Jangan tutup halaman ini sampai proses selesai.
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .defense-header {
          height: 72px;
          flex-shrink: 0;
          background-color: var(--white);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 16px;
          z-index: 60;
          position: relative;
        }

        .defense-header-inner {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 1rem;
        }

        .defense-header-side {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .defense-header-left {
          justify-content: flex-start;
        }

        .defense-header-right {
          justify-content: flex-end;
        }

        .defense-back-btn {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.4rem 0.25rem;
          white-space: nowrap;
        }

        .defense-brand-separator {
          width: 1px;
          height: 24px;
          background-color: var(--border-color);
        }

        .defense-brand {
          font-weight: 800;
          color: var(--primary-blue);
          white-space: nowrap;
        }

        .defense-header-title {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-width: 120px;
        }

        .defense-header-title h1 {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 0.125rem 0;
          line-height: 1.1;
        }

        .defense-header-title p {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.2;
        }

        .defense-end-btn {
          background-color: #fee2e2 !important;
          color: #b91c1c !important;
          border-color: #fca5a5 !important;
          padding: 0.375rem 0.75rem !important;
          font-size: 0.875rem !important;
          white-space: nowrap;
        }

        .defense-mobile-tabs {
          display: none;
        }

        .defense-mobile-tab-btn.active {
          background-color: var(--primary-blue);
          color: var(--white);
        }

        .defense-workspace-grid {
          flex: 1;
          padding: 20px;
          overflow: hidden;
        }

        @media (max-width: 991px) {
          .defense-root {
            background-color: var(--white) !important;
          }

          .defense-header {
            height: 72px;
            padding: 0 10px;
          }

          .defense-header-inner {
            grid-template-columns: auto 1fr auto;
            gap: 0.5rem;
          }

          .defense-brand,
          .defense-brand-separator,
          .defense-back-text,
          .defense-desktop-only {
            display: none !important;
          }

          .defense-back-btn {
            width: 36px;
            height: 36px;
            justify-content: center;
            padding: 0;
            border-radius: 999px;
            color: var(--text-secondary);
          }

          .defense-header-title h1 {
            font-size: 0.95rem;
          }

          .defense-header-title p {
            font-size: 0.7rem;
          }

          .defense-end-btn {
            padding: 0.45rem 0.7rem !important;
            font-size: 0.78rem !important;
            border-radius: 0.65rem !important;
          }

          .defense-mobile-tabs {
            height: 44px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0 12px;
            background-color: var(--white);
            border-bottom: 1px solid var(--border-color);
            z-index: 50;
            position: relative;
          }

          .defense-mobile-tab-btn {
            border: none;
            background-color: var(--bg-soft);
            color: var(--text-secondary);
            border-radius: 999px;
            padding: 0.4rem 0.75rem;
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.03em;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            cursor: pointer;
          }

          .defense-workspace-grid {
            padding: 0 !important;
            flex: 1;
            overflow: hidden;
            display: block !important;
          }

          .defense-panel-main {
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }

          .defense-panel-main > div:first-child {
            border-radius: 0 !important;
          }

          .defense-panel {
            border-radius: 0 !important;
          }

          .defense-panel-left,
          .defense-panel-right {
            position: fixed !important;
            top: 116px !important;
            bottom: 0 !important;
            height: auto !important;
            width: min(86vw, 340px) !important;
            max-width: 340px !important;
            background-color: var(--white) !important;
            z-index: 55 !important;
            border-radius: 0 !important;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.22);
            transition: transform 0.25s ease;
          }

          .defense-panel-left {
            left: 0 !important;
            transform: translateX(-105%);
            border-left: none !important;
          }

          .defense-panel-right {
            right: 0 !important;
            transform: translateX(105%);
            border-right: none !important;
          }

          .defense-panel-left.open {
            transform: translateX(0);
          }

          .defense-panel-right.open {
            transform: translateX(0);
          }

          .mobile-overlay {
            position: fixed !important;
            top: 116px !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background-color: rgba(15, 23, 42, 0.38) !important;
            z-index: 54 !important;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            backdrop-filter: blur(4px);
          }

          .mobile-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }

          .defense-center-scroll {
            padding: 18px !important;
          }

          .defense-center-scroll > div {
            max-width: 100%;
          }

          .defense-panel-main [style*="padding: 16px 24px"] {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
        }

        @media (max-width: 520px) {
          .defense-header {
            height: 72px;
            padding: 0 8px;
          }

          .defense-header-title h1 {
            font-size: 0.9rem;
          }

          .defense-header-title p {
            font-size: 0.67rem;
          }

          .defense-end-btn {
            padding: 0.45rem 0.65rem !important;
            font-size: 0.74rem !important;
          }

          .defense-mobile-tabs {
            height: 42px;
            padding: 0 8px;
          }

          .defense-mobile-tab-btn {
            font-size: 0.68rem;
            padding: 0.38rem 0.65rem;
          }

          .defense-panel-left,
          .defense-panel-right {
            top: 114px !important;
            width: 86vw !important;
          }

          .mobile-overlay {
            top: 114px !important;
          }

          .defense-center-scroll {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

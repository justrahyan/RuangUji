import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Volume2, VolumeX, Bot, Mic, Send, Speech, PanelLeftClose, PanelRightClose, Info, FileText } from 'lucide-react';
import type { DefenseSession, TranscriptItem } from '../types';
import { getActiveSession, clearActiveSession, saveActiveSession, saveHistoryItem } from '../lib/storage';
import { generateQuestion, evaluateAnswer, generateFinalEvaluation } from '../lib/localEngine';
import { speakText, stopSpeaking } from '../lib/speech';

import VoiceOrb from '../components/VoiceOrb';
import SpokenPanel from '../components/SpokenPanel';
import VoiceAnswer from '../components/VoiceAnswer';
import ConfirmModal from '../components/ConfirmModal';
import SessionTranscript from '../components/SessionTranscript';
import TextDetailModal from '../components/TextDetailModal';

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
  const [spokenText, setSpokenText] = useState('');
  const [spokenMode, setSpokenMode] = useState<'question' | 'feedback' | 'listening'>('question');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('ruanguji_voice_muted') !== 'true');
  const [voiceProfile, setVoiceProfile] = useState(localStorage.getItem('ruanguji_voice_profile') || 'Formal');
  const [hasFeedback, setHasFeedback] = useState(false);
  
  const [chatInput, setChatInput] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const dictationRef = useRef<any>(null);

  const [showBackModal, setShowBackModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalContent, setDetailModalContent] = useState({ title: '', content: '' });

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
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'generating-question' | 'evaluating' | 'fallback' | 'error'>('idle');

  const questionRequestIdRef = useRef(0);
  const hasUserAnsweredRef = useRef(false);

  const openDetailModal = (title: string, content: string) => {
    setDetailModalContent({ title, content });
    setDetailModalOpen(true);
  };

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
    if (!newVal) stopSpeaking();
  };

  const handleReplay = () => {
    stopSpeaking();
    setOrbState('speaking');
    speakText(spokenText, () => setOrbState('speaking'), () => setOrbState('idle'));
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

    const previousQuestions = currentSession.transcript
      .filter(t => t.type === 'question')
      .map(t => t.content);

    const requestId = ++questionRequestIdRef.current;
    let qText = '';
    let category = 'umum';
    let source: 'ai' | 'local-fallback' = 'ai';
    let errorOccurred = false;
    
    try {
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research: currentSession.research,
          examinerMode: currentSession.research.examinerMode,
          questionIndex: currentSession.currentQuestionIndex,
          previousQuestions
        })
      });

      if (!res.ok) throw new Error('API fallback');
      const data = await res.json();
      qText = data.question;
      category = data.category || 'umum';
      if (data.provider === 'local-fallback') {
        source = 'local-fallback';
      }
    } catch (error) {
      console.warn('API unavailable, using local engine');
      qText = generateQuestion(
        currentSession.research, 
        currentSession.research.examinerMode, 
        currentSession.currentQuestionIndex,
        previousQuestions
      );
      category = 'fallback';
      source = 'local-fallback';
      errorOccurred = true;
    }
    
    // Check if this request is still the active one and user hasn't answered
    if (requestId !== questionRequestIdRef.current) return;
    if (hasUserAnsweredRef.current) return;
    
    const questionId = Date.now().toString();
    const newQuestion = {
      id: questionId,
      text: qText,
      category: category,
      source: source,
      locked: true
    };
    
    setCurrentQuestion(newQuestion);
    
    const qItem: TranscriptItem = {
      id: questionId,
      type: 'question',
      content: qText,
      questionId: questionId,
      questionText: qText,
      createdAt: new Date().toISOString()
    };
    
    const updated = addTranscript(qItem, currentSession);
    setSpokenText(qText);
    setIsGeneratingQuestion(false);
    setAiStatus(errorOccurred ? 'error' : source === 'local-fallback' ? 'fallback' : 'idle');
    
    setOrbState('speaking');
    if (voiceEnabled) {
      speakText(qText, () => setOrbState('speaking'), () => setOrbState('idle'));
    } else {
      setOrbState('idle');
    }
  };

  const handleAnswerSubmit = async (answerText: string) => {
    if (!session || !answerText.trim() || !currentQuestion) return;
    
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
    
    let evaluation;
    let errorOccurred = false;
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research: updatedSession.research,
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
      evaluation = evaluateAnswer(activeAnswerQuestionText, activeAnswerText, updatedSession.research, updatedSession.research.examinerMode);
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
    
    const feedbackText = `Skor: ${evaluation.score}.\n\nYang sudah kuat: ${evaluation.strengths.join(' ')}\n\nYang perlu diperbaiki: ${evaluation.weaknesses.join(' ')}\n\nSaran: ${evaluation.suggestion}`;
    
    const fbItem: TranscriptItem = {
      id: Date.now().toString(),
      type: 'feedback',
      content: feedbackText,
      questionId: activeAnswerQuestionId,
      questionText: activeAnswerQuestionText,
      answerText: activeAnswerText,
      feedback: feedbackText,
      score: evaluation.score,
      createdAt: new Date().toISOString()
    };
    
    addTranscript(fbItem, updatedSession);
    setSpokenText(feedbackText);
    setHasFeedback(true);
    setIsEvaluatingAnswer(false);
    setAiStatus(errorOccurred ? 'error' : 'idle');
    
    setOrbState('speaking');
    if (voiceEnabled) {
      speakText(feedbackText, () => setOrbState('speaking'), () => setOrbState('idle'));
    } else {
      setOrbState('idle');
    }
  };

  const handleNextQuestion = () => {
    if (!session) return;
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
    const latestSession = getActiveSession() || session;
    if (!latestSession) return;
    stopSpeaking();
    setOrbState('thinking');
    setSpokenMode('feedback');
    setSpokenText('Menyusun evaluasi akhir...');
    
    let finalEval;
    try {
      const res = await fetch('/api/ai/final-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research: latestSession.research,
          examinerMode: latestSession.research.examinerMode,
          transcript: latestSession.transcript
        })
      });
      if (!res.ok) throw new Error('fallback');
      finalEval = await res.json();
    } catch (e) {
      console.warn('Fallback final eval');
      finalEval = generateFinalEvaluation(latestSession);
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
        createdAt: new Date().toISOString()
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
    } else {
      clearActiveSession();
      navigate('/setup');
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
  const progressPercent = Math.min((currentQ / research.questionCount) * 100, 100);

  const orbStateLabel = isGeneratingQuestion ? 'Menyiapkan pertanyaan...' :
                        isEvaluatingAnswer ? 'Menganalisis jawaban...' :
                        orbState === 'idle' ? 'Siap menguji' :
                        orbState === 'speaking' ? 'Sedang berbicara...' :
                        orbState === 'listening' ? 'Mendengarkan...' : 'Menganalisis...';

  const activeQuestionItem = session.transcript.slice().reverse().find(t => t.type === 'question');
  const activeQuestion = activeQuestionItem ? activeQuestionItem.content : '';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
      
      {/* Mobile Drawer Overlay */}
      <div 
        className={`mobile-overlay ${showLeftDrawer || showRightDrawer ? 'open' : ''}`} 
        onClick={() => { setShowLeftDrawer(false); setShowRightDrawer(false); }}
      ></div>

      {/* Header Fullscreen Workspace */}
      <header style={{ height: '72px', flexShrink: 0, backgroundColor: 'var(--white)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 16px', zIndex: 10 }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setShowBackModal(true)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <ArrowLeft size={18} /> <span className="hidden-mobile">Kembali</span>
            </button>
            <div className="hidden-mobile" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--primary-blue)' }}>
              RuangUji
            </div>
          </div>

          {/* Mobile Toggles (Middle) */}
          <div className="mobile-drawer-toggles" style={{ alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setShowLeftDrawer(true)} className="badge" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Info size={12} /> Info
            </button>
            <button onClick={() => setShowRightDrawer(true)} className="badge" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <FileText size={12} /> Transkrip
            </button>
          </div>

          {/* Desktop Center Title */}
          <div className="hidden-mobile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.125rem' }}>Ruang Sidang</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pertanyaan {currentQ} dari {research.questionCount}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="badge hidden-mobile" style={{ backgroundColor: '#fef3c7', color: '#b45309', textTransform: 'capitalize' }}>
              Mode: {research.examinerMode}
            </span>
            <span className="badge hidden-mobile" style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              Durasi: {research.sessionLength}
            </span>
            <select 
              value={voiceProfile} 
              onChange={(e) => {
                setVoiceProfile(e.target.value);
                localStorage.setItem('ruanguji_voice_profile', e.target.value);
              }}
              className="badge hidden-mobile" 
              style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer' }}
            >
              <option value="Tenang">Tenang</option>
              <option value="Formal">Formal</option>
              <option value="Hangat">Hangat</option>
              <option value="Tegas">Tegas</option>
              <option value="Cepat">Cepat</option>
            </select>
            <button onClick={() => setShowEndModal(true)} className="btn btn-secondary" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
              Akhiri Sesi
            </button>
          </div>
          
        </div>
      </header>

      {/* Body Workspace 3 Panel */}
      <main style={{ flex: 1, padding: '20px', overflow: 'hidden' }} className="defense-workspace-grid">
        
        {/* Panel 1: Info Penelitian */}
        <div className={`defense-panel-left ${showLeftDrawer ? 'open' : ''}`} style={{ border: '1px solid var(--border-color)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>INFORMASI LATIHAN</p>
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
              <div style={{ height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Metode</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{research.method}</p>
              </div>
              
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
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Abtrak</p>
                <div className="custom-scrollbar" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '16px', maxHeight: '220px', overflowY: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
                  {research.abstract || 'Belum ada abstrak.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Obrolan / Voice Stage */}
        <div className="defense-panel-main" style={{ backgroundColor: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-soft)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>{isVoiceMode ? 'VOICE STAGE' : 'PANEL PENGUJI'}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: orbState === 'idle' ? '#94a3b8' : 'var(--primary-blue)', animation: orbState !== 'idle' ? 'orbPulse 2s infinite' : 'none' }}></div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: orbState === 'idle' ? 'var(--text-secondary)' : 'var(--primary-blue)' }}>{orbStateLabel}</p>
            </div>
          </div>

          <div ref={middleScrollRef} className="custom-scrollbar defense-center-scroll" style={{ flex: 1, overflowY: 'auto', padding: isVoiceMode ? '0' : '24px', display: 'flex', flexDirection: 'column', alignItems: isVoiceMode ? 'center' : 'stretch', gap: isVoiceMode ? '0' : '20px', scrollBehavior: 'smooth' }}>
            
            {isVoiceMode ? (
              // ================= VOICE STAGE UI =================
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
                    <p className="voice-question-text" style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.55, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{activeQuestion}</p>
                    {activeQuestion.length > 130 && (
                      <button onClick={() => openDetailModal('Pertanyaan Aktif', activeQuestion)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '6px', padding: 0 }}>Lihat lengkap</button>
                    )}
                  </div>
                ) : null}

                <div className="voice-blob-wrapper" style={{ margin: '48px 0 22px 0', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <VoiceOrb state={orbState} label="" />
                </div>

              </div>
            ) : (
              // ================= TEXT/CHAT UI =================
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
                          <p className="line-clamp-4" style={{ color: '#0f172a', lineHeight: 1.6, fontSize: '0.9375rem' }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => openDetailModal('Penguji', item.content)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>Lihat lengkap</button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (item.type === 'feedback') {
                    return (
                      <div key={item.id} className="fade-up" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', maxWidth: '78%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Bot size={16} color="#1e3a8a" />
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>Umpan Balik</p>
                            </div>
                            {item.score !== undefined && (
                              <span className="badge" style={{ backgroundColor: 'var(--white)', padding: '0.125rem 0.5rem', fontSize: '0.75rem', color: '#1e3a8a', fontWeight: 700 }}>Skor: {item.score}</span>
                            )}
                          </div>
                          <p className="line-clamp-4" style={{ color: '#1e3a8a', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '0.9375rem' }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => openDetailModal('Umpan Balik', item.content)} style={{ background: 'none', border: 'none', color: '#1e3a8a', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>Lihat lengkap</button>
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
                          <p className="line-clamp-4" style={{ lineHeight: 1.6, fontSize: '0.9375rem' }}>{item.content}</p>
                          {item.content.length > 200 && (
                            <button onClick={() => openDetailModal('Jawaban Anda', item.content)} style={{ background: 'none', border: 'none', color: '#bfdbfe', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', padding: 0 }}>Lihat lengkap</button>
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
                    <button className="btn btn-primary fade-up" onClick={handleNextQuestion} disabled={isGeneratingQuestion || isEvaluatingAnswer} style={{ padding: '0.875rem 2rem', fontSize: '0.9375rem', borderRadius: '999px', boxShadow: '0 4px 14px 0 rgba(37,99,235,0.39)' }}>
                      {currentQ >= research.questionCount ? 'Selesai & Lihat Evaluasi' : 'Lanjut ke Pertanyaan Berikutnya'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Bar / Input Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--white)' }}>
            
            {isVoiceMode ? (
              // ================= VOICE MODE CONTROLS =================
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => setIsVoiceMode(false)} className="btn btn-secondary" style={{ padding: '0.625rem 1rem', borderRadius: '999px', fontSize: '0.875rem' }}>
                  Kembali ke Chat
                </button>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={toggleVoice} className="btn btn-secondary" style={{ padding: '0.625rem', borderRadius: '50%' }} title={voiceEnabled ? 'Matikan Suara AI' : 'Aktifkan Suara AI'}>
                    {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                </div>

                <div>
                  {hasFeedback ? (
                    <button className="btn btn-primary fade-up" onClick={handleNextQuestion} disabled={isGeneratingQuestion || isEvaluatingAnswer} style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem', borderRadius: '999px', boxShadow: '0 4px 14px 0 rgba(37,99,235,0.39)' }}>
                      {currentQ >= research.questionCount ? 'Selesai' : 'Pertanyaan Berikutnya'}
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
              // ================= CHAT MODE INPUT =================
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
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Transkrip Sesi */}
        <div className={`defense-panel-right ${showRightDrawer ? 'open' : ''}`} style={{ border: '1px solid var(--border-color)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>TRANSKRIP SESI</p>
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
          executeFinishSession();
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
      `}</style>
    </div>
  );
}

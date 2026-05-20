import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Type } from 'lucide-react';

// Helper untuk membersihkan pengulangan aneh dari Speech API
function cleanVoiceTranscript(text: string): string {
  // 1. Normalize spasi
  let cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const words = cleaned.split(' ');
  const result: string[] = [];
  
  // Deteksi kata berulang > 2 kali berturut-turut
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    let repeatCount = 0;
    for (let j = result.length - 1; j >= 0; j--) {
      if (result[j].toLowerCase() === word) {
        repeatCount++;
        if (result.length - 1 - j !== repeatCount - 1) break; 
      } else {
        break;
      }
    }
    if (repeatCount < 2) {
      result.push(words[i]);
    }
  }
  
  let finalStr = result.join(' ');
  
  // Hapus kata filler berulang berlebihan (misal: "e", "em", "anu")
  finalStr = finalStr.replace(/\b(e|em|anu|kayak|terus|kayak)\b\s+\1\b/gi, '$1');
  
  // Deteksi pengulangan frasa sederhana (3-10 kata berulang)
  try {
    const phraseRegex = /\b((?:\S+\s+){2,8}\S+)\s+\1\b/gi;
    let match;
    let iterations = 0;
    while ((match = phraseRegex.exec(finalStr)) !== null && iterations < 5) {
      finalStr = finalStr.replace(match[0], match[1]);
      phraseRegex.lastIndex = 0; // reset regex
      iterations++;
    }
  } catch (e) {}

  // Batasi maksimal 700 karakter
  if (finalStr.length > 700) {
    const truncated = finalStr.substring(0, 700);
    // Coba potong di tanda baca terakhir yang utuh
    const lastPunctuation = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf(','), truncated.lastIndexOf('?'));
    if (lastPunctuation > 500) {
      finalStr = truncated.substring(0, lastPunctuation + 1) + '...';
    } else {
      finalStr = truncated + '...';
    }
  }

  return finalStr;
}

interface VoiceAnswerProps {
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  isThinking?: boolean;
  autoMode?: boolean;
}

export default function VoiceAnswer({ onSubmit, disabled, isThinking, autoMode }: VoiceAnswerProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [browserSupported, setBrowserSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<any>(null);
  
  // Guard untuk mencegah submit berkali-kali
  const isSubmittingRef = useRef(false);
  const lastSubmittedTextRef = useRef('');
  const isListeningRef = useRef(false);

  // Sync isListening to ref to avoid effect dependency re-runs
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupported(false);
      setManualMode(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      setInterimTranscript(interim);
      
      if (finalStr) {
        setFinalTranscript(prev => {
          const combined = prev + ' ' + finalStr;
          return cleanVoiceTranscript(combined);
        });
      }
      
      // Silence detection logic: ~2200ms after last result
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      
      if (!interim) {
        silenceTimeoutRef.current = setTimeout(() => {
          triggerSubmit();
        }, 2200);
      } else {
        silenceTimeoutRef.current = setTimeout(() => {
          triggerSubmit();
        }, 3000);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error', event.error);
      }
      if (event.error === 'not-allowed' || event.error === 'network') {
        setTimeout(() => {
          setIsListening(false);
        }, 0);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && !isSubmittingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          setTimeout(() => {
            setIsListening(false);
          }, 0);
        }
      } else {
        setTimeout(() => {
          setIsListening(false);
        }, 0);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  const triggerSubmit = () => {
    setFinalTranscript(currentFinal => {
      const cleaned = cleanVoiceTranscript(currentFinal);
      
      // Jika kosong atau kurang dari 12 karakter, abaikan (mungkin noise)
      if (cleaned.length < 12) return currentFinal;
      
      // Cek dedupe submit
      if (cleaned === lastSubmittedTextRef.current) return currentFinal;
      if (isSubmittingRef.current) return currentFinal;

      isSubmittingRef.current = true;
      lastSubmittedTextRef.current = cleaned;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      
      setTimeout(() => {
        setIsListening(false);
      }, 0);
      setInterimTranscript('');
      onSubmit(cleaned);
      
      return ''; // reset
    });
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      
      if (finalTranscript.trim()) {
        triggerSubmit();
      }
    } else {
      setFinalTranscript('');
      setInterimTranscript('');
      isSubmittingRef.current = false;
      lastSubmittedTextRef.current = '';
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleManualSubmit = () => {
    if (manualText.trim()) {
      onSubmit(manualText.trim());
      setManualText('');
    }
  };

  if (manualMode || !autoMode) {
    if (manualMode) {
      return (
        <div className="card fade-up soft-shadow" style={{ padding: '1rem', width: '100%', margin: '0 auto' }}>
          <textarea 
            className="textarea custom-scrollbar" 
            rows={3} 
            placeholder="Ketik jawaban Anda di sini..." 
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            disabled={disabled || isThinking}
            style={{ marginBottom: '1rem', resize: 'none' }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {browserSupported && (
              <button className="btn btn-secondary" onClick={() => setManualMode(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                <Mic size={14} /> Kembali ke Suara
              </button>
            )}
            {!browserSupported && <div></div>}
            <button className="btn btn-primary" onClick={handleManualSubmit} disabled={disabled || isThinking || !manualText.trim()} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              Kirim Jawaban
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        {isListening && (
          <div className="fade-up" style={{ backgroundColor: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'orbPulse 1s infinite' }}></div>
            Mendengarkan...
          </div>
        )}
        {isListening && (interimTranscript || finalTranscript) && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            "{interimTranscript || finalTranscript}"
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isListening ? (
            <button className="btn" onClick={toggleListening} style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '999px' }}>
              <Square size={16} fill="currentColor" /> Selesai
            </button>
          ) : (
            <button className="btn btn-primary" onClick={toggleListening} disabled={disabled || isThinking} style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem', borderRadius: '999px' }}>
              <Mic size={16} /> Mulai Menjawab
            </button>
          )}
        </div>
        {!isListening && (
          <button onClick={() => setManualMode(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}>
            <Type size={12} /> Mode Teks
          </button>
        )}
      </div>
    );
  }

  // Voice Stage mode
  let statusText = "Siap menguji";
  if (isThinking) statusText = "Menganalisis jawaban...";
  else if (isListening) {
    if (interimTranscript || finalTranscript) statusText = "Menunggu hening...";
    else statusText = "Sedang mendengarkan...";
  }
  else if (disabled) statusText = "Penguji sedang merespons...";

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      {isListening ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div className="fade-up" style={{ backgroundColor: 'var(--white)', padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'orbPulse 1s infinite' }}></div>
            {statusText}
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={toggleListening} disabled={disabled || isThinking} style={{ padding: '0.75rem 2rem', fontSize: '1rem', borderRadius: '999px', boxShadow: '0 4px 14px 0 rgba(37,99,235,0.39)', transition: 'all 0.3s' }}>
          <Mic size={18} /> Mulai Berbicara
        </button>
      )}

      {!isListening && (
        <button onClick={() => setManualMode(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}>
          <Type size={12} /> Gunakan Teks
        </button>
      )}
    </div>
  );
}

let currentFullText = '';
let currentEndCallback: (() => void) | undefined;
let currentStartCallback: (() => void) | undefined;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let isStoppingIntentionally = false;
let isPausedByMute = false;

function normalizeForSpeech(text: string): string {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[_`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\b0\.(\d+)\b/g, (_match, dec) => `nol koma ${String(dec).split('').join(' ')}`)
    .replace(/\b(\d+)\.(\d+)\b/g, (_match, left, right) => `${left} koma ${String(right).split('').join(' ')}`)
    .replace(/\s+/g, ' ')
    .trim();
}

function pickVoice(utterance: SpeechSynthesisUtterance) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  const scored = voices
    .map((voice) => {
      const name = voice.name.toLowerCase();
      const lang = voice.lang.toLowerCase();

      let score = 0;
      if (lang.includes('id')) score += 10;
      if (name.includes('indonesia') || name.includes('indonesian')) score += 8;
      if (name.includes('google')) score += 2;
      if (name.includes('microsoft')) score += 2;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  utterance.voice = scored[0]?.voice || voices[0];
}

function applyVoiceProfile(utterance: SpeechSynthesisUtterance) {
  const profile = localStorage.getItem('ruanguji_voice_profile') || 'Formal';

  if (profile === 'Tenang') {
    utterance.rate = 0.86;
    utterance.pitch = 1.04;
  } else if (profile === 'Hangat') {
    utterance.rate = 0.9;
    utterance.pitch = 1.08;
  } else if (profile === 'Tegas') {
    utterance.rate = 0.98;
    utterance.pitch = 0.96;
  } else if (profile === 'Cepat') {
    utterance.rate = 1.12;
    utterance.pitch = 1.0;
  } else {
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
  }
}

function createUtterance(text: string) {
  const utterance = new SpeechSynthesisUtterance(normalizeForSpeech(text));
  utterance.lang = 'id-ID';
  utterance.volume = 0.95;

  applyVoiceProfile(utterance);
  pickVoice(utterance);

  utterance.onstart = () => {
    if (currentStartCallback) currentStartCallback();

    const muted = localStorage.getItem('ruanguji_voice_muted') === 'true';
    if (muted) {
      isPausedByMute = true;

      window.setTimeout(() => {
        if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
        }
      }, 0);
    }
  };

  utterance.onend = () => {
    if (isStoppingIntentionally) return;

    activeUtterance = null;
    currentFullText = '';
    isPausedByMute = false;

    if (currentEndCallback) currentEndCallback();
  };

  utterance.onerror = () => {
    if (isStoppingIntentionally) return;

    activeUtterance = null;
    currentFullText = '';
    isPausedByMute = false;

    if (currentEndCallback) currentEndCallback();
  };

  return utterance;
}

export function speakText(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;

  stopSpeaking();

  currentFullText = String(text || '').trim();
  currentStartCallback = onStart;
  currentEndCallback = onEnd;

  if (!currentFullText) return;

  isStoppingIntentionally = false;
  isPausedByMute = false;

  const utterance = createUtterance(currentFullText);
  activeUtterance = utterance;

  window.speechSynthesis.speak(utterance);
}

export function handleMuteToggle() {
  if (!('speechSynthesis' in window)) return;

  const muted = localStorage.getItem('ruanguji_voice_muted') === 'true';

  if (muted) {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      isPausedByMute = true;
      window.speechSynthesis.pause();
    }

    return;
  }

  if (window.speechSynthesis.paused || isPausedByMute) {
    isPausedByMute = false;
    window.speechSynthesis.resume();
  }
}

export function stopSpeaking() {
  currentFullText = '';
  activeUtterance = null;
  currentEndCallback = undefined;
  currentStartCallback = undefined;
  isPausedByMute = false;

  if ('speechSynthesis' in window) {
    isStoppingIntentionally = true;
    window.speechSynthesis.cancel();

    window.setTimeout(() => {
      isStoppingIntentionally = false;
    }, 0);
  }
}

export function isSpeaking() {
  if (!('speechSynthesis' in window)) return false;
  return Boolean(activeUtterance || window.speechSynthesis.speaking || window.speechSynthesis.paused);
}
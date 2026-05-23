let currentFullText = '';
let currentEndCallback: (() => void) | undefined;
let currentStartCallback: (() => void) | undefined;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let isStoppingIntentionally = false;

export function isVoiceMuted() {
  return localStorage.getItem('ruanguji_voice_muted') === 'true';
}

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

      if (lang === 'id-id') score += 100;
      else if (lang.startsWith('id')) score += 80;

      if (name.includes('indonesia')) score += 60;
      if (name.includes('indonesian')) score += 60;
      if (name.includes('bahasa')) score += 35;

      if (name.includes('google')) score += 8;
      if (name.includes('microsoft')) score += 8;

      if (lang.startsWith('en')) score -= 40;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  utterance.voice = scored[0]?.voice || voices[0];
}

function applyVoiceProfile(utterance: SpeechSynthesisUtterance) {
  const profile = localStorage.getItem('ruanguji_voice_profile') || 'Formal';

  if (profile === 'Tenang') {
    utterance.rate = 0.78;
    utterance.pitch = 0.98;
  } else if (profile === 'Hangat') {
    utterance.rate = 0.88;
    utterance.pitch = 1.12;
  } else if (profile === 'Tegas') {
    utterance.rate = 0.98;
    utterance.pitch = 0.86;
  } else if (profile === 'Cepat') {
    utterance.rate = 1.22;
    utterance.pitch = 1.0;
  } else {
    utterance.rate = 0.9;
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
  };

  utterance.onend = () => {
    if (isStoppingIntentionally) return;

    activeUtterance = null;
    currentFullText = '';

    if (currentEndCallback) currentEndCallback();
  };

  utterance.onerror = () => {
    if (isStoppingIntentionally) return;

    activeUtterance = null;
    currentFullText = '';

    if (currentEndCallback) currentEndCallback();
  };

  return utterance;
}

export function speakText(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  stopSpeaking();

  currentFullText = String(text || '').trim();
  currentStartCallback = onStart;
  currentEndCallback = onEnd;

  if (!currentFullText) {
    onEnd?.();
    return;
  }

  if (isVoiceMuted()) {
    activeUtterance = null;
    currentFullText = '';
    currentStartCallback = undefined;
    currentEndCallback = undefined;
    onEnd?.();
    return;
  }

  isStoppingIntentionally = false;

  const utterance = createUtterance(currentFullText);
  activeUtterance = utterance;

  window.speechSynthesis.speak(utterance);
}

export function handleMuteToggle() {
  if (!('speechSynthesis' in window)) return;

  const muted = isVoiceMuted();

  if (muted) {
    stopSpeaking();
  }
}

export function stopSpeaking() {
  currentFullText = '';
  activeUtterance = null;
  currentEndCallback = undefined;
  currentStartCallback = undefined;

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
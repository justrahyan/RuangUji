export function speakText(text: string, onStart?: () => void, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;

  const isMuted = localStorage.getItem('ruanguji_voice_muted') === 'true';
  if (isMuted) {
    if (onStart) onStart();
    if (onEnd) setTimeout(onEnd, 100);
    return;
  }

  window.speechSynthesis.cancel(); // Stop anything playing

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'id-ID';
  
  const profile = localStorage.getItem('ruanguji_voice_profile') || 'Formal';
  
  if (profile === 'Tenang') {
    utterance.rate = 0.85; utterance.pitch = 1.05; utterance.volume = 0.9;
  } else if (profile === 'Hangat') {
    utterance.rate = 0.9; utterance.pitch = 1.15; utterance.volume = 0.9;
  } else if (profile === 'Tegas') {
    utterance.rate = 1.0; utterance.pitch = 0.9; utterance.volume = 0.95;
  } else if (profile === 'Cepat') {
    utterance.rate = 1.12; utterance.pitch = 1.0; utterance.volume = 0.9;
  } else {
    // Formal default
    utterance.rate = 0.95; utterance.pitch = 0.95; utterance.volume = 0.9;
  }

  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find(v => v.lang.includes('id'));
  if (idVoice) utterance.voice = idVoice;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

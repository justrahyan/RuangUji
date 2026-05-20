import { Bot, Mic, Loader2 } from 'lucide-react';

interface VoiceOrbProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
  label?: string;
}

export default function VoiceOrb({ state, label }: VoiceOrbProps) {
  let orbClass = '';
  let icon = <Bot size={40} color="var(--primary-blue)" />;
  let defaultLabel = 'Siap menguji';

  if (state === 'speaking') {
    orbClass = 'orb-speaking';
    defaultLabel = 'Penguji sedang bertanya';
  } else if (state === 'listening') {
    orbClass = 'orb-listening';
    icon = <Mic size={40} color="var(--primary-blue)" />;
    defaultLabel = 'Saya mendengarkan jawaban Anda';
  } else if (state === 'thinking') {
    orbClass = 'orb-thinking';
    icon = <Loader2 size={40} color="var(--primary-blue)" className="animate-spin" />;
    defaultLabel = 'Menganalisis jawaban...';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', margin: '2rem 0' }}>
      
      <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="orb-container">
        {/* Layer 1 - Outer soft glow */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-blue)',
          opacity: state === 'speaking' ? 0.2 : state === 'listening' ? 0.15 : state === 'thinking' ? 0.1 : 0.05,
          filter: 'blur(8px)',
          transform: state === 'speaking' ? 'scale(1.4)' : state === 'listening' ? 'scale(1.2)' : 'scale(1)',
          transition: 'all 0.5s ease-in-out',
          animation: state === 'speaking' ? 'orbPulse 1.5s infinite alternate ease-in-out' : 'none'
        }}></div>

        {/* Layer 2 - Middle shape */}
        <div style={{
          position: 'absolute',
          width: '80%',
          height: '80%',
          borderRadius: state === 'listening' ? '40% 60% 60% 40% / 50% 50% 50% 50%' : '50%',
          backgroundColor: 'var(--blue-soft)',
          opacity: 0.8,
          transition: 'all 0.4s ease-in-out',
          animation: state === 'listening' ? 'orbListen 2s infinite linear' : 'none',
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.1)'
        }}></div>

        {/* Layer 3 - Core */}
        <div 
          className={orbClass}
          style={{ 
            position: 'absolute',
            width: '60%', 
            height: '60%', 
            backgroundColor: 'var(--white)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            border: '2px solid var(--blue-border)',
            zIndex: 2
          }}
        >
          {icon}
        </div>
      </div>

      {label !== "" && (
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label || defaultLabel}
        </p>
      )}

      <style>{`
        @media (max-width: 768px) {
          .orb-container { 
            width: 88px !important; 
            height: 88px !important; 
          }
        }
      `}</style>
    </div>
  );
}

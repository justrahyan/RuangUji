import { useState, useEffect } from 'react';

interface SpokenPanelProps {
  title?: string;
  text: string;
  mode?: 'question' | 'feedback' | 'listening' | 'speaking';
  compact?: boolean;
}

export default function SpokenPanel({ text }: SpokenPanelProps) {
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);

  // Pecah text menjadi beberapa baris/kalimat
  const lines = text.split('\n').filter(l => l.trim() !== '');
  let displayLines: string[] = [];
  if (lines.length > 1) {
    displayLines = lines;
  } else {
    displayLines = text.match(/[^.!?]+[.!?]+/g) || [text];
  }

  // Interval untuk memindahkan baris lirik aktif
  useEffect(() => {
    if (!displayLines.length) return;

    setActiveLyricIndex(0);

    const interval = window.setInterval(() => {
      setActiveLyricIndex((prev) => {
        if (prev >= displayLines.length - 1) return prev;
        return prev + 1;
      });
    }, 2500); // pindah setiap 2500ms

    return () => window.clearInterval(interval);
  }, [text, displayLines.length]);

  return (
    <div className="voice-feedback-lyrics fade-up">
      <div className="voice-lyric-container">
        {displayLines.map((line, index) => {
          let className = 'voice-lyric-line hidden';
          
          if (index === activeLyricIndex) {
            className = 'voice-lyric-line active';
          } else if (index === activeLyricIndex - 1) {
            className = 'voice-lyric-line near-top';
          } else if (index === activeLyricIndex + 1) {
            className = 'voice-lyric-line near-bottom';
          } else if (index === activeLyricIndex - 2) {
            className = 'voice-lyric-line dim-top';
          } else if (index === activeLyricIndex + 2) {
            className = 'voice-lyric-line dim-bottom';
          }

          return (
            <p
              key={`${text}-${index}`}
              className={className}
            >
              {line.trim()}
            </p>
          );
        })}
      </div>
    </div>
  );
}

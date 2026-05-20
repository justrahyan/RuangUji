import { useEffect, useRef, useState } from 'react';
import type { TranscriptItem } from '../types';
import TextDetailModal from './TextDetailModal';

interface SessionTranscriptProps {
  transcript: TranscriptItem[];
}

export default function SessionTranscript({ transcript }: SessionTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);
  
  const openDetail = (title: string, content: string) => {
    setModalContent({ title, content });
    setModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
          {transcript.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Transkrip akan muncul setelah sesi dimulai.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transcript.map((item) => {
                if (item.type === 'question') {
                  return (
                    <div key={`mini-${item.id}`} style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 800, marginBottom: '0.375rem', color: 'var(--text-muted)' }}>PENGUJI</p>
                      <p className="line-clamp-4" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{item.content}</p>
                      {item.content.length > 120 && (
                        <button onClick={() => openDetail('Penguji', item.content)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem' }}>Lihat lengkap</button>
                      )}
                    </div>
                  );
                }
                if (item.type === 'answer') {
                  return (
                    <div key={`mini-${item.id}`} style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: 'var(--blue-soft)', border: '1px solid var(--blue-border)' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: 800, marginBottom: '0.375rem', color: 'var(--primary-blue)' }}>ANDA</p>
                      <p className="line-clamp-4" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{item.content}</p>
                      {item.content.length > 120 && (
                        <button onClick={() => openDetail('Jawaban Anda', item.content)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem' }}>Lihat lengkap</button>
                      )}
                    </div>
                  );
                }
                if (item.type === 'feedback') {
                  return (
                    <div key={`mini-${item.id}`} style={{ padding: '0.875rem', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803d' }}>UMPAN BALIK</p>
                        {item.score !== undefined && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803d', backgroundColor: 'var(--white)', padding: '0.125rem 0.375rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>Skor: {item.score}</span>
                        )}
                      </div>
                      <p className="line-clamp-4" style={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.content}</p>
                      {item.content.length > 120 && (
                        <button onClick={() => openDetail('Umpan Balik', item.content)} style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.25rem' }}>Lihat lengkap</button>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
      </div>
      
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--white)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status Sesi</p>
          <span className="badge" style={{ backgroundColor: 'var(--blue-soft)', color: 'var(--primary-blue)' }}>Aktif</span>
        </div>
      </div>

      <TextDetailModal 
        open={modalOpen} 
        title={modalContent.title} 
        content={modalContent.content} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}

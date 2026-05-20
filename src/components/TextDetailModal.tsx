import { X } from 'lucide-react';

interface TextDetailModalProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export default function TextDetailModal({ open, title, content, onClose }: TextDetailModalProps) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)' }} 
        onClick={onClose}
      ></div>
      <div 
        className="card fade-up" 
        style={{ 
          position: 'relative', 
          backgroundColor: 'var(--white)', 
          borderRadius: '24px', 
          width: '90%', 
          maxWidth: '600px', 
          maxHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        <div className="custom-scrollbar" style={{ padding: '24px', overflowY: 'auto', flex: 1, fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1.5rem' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

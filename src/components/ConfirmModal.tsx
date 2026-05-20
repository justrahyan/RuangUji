import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle size={24} color="#dc2626" />;
      case 'warning':
        return <AlertTriangle size={24} color="#d97706" />;
      default:
        return <HelpCircle size={24} color="var(--primary-blue)" />;
    }
  };

  const getConfirmBtnStyle = () => {
    switch (type) {
      case 'danger':
        return {
          backgroundColor: '#dc2626',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
        };
      case 'warning':
        return {
          backgroundColor: '#d97706',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)'
        };
      default:
        return {
          backgroundColor: 'var(--primary-blue)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
        };
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1.5rem',
      animation: 'fadeIn 200ms ease-out'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '440px',
        padding: '2rem',
        border: '1px solid var(--border-color)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        animation: 'slideUp 250ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{
            padding: '0.75rem',
            backgroundColor: type === 'danger' ? '#fef2f2' : type === 'warning' ? '#fffbeb' : 'var(--blue-soft)',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {getIcon()}
          </div>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.375rem 0', lineHeight: 1.3 }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn"
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              ...getConfirmBtnStyle()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

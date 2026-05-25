import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeMap[size]} glass-strong rounded-2xl p-6 shadow-panel-lg animate-fade-in max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title">{title}</h2>
            <button onClick={onClose} className="icon-btn w-8 h-8">
              <X size={15} />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} className="absolute top-4 right-4 icon-btn w-8 h-8">
            <X size={15} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

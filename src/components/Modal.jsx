import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} max-h-[90vh] bg-wb-card border border-wb-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-slide-up`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-wb-border shrink-0">
          <h2 className="text-base font-semibold text-wb-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-wb-muted hover:text-wb-white hover:bg-wb-border transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

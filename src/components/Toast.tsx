import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { ToastType } from '../context/ToastContext';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-success" />,
  error: <XCircle size={16} className="text-danger" />,
  warning: <AlertTriangle size={16} className="text-gold" />,
  info: <Info size={16} className="text-electric" />,
};

const borders: Record<ToastType, string> = {
  success: 'border-success/30',
  error: 'border-danger/30',
  warning: 'border-gold/30',
  info: 'border-electric/30',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-xs px-4 py-3 rounded-xl glass border ${borders[t.type]} shadow-panel-lg animate-slide-up`}
        >
          <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
          <p className="text-sm text-paper flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-mist hover:text-paper transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

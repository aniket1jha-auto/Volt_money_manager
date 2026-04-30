import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'info' | 'success' | 'warning' | 'danger';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push: ToastContextValue['push'] = useCallback((t) => {
    const id = Date.now() + Math.random();
    const durationMs = t.durationMs ?? 4000;
    setToasts((cur) => [...cur, { ...t, id, durationMs }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((x) => x.id !== id));
    }, durationMs);
  }, []);

  const value: ToastContextValue = {
    push,
    success: (title, description) => push({ tone: 'success', title, description }),
    error: (title, description) => push({ tone: 'danger', title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <ToastCard
              key={t.id}
              toast={t}
              onClose={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
            />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

const TONE_STYLE: Record<ToastTone, { bg: string; ring: string; icon: ReactNode }> = {
  info:    { bg: 'bg-surface',  ring: 'ring-blue-500/30',    icon: <Info size={18} className="text-blue-600" /> },
  success: { bg: 'bg-surface',  ring: 'ring-success-500/30', icon: <CheckCircle2 size={18} className="text-success-700" /> },
  warning: { bg: 'bg-surface',  ring: 'ring-warning-500/30', icon: <AlertTriangle size={18} className="text-warning-700" /> },
  danger:  { bg: 'bg-surface',  ring: 'ring-danger-500/30',  icon: <XCircle size={18} className="text-danger-700" /> },
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const style = TONE_STYLE[toast.tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm rounded-lg shadow-xl border border-border-subtle',
        'px-4 py-3 ring-1',
        style.bg,
        style.ring,
        'animate-[toast-in_180ms_ease-out]',
      )}
      role="status"
    >
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{toast.title}</div>
        {toast.description && (
          <div className="text-xs text-text-tertiary mt-0.5">{toast.description}</div>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 p-0.5 rounded text-text-tertiary hover:bg-slate-100 transition-colors"
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes toast-in {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

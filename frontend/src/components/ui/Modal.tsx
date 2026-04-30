import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** disable close on backdrop click — keeps user on confirmation modal */
  dismissable?: boolean;
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        className={cn(
          'relative bg-surface rounded-xl shadow-xl border border-border-subtle w-full overflow-hidden',
          sizeMap[size],
          'animate-[fade-in_140ms_ease-out]',
        )}
        style={{
          animation: 'modal-pop 180ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {(title || dismissable) && (
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0">
              {title && <h3 className="text-lg font-semibold text-text-primary">{title}</h3>}
              {description && <p className="text-sm text-text-tertiary mt-1">{description}</p>}
            </div>
            {dismissable && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-text-tertiary hover:text-text-primary p-1 -mr-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}
        {children && <div className="px-6 pb-5 text-sm text-text-secondary">{children}</div>}
        {footer && (
          <footer className="border-t border-border-subtle bg-slate-25 px-6 py-3 flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
      <style>{`
        @keyframes modal-pop {
          0%   { opacity: 0; transform: translateY(8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

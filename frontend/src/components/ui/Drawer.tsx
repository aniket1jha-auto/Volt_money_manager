import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Width in px when open. Defaults to 600. */
  width?: number;
  children?: ReactNode;
  className?: string;
}

export function Drawer({ open, onClose, width = 600, children, className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed top-0 right-0 z-50 h-full bg-surface shadow-xl border-l border-border-subtle',
          'transition-transform duration-220 ease-out',
          'flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
          className,
        )}
        style={{ width: `min(${width}px, 100%)` }}
      >
        {children}
      </aside>
    </>,
    document.body,
  );
}

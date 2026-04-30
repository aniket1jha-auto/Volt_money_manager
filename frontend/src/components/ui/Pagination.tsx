import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationProps {
  page: number;       // 1-based
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, onChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = pageNumbers(page, totalPages);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      <p className="text-xs text-text-tertiary tabular">
        Showing <span className="font-semibold text-text-primary">{start.toLocaleString('en-IN')}</span>
        {'–'}
        <span className="font-semibold text-text-primary">{end.toLocaleString('en-IN')}</span>
        {' of '}
        <span className="font-semibold text-text-primary">{total.toLocaleString('en-IN')}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <PageButton
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </PageButton>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-2 text-text-tertiary text-sm">
              …
            </span>
          ) : (
            <PageButton
              key={p}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
              active={p === page}
            >
              {p}
            </PageButton>
          ),
        )}
        <PageButton
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({
  children,
  active,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'min-w-8 h-8 px-2 inline-flex items-center justify-center rounded text-sm font-medium tabular',
        'transition-colors',
        active
          ? 'bg-brand-500 text-white'
          : 'text-text-secondary hover:bg-slate-100',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (current > 3) out.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    out.push(p);
  }
  if (current < total - 2) out.push('…');
  out.push(total);
  return out;
}

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';
type Size = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  dot?: boolean;
  children: ReactNode;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand:   'bg-brand-50 text-brand-700 border-brand-100',
  info:    'bg-blue-50 text-blue-700 border-blue-100',
  success: 'bg-success-50 text-success-700 border-success-500/20',
  warning: 'bg-warning-50 text-warning-700 border-warning-500/20',
  danger:  'bg-danger-50 text-danger-700 border-danger-500/20',
};

const dotColors: Record<Tone, string> = {
  neutral: 'bg-slate-500',
  brand:   'bg-brand-500',
  info:    'bg-blue-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger:  'bg-danger-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-5 px-1.5 text-[11px]',
  md: 'h-6 px-2 text-xs',
};

export function Badge({ tone = 'neutral', size = 'sm', dot, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} />}
      {children}
    </span>
  );
}

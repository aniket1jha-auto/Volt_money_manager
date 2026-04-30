import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, padding = 'md', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border border-border-subtle rounded-lg shadow-card',
        paddings[padding],
        interactive &&
          'transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg cursor-pointer',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-text-primary', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-text-tertiary', className)} {...props} />;
}

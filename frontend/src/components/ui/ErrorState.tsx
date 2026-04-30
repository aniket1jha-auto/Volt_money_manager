import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '@/lib/cn';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Render the error inside a Card. Defaults to true. */
  card?: boolean;
  /** Compact inline variant — just a message + retry, no border. */
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this data. Please try again.",
  onRetry,
  card = true,
  compact = false,
  className,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'inline-flex items-center gap-2 text-sm text-danger-700',
          className,
        )}
      >
        <AlertTriangle size={14} />
        <span>{title}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-blue-600 hover:text-blue-700 font-medium underline-offset-4 hover:underline ml-1"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const inner = (
    <div
      role="alert"
      className="flex flex-col items-center text-center py-10 px-4"
    >
      <div className="h-12 w-12 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center mb-4">
        <AlertTriangle size={20} />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-tertiary max-w-md mb-5">{description}</p>
      {onRetry && (
        <Button leftIcon={<RefreshCw size={14} />} variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );

  if (!card) return <div className={className}>{inner}</div>;
  return (
    <Card padding="lg" className={className}>
      {inner}
    </Card>
  );
}

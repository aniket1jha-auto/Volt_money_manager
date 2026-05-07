import { useId } from 'react';
import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  withWordmark?: boolean;
  /** Wordmark text. Defaults to "Commerce". */
  wordmark?: string;
  intro?: boolean;
  breathing?: boolean;
  wordmarkColor?: 'light' | 'dark';
  className?: string;
}

const sizeMap = {
  sm:    { mark: 'h-7 w-7',    word: 'text-sm' },
  md:    { mark: 'h-9 w-9',    word: 'text-base' },
  lg:    { mark: 'h-12 w-12',  word: 'text-lg' },
  xl:    { mark: 'h-16 w-16',  word: 'text-xl' },
  '2xl': { mark: 'h-24 w-24',  word: 'text-2xl' },
  hero:  { mark: 'h-44 w-44',  word: 'text-3xl' },
};

export function Logo({
  size = 'md',
  withWordmark = true,
  wordmark = 'Commerce',
  intro = false,
  breathing = false,
  wordmarkColor = 'dark',
  className,
}: LogoProps) {
  const s = sizeMap[size];
  const clipId = useId();
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-[22%] transition-shadow',
          s.mark,
          intro && 'pi-intro',
          breathing && 'pi-breathe',
        )}
        aria-label="Pi"
      >
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <defs>
            <clipPath id={clipId}>
              <rect width="100" height="100" rx="22" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect width="100" height="42" fill="#00BAF2" />
            <rect y="42" width="100" height="58" fill="#002970" />
          </g>
          <text
            x="50"
            y="52"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="50"
            fontWeight="800"
            fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
            fill="white"
            letterSpacing="-1.5"
          >
            Pi
          </text>
        </svg>
      </div>
      {withWordmark && (
        <span
          className={cn(
            'font-semibold tracking-[0.04em] leading-none whitespace-nowrap',
            s.word,
            wordmarkColor === 'light' ? 'text-white' : 'text-text-primary',
          )}
        >
          {wordmark}
        </span>
      )}
    </div>
  );
}

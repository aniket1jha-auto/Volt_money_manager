import { cn } from '@/lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  withWordmark?: boolean;
  intro?: boolean;
  breathing?: boolean;
  wordmarkColor?: 'light' | 'dark';
  className?: string;
}

const sizeMap = {
  sm:    { mark: 'h-7 w-7 text-base',         word: 'text-base' },
  md:    { mark: 'h-9 w-9 text-xl',           word: 'text-lg' },
  lg:    { mark: 'h-12 w-12 text-2xl',        word: 'text-2xl' },
  xl:    { mark: 'h-16 w-16 text-3xl',        word: 'text-3xl' },
  '2xl': { mark: 'h-24 w-24 text-5xl',        word: 'text-4xl' },
  hero:  { mark: 'h-44 w-44 text-[7rem]',     word: 'text-5xl' },
};

export function Logo({
  size = 'md',
  withWordmark = true,
  intro = false,
  breathing = false,
  wordmarkColor = 'dark',
  className,
}: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'pi-mark-bg flex items-center justify-center rounded-lg font-serif font-semibold leading-none transition-shadow',
          s.mark,
          intro && 'pi-intro',
          breathing && 'pi-breathe',
        )}
        aria-hidden
      >
        π
      </div>
      {withWordmark && (
        <span
          className={cn(
            'font-serif italic tracking-tight',
            s.word,
            wordmarkColor === 'light' ? 'text-white' : 'text-text-primary',
          )}
        >
          Volt Voice
        </span>
      )}
    </div>
  );
}

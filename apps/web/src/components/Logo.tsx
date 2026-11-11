import { cn } from '@/lib/cn';

const TONES = { green: ['#58cc02', '#46a302'], blue: ['#548eff', '#2e60de'] } as const;

export function LogoMark({ size = 40, className, tone = 'green' }: { size?: number; className?: string; tone?: keyof typeof TONES }) {
  const [main, dark] = TONES[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="2" y="4" width="44" height="42" rx="12" fill={dark} />
      <rect x="2" y="2" width="44" height="40" rx="12" fill={main} />
      <path d="M14 30c6-1 10-6 14-13l6-6c1 6-1 12-6 17-3 3-8 4-14 2z" fill="#fff" />
      <path d="M14 30l9-9" stroke={dark} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="35" cy="33" r="3" fill="#ffc800" />
    </svg>
  );
}

export function Logo({ className, compact, tone }: { className?: string; compact?: boolean; tone?: 'green' | 'blue' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={36} tone={tone} />
      {!compact && (
        <span className="text-xl font-black tracking-tight text-primary">
          БЕЛ<span className="text-ink-strong"> Мастер</span>
        </span>
      )}
    </span>
  );
}

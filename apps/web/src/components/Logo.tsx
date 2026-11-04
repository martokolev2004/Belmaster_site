import { cn } from '@/lib/cn';

export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="2" y="4" width="44" height="42" rx="12" fill="#46a302" />
      <rect x="2" y="2" width="44" height="40" rx="12" fill="#58cc02" />
      <path d="M14 30c6-1 10-6 14-13l6-6c1 6-1 12-6 17-3 3-8 4-14 2z" fill="#fff" />
      <path d="M14 30l9-9" stroke="#46a302" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="35" cy="33" r="3" fill="#ffc800" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={36} />
      {!compact && (
        <span className="text-xl font-black tracking-tight text-primary">
          БЕЛ<span className="text-ink-strong"> Мастер</span>
        </span>
      )}
    </span>
  );
}

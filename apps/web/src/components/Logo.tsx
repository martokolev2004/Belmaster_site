import { useId } from 'react';
import { cn } from '@/lib/cn';

/** знакът като SVG текст — за рисуване извън React (напр. върху картата за споделяне) */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb0ff"/><stop offset="1" stop-color="#2452d9"/></linearGradient><linearGradient id="bm-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffa51f"/></linearGradient></defs><path d="M22 6H78A16 16 0 0 1 94 22V62A16 16 0 0 1 78 78H50L30 95V78H22A16 16 0 0 1 6 62V22A16 16 0 0 1 22 6Z" fill="url(#bm-g)"/><path d="M6 30V22A16 16 0 0 1 22 6H78A16 16 0 0 1 94 22V28C62 28 30 38 6 54Z" fill="#fff" opacity=".12"/><g stroke-linecap="round" stroke-linejoin="round"><path d="M30 60 66 24" stroke="#fff" stroke-width="7"/><path d="M26 50 40 64" stroke="#fff" stroke-width="6"/><path d="M62 20 72 18 70 28Z" fill="#fff" stroke="#fff" stroke-width="4"/><path d="M70 60 38 28" stroke="url(#bm-y)" stroke-width="7"/><path d="M29 19 44 24 34 34Z" fill="url(#bm-y)" stroke="url(#bm-y)" stroke-width="4"/></g></svg>`;

/** Знакът: балонче за реч с кръстосани меч и перо — „битка на думи“. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string; tone?: 'green' | 'blue' }) {
  // всяко копие със свои преливки — иначе скритото лого (напр. страничното меню на телефон) чупи видимото
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fb0ff"/><stop offset="1" stopColor="#2452d9"/></linearGradient><linearGradient id={`y${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe08a"/><stop offset="1" stopColor="#ffa51f"/></linearGradient></defs><path d="M22 6H78A16 16 0 0 1 94 22V62A16 16 0 0 1 78 78H50L30 95V78H22A16 16 0 0 1 6 62V22A16 16 0 0 1 22 6Z" fill={`url(#g${id})`}/><path d="M6 30V22A16 16 0 0 1 22 6H78A16 16 0 0 1 94 22V28C62 28 30 38 6 54Z" fill="#fff" opacity=".12"/><g strokeLinecap="round" strokeLinejoin="round"><path d="M30 60 66 24" stroke="#fff" strokeWidth="7"/><path d="M26 50 40 64" stroke="#fff" strokeWidth="6"/><path d="M62 20 72 18 70 28Z" fill="#fff" stroke="#fff" strokeWidth="4"/><path d="M70 60 38 28" stroke={`url(#y${id})`} strokeWidth="7"/><path d="M29 19 44 24 34 34Z" fill={`url(#y${id})`} stroke={`url(#y${id})`} strokeWidth="4"/></g>
    </svg>
  );
}

export function Logo({ className, compact, tone }: { className?: string; compact?: boolean; tone?: 'green' | 'blue' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={36} tone={tone} />
      {!compact && (
        <span className="text-[1.02rem] font-extrabold uppercase tracking-tight text-ink-strong" style={{ fontFamily: "'Unbounded Variable', 'Nunito Variable', sans-serif", letterSpacing: '-0.03em' }}>
          БЕЛ <span className="text-brand">Мастър</span>
        </span>
      )}
    </span>
  );
}

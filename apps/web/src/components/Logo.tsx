import { cn } from '@/lib/cn';

/** Знакът: буквата Б в български кавички „ “ (очертани като пътища — не зависят от шрифт). */
export function LogoMark({ size = 40, className }: { size?: number; className?: string; tone?: 'green' | 'blue' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6aa0ff" />
          <stop offset="1" stopColor="#2a58d6" />
        </linearGradient>
      </defs>
      <path d="M20 4H92V76L76 92H4V20Z" fill="url(#bm-g)" />
      <path d="M20 4H92V30C60 34 30 44 4 62V20Z" fill="#fff" opacity=".1" />
      <path d="M4.7 86.4 9.6 76.1 10.3 80.2Q8.6 80.2 7.3 79.4Q5.9 78.6 5.1 77.3Q4.3 76 4.3 74.3Q4.3 72.7 5.1 71.4Q5.9 70.1 7.3 69.3Q8.6 68.5 10.3 68.5Q12 68.5 13.3 69.3Q14.7 70.1 15.5 71.4Q16.3 72.7 16.3 74.4Q16.3 75.9 15.5 77.7Q14.7 79.4 12.9 82L9.8 86.4ZM18.1 86.4 23 76.1 23.7 80.2Q22 80.2 20.7 79.4Q19.3 78.6 18.5 77.3Q17.7 76 17.7 74.3Q17.7 72.7 18.5 71.4Q19.3 70.1 20.7 69.3Q22 68.5 23.7 68.5Q25.4 68.5 26.7 69.3Q28 70.1 28.8 71.4Q29.6 72.7 29.6 74.4Q29.6 75.9 28.9 77.7Q28.1 79.4 26.2 82L23.2 86.4Z" fill="#9fe8ff" />
      <path d="M38.9 42.2H54.9Q60 42.2 63.1 43.7Q66.2 45.2 67.7 47.9Q69.2 50.5 69.2 54.1Q69.2 57.8 67.5 60.4Q65.8 63.1 62.6 64.5Q59.5 66 54.9 66H29.4L32.2 46.8L29.4 28.5H66.5V38H37.4L42.2 32.2L44.5 46.5L42 62.7L37.1 57H53Q54.6 57 55.5 56.1Q56.4 55.3 56.4 53.8Q56.4 52.3 55.5 51.5Q54.6 50.6 53 50.6H38.9Z" fill="#fff" />
      <path d="M92.1 17 87.2 27.3 86.5 23.2Q88.2 23.2 89.5 24Q90.9 24.7 91.7 26.1Q92.5 27.4 92.5 29.1Q92.5 30.7 91.7 32Q90.9 33.3 89.5 34.1Q88.1 34.9 86.5 34.9Q84.8 34.9 83.5 34.1Q82.1 33.3 81.3 32Q80.5 30.6 80.5 29Q80.5 27.4 81.3 25.7Q82.1 24 83.9 21.4L87 17ZM78.7 17 73.8 27.3 73.1 23.2Q74.8 23.2 76.2 24Q77.5 24.7 78.3 26.1Q79.1 27.4 79.1 29.1Q79.1 30.7 78.3 32Q77.5 33.3 76.1 34.1Q74.8 34.9 73.1 34.9Q71.5 34.9 70.1 34.1Q68.7 33.3 67.9 32Q67.2 30.6 67.2 29Q67.2 27.4 67.9 25.7Q68.7 24 70.5 21.4L73.6 17Z" fill="#9fe8ff" />
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

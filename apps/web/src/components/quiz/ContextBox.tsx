import { cn } from '@/lib/cn';

/**
 * Текстът към задачата (изречение, откъс) — ясно отделен.
 *  - „дума (А)“ → думата е подчертана, както в матурата;
 *  - „(дума)“ в скоби (до 3 думи) → откроява се, защото с нея се работи.
 */
export function ContextBox({ text, compact }: { text: string; compact?: boolean }) {
  const parts = text.split(/(\S+\s\([А-Е]\)|\([\p{L}\s-]{1,40}\))/gu);
  return (
    <div className={cn('rounded-xl border-l-4 border-secondary bg-secondary/8 dark:bg-secondary/12', compact ? 'mt-2 px-3 py-2' : 'mt-4 px-4 py-3')}>
      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-secondary">Текст към задачата</p>
      <p className={cn('whitespace-pre-line font-semibold leading-relaxed text-ink-strong', compact ? 'text-[15px] phone-landscape:text-sm' : 'text-[17px]')}>
        {parts.map((p, i) => {
          const marked = p.match(/^(\S+)\s\(([А-Е])\)$/u);
          // „щастливо, (А)“ — позиция след препинателен знак, не подчертана дума
          if (marked && /[,;:.!?–-]$/u.test(marked[1]))
            return (
              <span key={i}>
                {marked[1]} <span className="rounded bg-secondary/20 px-1 text-xs font-black text-secondary">({marked[2]})</span>
              </span>
            );
          if (marked)
            return (
              <span key={i}>
                <span className="font-extrabold underline decoration-2 underline-offset-4">{marked[1]}</span>{' '}
                <span className="text-xs font-black text-muted">({marked[2]})</span>
              </span>
            );
          const word = p.match(/^\(([\p{L}\s-]{1,40})\)$/u);
          if (word && word[1].trim().split(/\s+/).length <= 3)
            return (
              <span key={i} className="rounded-md bg-accent/35 px-1 font-extrabold text-ink-strong">
                ({word[1]})
              </span>
            );
          return <span key={i}>{p}</span>;
        })}
      </p>
    </div>
  );
}

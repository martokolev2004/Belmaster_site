'use client';

import { useState } from 'react';
import { PUNCT_AFTER, PUNCT_BEFORE, type AnyAnswer, type PunctMark } from '@belmaster/shared';
import { cn } from '@/lib/cn';

export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const PAIR_COLORS = ['#1cb0f6', '#ff9600', '#ce82ff', '#58cc02', '#ff4b4b', '#ffc800'];

/** Публичните данни на въпрос (без верните отговори). */
export interface InputQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'MATCHING' | 'FILL_BLANKS' | 'PUNCTUATION';
  options: string[];
  answerCount: number;
  matching: { left: string[]; right: string[] } | null;
  blanks: { text: string; blanks: { label: string; options: string[] }[] } | null;
  tokens: string[] | null;
}

/** Верните отговори — показват се след проверка. */
export interface InputReveal {
  correctIndex?: number | null;
  correctPairs?: number[] | null;
  correctBlanks?: number[] | null;
  correctMarks?: PunctMark[] | null;
}

interface Props {
  q: InputQuestion;
  value: AnyAnswer | undefined;
  onChange: (a: AnyAnswer) => void;
  disabled?: boolean;
  reveal?: InputReveal | null;
  /** скрити отговори (жокер 50/50) */
  removed?: Set<number>;
  compact?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export function hasAnswer(q: InputQuestion, a: AnyAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return a.index != null;
    case 'SHORT_ANSWER':
      return q.answerCount > 1 ? !!a.texts?.some((t) => t?.trim()) : !!a.text?.trim();
    case 'MATCHING':
      return !!a.pairs?.some((p) => p != null);
    case 'FILL_BLANKS':
      return !!a.blanks?.some((b) => b != null);
    case 'PUNCTUATION':
      return !!a.marks?.length;
  }
}

export function AnswerInput(props: Props) {
  switch (props.q.type) {
    case 'SINGLE_CHOICE':
      return <ChoiceInput {...props} />;
    case 'SHORT_ANSWER':
      return <ShortInput {...props} />;
    case 'MATCHING':
      return <MatchingInput {...props} />;
    case 'FILL_BLANKS':
      return <BlanksInput {...props} />;
    case 'PUNCTUATION':
      return <PunctuationInput {...props} />;
  }
}

function ChoiceInput({ q, value, onChange, disabled, reveal, removed, compact }: Props) {
  return (
    <div className={cn('grid', compact ? 'gap-2' : 'gap-3')}>
      {q.options.map((opt, i) => {
        const selected = value?.index === i;
        const isCorrect = reveal && reveal.correctIndex === i;
        const isWrong = reveal && selected && reveal.correctIndex !== i;
        const isRemoved = removed?.has(i) && !reveal;
        return (
          <button
            key={i}
            onClick={() => onChange({ index: i })}
            disabled={disabled || isRemoved}
            className={cn(
              'card3d flex items-center gap-3 rounded-2xl bg-surface text-left font-bold transition',
              compact ? 'rounded-xl p-2.5 text-sm phone-landscape:p-1.5' : 'p-4',
              !disabled && 'hover:bg-surface-2',
              selected && !reveal && 'border-secondary! bg-secondary/10 text-secondary-dark',
              isCorrect && 'border-primary! bg-primary/10 text-primary-dark',
              isWrong && 'animate-shake border-error! bg-error/10 text-error-dark',
              isRemoved && 'opacity-25 line-through',
            )}
          >
            <span className={cn('flex shrink-0 items-center justify-center rounded-lg border-2 font-black', compact ? 'size-6 text-xs' : 'size-8 text-sm', selected ? 'border-current' : 'border-line text-muted')}>
              {LETTERS[i]}
            </span>
            <span className="whitespace-pre-line">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function ShortInput({ q, value, onChange, disabled, autoFocus, onSubmit }: Props) {
  const n = Math.max(1, q.answerCount);
  const cls = 'w-full rounded-2xl border-2 border-line bg-surface-2 px-4 py-3 text-lg font-bold text-ink placeholder:text-muted focus:border-secondary focus:outline-none';
  if (n === 1) {
    return (
      <input
        autoFocus={autoFocus}
        value={value?.text ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ text: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
        placeholder="Напиши отговора си…"
        className={cls}
      />
    );
  }
  const texts = value?.texts ?? Array(n).fill('');
  return (
    <div className="grid gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <input
          key={i}
          autoFocus={autoFocus && i === 0}
          value={texts[i] ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const next = [...texts];
            next[i] = e.target.value;
            onChange({ texts: next });
          }}
          placeholder={`${i + 1}. отговор`}
          className={cls}
        />
      ))}
    </div>
  );
}

/** Свързване: цъкаш ляв елемент, после десен — двойката се оцветява. */
function MatchingInput({ q, value, onChange, disabled, reveal, compact }: Props) {
  const m = q.matching!;
  const pairs = value?.pairs ?? m.left.map(() => null);
  const [active, setActive] = useState<number | null>(null);
  const colorOfLeft = (i: number) => (pairs[i] != null ? PAIR_COLORS[i % PAIR_COLORS.length] : null);
  const leftOfRight = (j: number) => pairs.findIndex((p) => p === j);

  const pickRight = (j: number) => {
    if (disabled) return;
    const next = [...pairs];
    const owner = leftOfRight(j);
    if (active == null) {
      if (owner >= 0) {
        next[owner] = null; // цъкане върху свързан десен — разкачва
        onChange({ pairs: next });
      }
      return;
    }
    if (owner >= 0) next[owner] = null;
    next[active] = j;
    onChange({ pairs: next });
    setActive(null);
  };

  const item = 'card3d flex w-full items-center gap-2 rounded-xl bg-surface text-left text-sm font-bold transition';
  return (
    <div>
      {!disabled && <p className="mb-2 text-xs font-bold text-muted">Цъкни елемент отляво, после неговата двойка отдясно.</p>}
      <div className={cn('grid grid-cols-2', compact ? 'gap-2' : 'gap-3')}>
        <div className="space-y-2">
          {m.left.map((l, i) => {
            const color = colorOfLeft(i);
            const ok = reveal?.correctPairs ? reveal.correctPairs[i] === pairs[i] : null;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => setActive(active === i ? null : i)}
                className={cn(item, compact ? 'p-2' : 'p-3', active === i && 'border-secondary! bg-secondary/10', ok === true && 'border-primary!', ok === false && 'border-error!')}
                style={color && active !== i ? { borderColor: color, background: `${color}1f` } : undefined}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-black">{i + 1}</span>
                <span className="flex-1">{l}</span>
                {pairs[i] != null && <span className="font-black" style={{ color: color ?? undefined }}>→ {LETTERS[pairs[i]!]}</span>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {m.right.map((r, j) => {
            const owner = leftOfRight(j);
            const color = owner >= 0 ? PAIR_COLORS[owner % PAIR_COLORS.length] : null;
            return (
              <button
                key={j}
                disabled={disabled}
                onClick={() => pickRight(j)}
                className={cn(item, compact ? 'p-2' : 'p-3', active != null && !disabled && 'hover:bg-surface-2')}
                style={color ? { borderColor: color, background: `${color}1f` } : undefined}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-black">{LETTERS[j]}</span>
                <span className="flex-1">{r}</span>
              </button>
            );
          })}
        </div>
      </div>
      {reveal?.correctPairs && (
        <p className="mt-2 text-sm font-bold text-primary-dark">
          Верни двойки: {reveal.correctPairs.map((p, i) => `${i + 1} → ${LETTERS[p]}`).join(', ')}
        </p>
      )}
    </div>
  );
}

/** Празни места: падащо меню директно в текста. */
function BlanksInput({ q, value, onChange, disabled, reveal, compact }: Props) {
  const b = q.blanks!;
  const chosen = value?.blanks ?? b.blanks.map(() => null);
  const parts = b.text.split(/(\{\{[^}]+\}\})/g);
  return (
    <div className={cn('rounded-2xl border-2 border-dashed border-line leading-loose', compact ? 'p-2.5 text-sm' : 'p-4 text-[17px]')}>
      {parts.map((part, k) => {
        const mm = part.match(/^\{\{([^}]+)\}\}$/);
        if (!mm) return <span key={k}>{part}</span>;
        const idx = b.blanks.findIndex((x) => x.label === mm[1]);
        if (idx < 0) return <span key={k}>{part}</span>;
        const ok = reveal?.correctBlanks ? reveal.correctBlanks[idx] === chosen[idx] : null;
        return (
          <span key={k} className="inline-flex items-center gap-1 align-middle">
            <span className="text-xs font-black text-muted">({b.blanks[idx].label})</span>
            <select
              disabled={disabled}
              value={chosen[idx] ?? ''}
              onChange={(e) => {
                const next = [...chosen];
                next[idx] = e.target.value === '' ? null : Number(e.target.value);
                onChange({ blanks: next });
              }}
              className={cn(
                'rounded-lg border-2 bg-surface px-2 py-0.5 font-bold text-ink focus:border-secondary focus:outline-none',
                chosen[idx] != null ? 'border-secondary' : 'border-line',
                ok === true && 'border-primary! bg-primary/10',
                ok === false && 'border-error! bg-error/10',
              )}
            >
              <option value="">……</option>
              {b.blanks[idx].options.map((o, oi) => (
                <option key={oi} value={oi}>
                  {o}
                </option>
              ))}
            </select>
            {ok === false && reveal?.correctBlanks && <span className="text-sm font-bold text-primary-dark">{b.blanks[idx].options[reveal.correctBlanks[idx]]}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Пунктуация: цъкаш дума и добавяш знак преди/след нея. */
function PunctuationInput({ q, value, onChange, disabled, reveal, compact }: Props) {
  const tokens = q.tokens ?? [];
  const marks = value?.marks ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const has = (m: PunctMark, list: PunctMark[]) => list.some((x) => x.i === m.i && x.pos === m.pos && x.mark === m.mark);
  const toggle = (m: PunctMark) => {
    const next = has(m, marks) ? marks.filter((x) => !(x.i === m.i && x.pos === m.pos && x.mark === m.mark)) : [...marks, m];
    onChange({ marks: next });
  };
  const correct = reveal?.correctMarks ?? null;

  const markSpan = (m: PunctMark, key: string) => {
    const state = correct ? (has(m, correct) ? 'ok' : 'bad') : 'mine';
    return (
      <span key={key} className={cn('font-black', state === 'ok' && 'text-primary', state === 'bad' && 'text-error line-through', state === 'mine' && 'text-secondary')}>
        {m.mark}
      </span>
    );
  };

  return (
    <div>
      {!disabled && <p className="mb-2 text-xs font-bold text-muted">Цъкни дума, за да добавиш знак преди или след нея. Цъкни пак знака, за да го махнеш.</p>}
      <div className={cn('rounded-2xl border-2 border-dashed border-line leading-[2.2]', compact ? 'p-2.5 text-sm' : 'p-4 text-[17px]')}>
        {tokens.map((t, i) => {
          const mine = marks.filter((m) => m.i === i);
          const missed = correct ? correct.filter((m) => m.i === i && !has(m, marks)) : [];
          const core = t.replace(/[,.;:!?)]+$/, '');
          const tail = t.slice(core.length);
          const before = mine.filter((m) => m.pos === 'before');
          const after = mine.filter((m) => m.pos === 'after');
          return (
            <span key={i} className="relative inline">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(open === i ? null : i)}
                className={cn('rounded px-0.5 transition', !disabled && 'hover:bg-secondary/10', open === i && 'bg-secondary/15 ring-2 ring-secondary')}
              >
                {before.map((m, k) => markSpan(m, `b${k}`))}
                {missed.filter((m) => m.pos === 'before').map((m, k) => (
                  <span key={`mb${k}`} className="font-black text-primary underline">{m.mark}</span>
                ))}
                {core}
                {after.filter((m) => m.mark === '“' || m.mark === ')').map((m, k) => markSpan(m, `q${k}`))}
                {missed.filter((m) => m.pos === 'after' && (m.mark === '“' || m.mark === ')')).map((m, k) => (
                  <span key={`mq${k}`} className="font-black text-primary underline">{m.mark}</span>
                ))}
                {tail}
                {after.filter((m) => m.mark !== '“' && m.mark !== ')').map((m, k) => markSpan(m, `a${k}`))}
                {missed.filter((m) => m.pos === 'after' && m.mark !== '“' && m.mark !== ')').map((m, k) => (
                  <span key={`ma${k}`} className="font-black text-primary underline">{m.mark}</span>
                ))}
              </button>{' '}
              {open === i && !disabled && (
                <span className="absolute left-0 top-full z-20 mt-1 flex w-max flex-wrap gap-1 rounded-xl border-2 border-line bg-surface p-1.5 shadow-lg">
                  {PUNCT_BEFORE.map((mk) => (
                    <PunctBtn key={`b${mk}`} label={`${mk}…`} on={has({ i, pos: 'before', mark: mk }, marks)} onClick={() => toggle({ i, pos: 'before', mark: mk })} />
                  ))}
                  {PUNCT_AFTER.map((mk) => (
                    <PunctBtn key={`a${mk}`} label={`…${mk}`} on={has({ i, pos: 'after', mark: mk }, marks)} onClick={() => toggle({ i, pos: 'after', mark: mk })} />
                  ))}
                  <button type="button" onClick={() => setOpen(null)} className="px-2 text-xs font-bold text-muted">
                    ✕
                  </button>
                </span>
              )}
            </span>
          );
        })}
      </div>
      {correct && <p className="mt-2 text-xs font-bold text-muted">Зелено — верни знаци; подчертано зелено — пропуснати; зачеркнато червено — излишни.</p>}
    </div>
  );
}

function PunctBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('min-w-9 rounded-lg border-2 px-2 py-1 text-base font-black', on ? 'border-secondary bg-secondary text-white' : 'border-line bg-surface-2 text-ink')}>
      {label}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { marksFromStudentText, type AnyAnswer, type PunctMark } from '@belmaster/shared';
import { cn } from '@/lib/cn';

export const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const PAIR_COLORS = ['#1cb0f6', '#ff9600', '#ce82ff', '#58cc02', '#ff4b4b', '#ffc800'];

/** Публичните данни на въпрос (без верните отговори). */
export interface InputQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'MATCHING' | 'FILL_BLANKS' | 'PUNCTUATION' | 'FREE_TEXT';
  options: string[];
  answerCount: number;
  matching: { left: string[]; right: string[] } | null;
  blanks: { text: string; blanks: { label: string; options: string[] }[] } | null;
  tokens: string[] | null;
  /** само за администратора: индекс на верния отговор (зелена точка) */
  hint?: number | null;
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
      return !!a.text && a.text.trim() !== (q.tokens ?? []).join(' ');
    case 'FREE_TEXT':
      return !!a.text?.trim();
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
    case 'FREE_TEXT':
      return <FreeTextInput {...props} />;
  }
}

function FreeTextInput({ value, onChange, disabled }: Props) {
  return (
    <textarea
      value={value?.text ?? ''}
      disabled={disabled}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={8}
      maxLength={10000}
      placeholder="Напиши отговора си…"
      className="w-full rounded-2xl border-2 border-line bg-surface-2 px-4 py-3 text-base font-semibold leading-relaxed text-ink placeholder:text-muted focus:border-secondary focus:outline-none"
    />
  );
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
            {q.hint === i && <span className="ml-auto size-2.5 shrink-0 rounded-full bg-primary" title="Верен (вижда се само от админа)" />}
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

/** Пунктуация: ученикът сам пише знаците в текста — без подсказки. */
function PunctuationInput({ q, value, onChange, disabled, reveal, compact }: Props) {
  const tokens = q.tokens ?? [];
  const original = tokens.join(' ');
  const text = value?.text ?? original;
  const correct = reveal?.correctMarks ?? null;

  if (correct) {
    // след проверка: текстът на ученика, оцветен спрямо верния отговор
    const mine = value?.marks ?? marksFromStudentText(tokens, text);
    const has = (m: PunctMark, list: PunctMark[]) => list.some((x) => x.i === m.i && x.pos === m.pos && x.mark === m.mark);
    const span = (m: PunctMark, k: string, kind: 'ok' | 'bad' | 'missed') => (
      <span key={k} className={cn('font-black', kind === 'ok' && 'text-primary', kind === 'bad' && 'text-error line-through', kind === 'missed' && 'text-primary underline')}>
        {m.mark}
      </span>
    );
    return (
      <div>
        <div className={cn('rounded-2xl border-2 border-dashed border-line leading-[2]', compact ? 'p-2.5 text-sm' : 'p-4 text-[17px]')}>
          {tokens.map((t, i) => {
            const my = mine.filter((m) => m.i === i);
            const missed = correct.filter((m) => m.i === i && !has(m, mine));
            const coreT = t.replace(/[,.;:!?)]+$/, '');
            const tail = t.slice(coreT.length);
            const isQ = (m: PunctMark) => m.mark === '“' || m.mark === ')';
            const kind = (m: PunctMark) => (has(m, correct) ? 'ok' : 'bad');
            return (
              <span key={i}>
                {my.filter((m) => m.pos === 'before').map((m, k) => span(m, `b${k}`, kind(m)))}
                {missed.filter((m) => m.pos === 'before').map((m, k) => span(m, `mb${k}`, 'missed'))}
                {coreT}
                {my.filter((m) => m.pos === 'after' && isQ(m)).map((m, k) => span(m, `q${k}`, kind(m)))}
                {missed.filter((m) => m.pos === 'after' && isQ(m)).map((m, k) => span(m, `mq${k}`, 'missed'))}
                {tail}
                {my.filter((m) => m.pos === 'after' && !isQ(m)).map((m, k) => span(m, `a${k}`, kind(m)))}
                {missed.filter((m) => m.pos === 'after' && !isQ(m)).map((m, k) => span(m, `ma${k}`, 'missed'))}{' '}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-bold text-muted">Зелено — верни знаци · подчертано зелено — пропуснати · зачеркнато червено — излишни.</p>
      </div>
    );
  }

  return (
    <div>
      {!disabled && <p className="mb-2 text-xs font-bold text-muted">Допиши липсващите препинателни знаци направо в текста. Не променяй думите.</p>}
      <textarea
        value={text}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(e) => onChange({ text: e.target.value })}
        className={cn(
          'w-full resize-y rounded-2xl border-2 border-line bg-surface-2 text-ink focus:border-secondary focus:outline-none',
          compact ? 'min-h-40 p-2.5 text-sm leading-relaxed' : 'min-h-48 p-4 text-[17px] leading-relaxed',
        )}
      />
      {!disabled && text !== original && (
        <button type="button" onClick={() => onChange({ text: original })} className="mt-1 text-xs font-bold text-muted hover:text-ink">
          ↺ Върни първоначалния текст
        </button>
      )}
    </div>
  );
}

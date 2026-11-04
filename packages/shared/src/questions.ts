import { isShortAnswerCorrect, normalizeAnswer } from './answers';

/** Всички типове въпроси. */
export type QType = 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'MATCHING' | 'FILL_BLANKS' | 'PUNCTUATION';

export interface MatchingData {
  left: string[];
  right: string[];
  /** за всеки ляв елемент — индекс в right */
  pairs: number[];
}

export interface BlanksData {
  /** текст с маркери {{А}}, {{Б}}… */
  text: string;
  blanks: { label: string; options: string[]; correct: number }[];
}

export interface PunctMark {
  /** индекс на думата */
  i: number;
  pos: 'before' | 'after';
  mark: string;
}

export interface PunctuationData {
  tokens: string[];
  marks: PunctMark[];
}

/** Данните, които се пазят в Question.data според типа. */
export type QuestionData = { blanks?: BlanksData; punctuation?: PunctuationData } | null;

/** Отговор на ученика (всички типове). */
export interface AnyAnswer {
  index?: number | null;
  text?: string | null;
  texts?: (string | null)[] | null;
  pairs?: (number | null)[] | null;
  blanks?: (number | null)[] | null;
  marks?: PunctMark[] | null;
}

/** Каквото трябва, за да се провери отговор. */
export interface GradableQuestion {
  type: QType;
  correctIndex: number | null;
  acceptedAnswers: string[];
  answerCount: number;
  matching: MatchingData | null;
  data: QuestionData;
}

export interface ScoreResult {
  /** 0..1 — частта от верните елементи */
  score: number;
  /** напълно верен */
  correct: boolean;
}

/** Знаците, които ученикът може да постави в задача за пунктуация. */
export const PUNCT_BEFORE = ['„', '('];
export const PUNCT_AFTER = [',', '“', '.', ':', ';', '!', '?', ')', '–'];

export function scoreAnswer(q: GradableQuestion, a: AnyAnswer | null | undefined): ScoreResult {
  const full = (score: number): ScoreResult => ({ score, correct: score >= 0.999 });
  if (!a) return full(0);
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return full(a.index != null && a.index === q.correctIndex ? 1 : 0);
    case 'SHORT_ANSWER': {
      const need = Math.max(1, q.answerCount);
      if (need === 1) return full(a.text && isShortAnswerCorrect(a.text, q.acceptedAnswers) ? 1 : 0);
      // няколко отговора — броят се различните верни
      const used = new Set<string>();
      let hits = 0;
      for (const t of a.texts ?? []) {
        if (!t) continue;
        const n = normalizeAnswer(t);
        const match = q.acceptedAnswers.find((acc) => normalizeAnswer(acc) === n);
        if (match && !used.has(match)) {
          used.add(match);
          hits++;
        }
      }
      return full(Math.min(hits, need) / need);
    }
    case 'MATCHING': {
      const m = q.matching;
      if (!m || !m.pairs.length) return full(0);
      const hits = m.pairs.filter((p, i) => a.pairs?.[i] === p).length;
      return full(hits / m.pairs.length);
    }
    case 'FILL_BLANKS': {
      const b = q.data?.blanks;
      if (!b || !b.blanks.length) return full(0);
      const hits = b.blanks.filter((bl, i) => a.blanks?.[i] === bl.correct).length;
      return full(hits / b.blanks.length);
    }
    case 'PUNCTUATION': {
      const p = q.data?.punctuation;
      if (!p || !p.marks.length) return full(0);
      const key = (m: PunctMark) => `${m.i}|${m.pos}|${m.mark}`;
      const want = new Set(p.marks.map(key));
      const given = new Set((a.marks ?? []).map(key));
      let hits = 0;
      let extra = 0;
      for (const g of given) (want.has(g) ? hits++ : extra++);
      // излишен знак отнема една вярна позиция
      return full(Math.max(0, hits - extra) / want.size);
    }
  }
}

/** Време за въпрос в мултиплейъра: според типа + дължината на текста. */
export function questionTimeMs(q: { type: QType; prompt: string; context: string | null; data?: QuestionData; matching?: MatchingData | null }): number {
  const base: Record<QType, number> = {
    SINGLE_CHOICE: 20_000,
    SHORT_ANSWER: 25_000,
    MATCHING: 30_000,
    FILL_BLANKS: 30_000,
    PUNCTUATION: 50_000,
  };
  const textLen =
    q.prompt.length +
    (q.context?.length ?? 0) +
    (q.data?.blanks?.text.length ?? 0) +
    (q.data?.punctuation?.tokens.join(' ').length ?? 0);
  // дълъг текст за четене: +5 сек. за всеки 250 знака над 250, най-много +20 сек.
  const bonus = Math.min(20_000, Math.max(0, Math.ceil((textLen - 250) / 250)) * 5_000);
  return base[q.type] + bonus;
}

/** Превръща „оригинал“ + „поправен текст“ в списък с липсващи знаци (за импорта). */
export function punctuationFromTexts(original: string, corrected: string): PunctuationData {
  const tokens = original.trim().split(/\s+/);
  const fixed = corrected.trim().split(/\s+/);
  if (tokens.length !== fixed.length) {
    throw new Error(`Пунктуация: броят думи се различава (${tokens.length} срещу ${fixed.length}).`);
  }
  const marks: PunctMark[] = [];
  tokens.forEach((o, i) => {
    const c = fixed[i];
    if (o === c) return;
    // букви и цифри на оригиналната дума
    const firstLetter = c.search(/[\p{L}\p{N}]/u);
    const lastLetter = c.length - 1 - [...c].reverse().join('').search(/[\p{L}\p{N}]/u);
    const before = c.slice(0, Math.max(0, firstLetter));
    const after = c.slice(lastLetter + 1);
    const oBefore = o.slice(0, Math.max(0, o.search(/[\p{L}\p{N}]/u)));
    const oAfter = o.slice(o.length - [...o].reverse().join('').search(/[\p{L}\p{N}]/u));
    const added = (have: string, want: string) => {
      const rest = [...have];
      const out: string[] = [];
      for (const ch of want) {
        const k = rest.indexOf(ch);
        if (k >= 0) rest.splice(k, 1);
        else out.push(ch);
      }
      return out;
    };
    for (const m of added(oBefore, before)) marks.push({ i, pos: 'before', mark: m });
    for (const m of added(oAfter, after)) marks.push({ i, pos: 'after', mark: m });
  });
  return { tokens, marks };
}

/** Текст с поставени знаци — за показване на верния отговор. */
export function renderPunctuated(p: PunctuationData, marks: PunctMark[] = p.marks): string {
  return p.tokens
    .map((t, i) => {
      const pre = marks.filter((m) => m.i === i && m.pos === 'before').map((m) => m.mark).join('');
      const post = marks.filter((m) => m.i === i && m.pos === 'after').map((m) => m.mark);
      // затварящите кавички преди съществуващата пунктуация в края на думата
      const core = t.replace(/[,.;:!?)]+$/, '');
      const tail = t.slice(core.length);
      const quotes = post.filter((m) => m === '“' || m === ')').join('');
      const others = post.filter((m) => m !== '“' && m !== ')').join('');
      return `${pre}${core}${quotes}${tail}${others}`;
    })
    .join(' ');
}

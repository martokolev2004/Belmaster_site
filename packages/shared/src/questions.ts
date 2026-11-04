import { isShortAnswerCorrect, matchesAccepted } from './answers';

/** Типове, които по подразбиране влизат в мултиплейъра (пунктуацията и четенето — не). */
export const MULTIPLAYER_TYPES: QType[] = ['SINGLE_CHOICE', 'SHORT_ANSWER', 'MATCHING', 'FILL_BLANKS'];

export function defaultInMultiplayer(type: QType, section: 'LANGUAGE' | 'LITERATURE' | 'READING', answerCount = 1): boolean {
  return section !== 'READING' && MULTIPLAYER_TYPES.includes(type) && answerCount <= 1;
}

export const TYPE_LABELS: Record<QType, string> = {
  SINGLE_CHOICE: 'Избор на отговор',
  SHORT_ANSWER: 'Кратък отговор',
  MATCHING: 'Свързване',
  FILL_BLANKS: 'Празни места',
  PUNCTUATION: 'Пунктуация',
};

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
        const match = q.acceptedAnswers.find((acc) => !used.has(acc) && matchesAccepted(t, acc));
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
      const givenMarks = a.marks ?? (a.text ? marksFromStudentText(p.tokens, a.text) : []);
      const given = new Set(givenMarks.map(key));
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
    SINGLE_CHOICE: 40_000,
    SHORT_ANSWER: 45_000,
    MATCHING: 50_000,
    FILL_BLANKS: 50_000,
    PUNCTUATION: 70_000,
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

const LETTER = /[\p{L}\p{N}]/u;

function edges(t: string): { before: string; after: string } {
  const chars = [...t];
  const first = chars.findIndex((c) => LETTER.test(c));
  if (first < 0) return { before: t, after: '' };
  let last = chars.length - 1;
  while (last >= 0 && !LETTER.test(chars[last])) last--;
  return { before: chars.slice(0, first).join(''), after: chars.slice(last + 1).join('') };
}

function core(t: string): string {
  return t.replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase('bg-BG');
}

/** Знаците, които „c“ има в повече от „o“ (една и съща дума). */
function addedMarks(o: string, c: string, i: number): PunctMark[] {
  const eo = edges(o);
  const ec = edges(c);
  // кавички от клавиатурата ("…", «…», “…”) = български „…“
  ec.before = ec.before.replace(/["«“]/g, '„');
  ec.after = ec.after.replace(/["»”]/g, '“');
  // тире от клавиатурата (-, —) = –
  ec.after = ec.after.replace(/[-—]/g, '–');
  const diff = (have: string, want: string) => {
    const rest = [...have];
    const out: string[] = [];
    for (const ch of want) {
      if (/\s/.test(ch)) continue;
      const k = rest.indexOf(ch);
      if (k >= 0) rest.splice(k, 1);
      else out.push(ch);
    }
    return out;
  };
  return [
    ...diff(eo.before, ec.before).map((mark) => ({ i, pos: 'before' as const, mark })),
    ...diff(eo.after, ec.after).map((mark) => ({ i, pos: 'after' as const, mark })),
  ];
}

/** Разделя текст на думи; самостоятелни знаци („ – и т.н.) се залепят за съседната дума. */
function tokenize(text: string): string[] {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let carry = '';
  let quoteOpen = false; // за прави кавички " — коя е отваряща и коя затваряща
  for (const t of raw) {
    if (!LETTER.test(t)) {
      const opening = /^[„(«]/.test(t) || (t.startsWith('"') && !quoteOpen);
      if (t.includes('"')) quoteOpen = !quoteOpen;
      if (opening || !out.length) carry += t;
      else out[out.length - 1] += t;
      continue;
    }
    for (const ch of t) if (ch === '"') quoteOpen = !quoteOpen;
    out.push(carry + t);
    carry = '';
  }
  if (carry && out.length) out[out.length - 1] += carry;
  return out;
}

/** Превръща „оригинал“ + „поправен текст“ в списък с липсващи знаци (за импорта). */
export function punctuationFromTexts(original: string, corrected: string): PunctuationData {
  const tokens = original.trim().split(/\s+/);
  const fixed = tokenize(corrected);
  if (tokens.length !== fixed.length) {
    throw new Error(`Пунктуация: броят думи се различава (${tokens.length} срещу ${fixed.length}).`);
  }
  const marks: PunctMark[] = [];
  tokens.forEach((o, i) => {
    if (core(o) !== core(fixed[i])) throw new Error(`Пунктуация: думата „${o}“ не съвпада с „${fixed[i]}“.`);
    marks.push(...addedMarks(o, fixed[i], i));
  });
  return { tokens, marks };
}

/** Знаците, които ученикът е добавил в своя текст (подравняване по думите, понася печатни грешки). */
export function marksFromStudentText(tokens: string[], text: string): PunctMark[] {
  const st = tokenize(text);
  const a = tokens.map(core);
  const b = st.map(core);
  // най-дълга обща подредица по думите
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const marks: PunctMark[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      marks.push(...addedMarks(tokens[i], st[j], i));
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return marks;
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

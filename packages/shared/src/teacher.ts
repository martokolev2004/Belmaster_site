// Учителски тестове: въпросите се пазят като JSON в теста (и копие в заданието).
import { displayAccepted } from './answers';
import {
  punctuationFromTexts,
  scoreAnswer,
  type AnyAnswer,
  type BlanksData,
  type MatchingData,
  type PunctuationData,
  type QType,
} from './questions';

export type TeacherQType = QType | 'FREE_TEXT';

export const TEACHER_TYPE_LABELS: Record<TeacherQType, string> = {
  SINGLE_CHOICE: 'Избор (А, Б, В, Г)',
  SHORT_ANSWER: 'Кратък отговор',
  MATCHING: 'Свързване',
  FILL_BLANKS: 'Празни места',
  PUNCTUATION: 'Пунктуация',
  FREE_TEXT: 'Свободен текст (проверява учителят)',
};

export interface TeacherQuestion {
  id: string;
  type: TeacherQType;
  prompt: string;
  context?: string | null;
  points: number;
  // SINGLE_CHOICE
  options?: string[];
  correctIndex?: number | null;
  // SHORT_ANSWER
  acceptedAnswers?: string[];
  answerCount?: number;
  // MATCHING
  matching?: MatchingData | null;
  // FILL_BLANKS (текст с {{А}}, {{Б}}…)
  blanks?: BlanksData | null;
  // PUNCTUATION — учителят пише текста без знаците и верния текст
  punctText?: string;
  punctAnswer?: string;
  punctuation?: PunctuationData | null;
  // FREE_TEXT — упътване/примерен отговор за учителя
  guide?: string;
  /** откъде е копиран (въпрос от матурите) */
  sourceQuestionId?: string | null;
}

/** Точки по подразбиране според типа. */
export function defaultTeacherPoints(q: Pick<TeacherQuestion, 'type' | 'matching' | 'blanks' | 'punctuation' | 'answerCount'>): number {
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return 1;
    case 'SHORT_ANSWER':
      return 2 * Math.max(1, q.answerCount ?? 1);
    case 'MATCHING':
      return Math.max(1, q.matching?.left.length ?? 3);
    case 'FILL_BLANKS':
      return Math.max(1, q.blanks?.blanks.length ?? 3);
    case 'PUNCTUATION':
      return Math.max(1, q.punctuation?.marks.length ?? 5);
    case 'FREE_TEXT':
      return 4;
  }
}

/** Проверява въпрос; връща грешките (празно = наред) и попълва изчислените полета. */
export function prepareTeacherQuestion(q: TeacherQuestion): { q: TeacherQuestion; errors: string[] } {
  const e: string[] = [];
  const out: TeacherQuestion = { ...q, prompt: (q.prompt ?? '').trim(), context: q.context?.trim() || null };
  if (!out.prompt) e.push('Няма условие.');
  if (!Number.isFinite(out.points) || out.points <= 0 || out.points > 100) e.push('Точките трябва да са между 1 и 100.');
  switch (q.type) {
    case 'SINGLE_CHOICE': {
      out.options = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (out.options.length < 2) e.push('Нужни са поне 2 отговора.');
      if (out.correctIndex == null || out.correctIndex < 0 || out.correctIndex >= out.options.length) e.push('Избери верния отговор.');
      break;
    }
    case 'SHORT_ANSWER': {
      out.acceptedAnswers = (q.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean);
      out.answerCount = Math.max(1, Math.min(5, q.answerCount ?? 1));
      if (!out.acceptedAnswers.length) e.push('Напиши поне един верен отговор.');
      if (out.acceptedAnswers.length < out.answerCount) e.push(`Искаш ${out.answerCount} отговора — напиши поне толкова верни варианта.`);
      break;
    }
    case 'MATCHING': {
      const m = q.matching;
      if (!m || m.left.length < 2) e.push('Нужни са поне 2 двойки.');
      else {
        out.matching = { left: m.left.map((s) => s.trim()), right: m.right.map((s) => s.trim()), pairs: m.pairs };
        if (out.matching.left.some((s) => !s) || out.matching.right.some((s) => !s)) e.push('Има празно поле в свързването.');
        if (m.pairs.length !== m.left.length || m.pairs.some((p) => p == null || p < 0 || p >= m.right.length)) e.push('Избери двойка за всеки ред.');
      }
      break;
    }
    case 'FILL_BLANKS': {
      const b = q.blanks;
      if (!b || !b.blanks.length) e.push('Няма празни места.');
      else {
        const labels = [...b.text.matchAll(/\{\{([^}]+)\}\}/g)].map((x) => x[1]);
        if (labels.length !== b.blanks.length) e.push('Броят на празните места в текста ({{А}}, {{Б}}…) не съвпада с броя на изборите.');
        for (const bl of b.blanks) {
          if (bl.options.filter((o) => o.trim()).length < 2) e.push(`Място ${bl.label}: нужни са поне 2 думи.`);
          if (bl.correct == null || bl.correct < 0 || bl.correct >= bl.options.length) e.push(`Място ${bl.label}: избери вярната дума.`);
        }
      }
      break;
    }
    case 'PUNCTUATION': {
      if (!q.punctText?.trim() || !q.punctAnswer?.trim()) e.push('Напиши текста без знаците и верния текст.');
      else
        try {
          out.punctuation = punctuationFromTexts(q.punctText, q.punctAnswer);
          if (!out.punctuation.marks.length) e.push('Верният текст няма знаци, които липсват в първия.');
        } catch (err) {
          e.push(err instanceof Error ? err.message : 'Текстовете не съвпадат.');
        }
      break;
    }
    case 'FREE_TEXT':
      break;
  }
  return { q: out, errors: e };
}

/** Автоматични точки; null = проверява учителят (свободен текст). */
export function scoreTeacherQuestion(q: TeacherQuestion, a: AnyAnswer | null | undefined): number | null {
  if (q.type === 'FREE_TEXT') return null;
  const r = scoreAnswer(
    {
      type: q.type,
      correctIndex: q.correctIndex ?? null,
      acceptedAnswers: q.acceptedAnswers ?? [],
      answerCount: q.answerCount ?? 1,
      matching: q.matching ?? null,
      data: { blanks: q.blanks ?? undefined, punctuation: q.punctuation ?? undefined },
    },
    a,
  );
  return Math.round(r.score * q.points * 100) / 100;
}

/** Кратък текст на отговора на ученика (за статистиката „най-чести грешни отговори“). */
export function answerSummary(q: TeacherQuestion, a: AnyAnswer | null | undefined): string {
  if (!a) return '—';
  const L = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return a.index != null ? `${L[a.index]}) ${q.options?.[a.index] ?? ''}` : '—';
    case 'SHORT_ANSWER':
      return (q.answerCount ?? 1) > 1 ? (a.texts ?? []).filter(Boolean).join('; ') || '—' : a.text?.trim() || '—';
    case 'MATCHING':
      return (a.pairs ?? []).map((p, i) => `${i + 1}→${p != null ? L[p] : '?'}`).join(', ');
    case 'FILL_BLANKS':
      return (q.blanks?.blanks ?? []).map((b, i) => `(${b.label}) ${a.blanks?.[i] != null ? b.options[a.blanks[i]!] : '?'}`).join(', ');
    case 'PUNCTUATION':
    case 'FREE_TEXT':
      return a.text?.trim() || '—';
  }
}

/** Публичната част на въпроса за ученика (без верните отговори). */
export function publicTeacherQuestion(q: TeacherQuestion) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    context: q.context ?? null,
    points: q.points,
    options: q.type === 'SINGLE_CHOICE' ? q.options ?? [] : [],
    answerCount: q.answerCount ?? 1,
    matching: q.type === 'MATCHING' && q.matching ? { left: q.matching.left, right: q.matching.right } : null,
    blanks: q.type === 'FILL_BLANKS' && q.blanks ? { text: q.blanks.text, blanks: q.blanks.blanks.map((b) => ({ label: b.label, options: b.options })) } : null,
    tokens: q.type === 'PUNCTUATION' && q.punctuation ? q.punctuation.tokens : null,
  };
}
export type PublicTeacherQuestion = ReturnType<typeof publicTeacherQuestion>;

/** Код на клас: 6 знака без лесно бъркани (0/O, 1/I). */
export function newClassCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

/** Верният отговор като текст (за разбора). */
export function teacherCorrectText(q: TeacherQuestion): string {
  const L = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return q.correctIndex != null ? `${L[q.correctIndex]}) ${q.options?.[q.correctIndex] ?? ''}` : '';
    case 'SHORT_ANSWER':
      return displayAccepted(q.acceptedAnswers ?? []);
    case 'MATCHING':
      return (q.matching?.pairs ?? []).map((p, i) => `${i + 1} → ${L[p]}`).join(', ');
    case 'FILL_BLANKS':
      return (q.blanks?.blanks ?? []).map((b) => `(${b.label}) ${b.options[b.correct]}`).join(', ');
    case 'PUNCTUATION':
      return q.punctAnswer ?? '';
    case 'FREE_TEXT':
      return q.guide ?? '';
  }
}

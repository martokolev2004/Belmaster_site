import { prisma, type Grade } from '@belmaster/db';
import {
  displayAccepted,
  TOPIC_LABELS,
  SECTION_LABELS,
  questionTimeMs,
  renderPunctuated,
  scoreAnswer,
  type AnyAnswer,
  type MatchingData,
  type QType,
  type QuestionData,
  type ScoreResult,
} from '@belmaster/shared';

export interface PoolQuestion {
  id: string;
  type: QType;
  prompt: string;
  context: string | null;
  options: string[];
  correctIndex: number | null;
  acceptedAnswers: string[];
  answerCount: number;
  matching: MatchingData | null;
  data: QuestionData;
  explanation: string | null;
  workId: string | null;
  workTitle: string | null;
  topicLabel: string;
  timeMs: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function usable(q: PoolQuestion): boolean {
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return q.correctIndex != null && q.options.length >= 2;
    case 'SHORT_ANSWER':
      return q.acceptedAnswers.length > 0;
    case 'MATCHING':
      return !!q.matching && q.matching.pairs.length > 0;
    case 'FILL_BLANKS':
      return !!q.data?.blanks && q.data.blanks.blanks.length > 0;
    case 'PUNCTUATION':
      return !!q.data?.punctuation && q.data.punctuation.marks.length > 0;
  }
}

/** Въпросите за една игра. Четене с разбиране не участва в мултиплейъра. */
export class QuestionPool {
  private all: PoolQuestion[] = [];
  private byWork = new Map<string, PoolQuestion[]>();
  private used = new Set<string>();
  private queue: PoolQuestion[] = [];

  static async load(grade: Grade): Promise<QuestionPool> {
    const rows = await prisma.question.findMany({
      where: { grade, status: 'ACTIVE', inMultiplayer: true, section: { in: ['LANGUAGE', 'LITERATURE'] } },
      include: { work: true },
    });
    const pool = new QuestionPool();
    for (const r of rows) {
      const q: PoolQuestion = {
        id: r.id,
        type: r.type,
        prompt: r.prompt,
        context: r.context,
        options: r.type === 'SINGLE_CHOICE' ? r.options : [],
        correctIndex: r.correctIndex,
        acceptedAnswers: r.acceptedAnswers,
        answerCount: r.answerCount,
        matching: r.matching as MatchingData | null,
        data: r.data as QuestionData,
        explanation: r.explanation,
        workId: r.workId,
        workTitle: r.work ? r.work.title : null,
        topicLabel: r.topic ? TOPIC_LABELS[r.topic] : SECTION_LABELS[r.section],
        timeMs: 0,
      };
      if (!usable(q)) continue;
      q.timeMs = questionTimeMs(q);
      pool.all.push(q);
      if (q.workId) {
        const list = pool.byWork.get(q.workId) ?? [];
        list.push(q);
        pool.byWork.set(q.workId, list);
      }
    }
    pool.queue = shuffle(pool.all);
    return pool;
  }

  get size() {
    return this.all.length;
  }

  worksWithQuestions(): { id: string; title: string }[] {
    return [...this.byWork.entries()].map(([id, qs]) => ({ id, title: qs[0].workTitle ?? '' }));
  }

  random(): PoolQuestion {
    if (!this.queue.length) this.queue = shuffle(this.all);
    let q = this.queue.shift()!;
    for (let i = 0; i < this.queue.length && this.used.has(q.id); i++) {
      this.queue.push(q);
      q = this.queue.shift()!;
    }
    this.used.add(q.id);
    return q;
  }

  forWork(workId: string | null): PoolQuestion {
    if (workId) {
      const fresh = (this.byWork.get(workId) ?? []).filter((q) => !this.used.has(q.id));
      if (fresh.length) {
        const q = fresh[Math.floor(Math.random() * fresh.length)];
        this.used.add(q.id);
        this.queue = this.queue.filter((x) => x.id !== q.id);
        return q;
      }
    }
    return this.random();
  }
}

export function grade(q: PoolQuestion, a: AnyAnswer): ScoreResult {
  return scoreAnswer(q, a);
}

/** Текст за верния отговор (за разбора и показването). */
export function correctText(q: PoolQuestion): string | null {
  const L = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
  switch (q.type) {
    case 'SINGLE_CHOICE':
      return null;
    case 'SHORT_ANSWER':
      return displayAccepted(q.acceptedAnswers);
    case 'MATCHING':
      return q.matching ? q.matching.pairs.map((p, i) => `${q.matching!.left[i]} → ${q.matching!.right[p]}`).join('; ') : null;
    case 'FILL_BLANKS':
      return q.data?.blanks ? q.data.blanks.blanks.map((b) => `(${b.label}) ${b.options[b.correct]}`).join(', ') : null;
    case 'PUNCTUATION':
      return q.data?.punctuation ? renderPunctuated(q.data.punctuation) : null;
  }
  void L;
}

/** Отговор на бота: верен (пълен) или произволен. */
export function botAnswer(q: PoolQuestion, right: boolean): AnyAnswer {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  switch (q.type) {
    case 'SINGLE_CHOICE': {
      const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
      return { index: right ? q.correctIndex! : wrong[rnd(wrong.length)] };
    }
    case 'SHORT_ANSWER':
      return { text: right ? displayAccepted([q.acceptedAnswers[0]]) : '...' };
    case 'MATCHING': {
      const m = q.matching!;
      return { pairs: right ? [...m.pairs] : m.pairs.map(() => rnd(m.right.length)) };
    }
    case 'FILL_BLANKS': {
      const b = q.data!.blanks!;
      return { blanks: b.blanks.map((x) => (right ? x.correct : rnd(x.options.length))) };
    }
    case 'PUNCTUATION': {
      const p = q.data!.punctuation!;
      return { marks: right ? [...p.marks] : p.marks.filter(() => Math.random() < 0.5) };
    }
  }
}

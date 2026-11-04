import { prisma, type Grade } from '@belmaster/db';
import { TOPIC_LABELS, SECTION_LABELS, isShortAnswerCorrect } from '@belmaster/shared';

export interface PoolQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER';
  prompt: string;
  context: string | null;
  options: string[];
  correctIndex: number | null;
  acceptedAnswers: string[];
  explanation: string | null;
  workId: string | null;
  workTitle: string | null;
  topicLabel: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Въпросите за една игра. Четене с разбиране и свързване не участват в мултиплейъра. */
export class QuestionPool {
  private all: PoolQuestion[] = [];
  private byWork = new Map<string, PoolQuestion[]>();
  private used = new Set<string>();
  private queue: PoolQuestion[] = [];

  static async load(grade: Grade): Promise<QuestionPool> {
    const rows = await prisma.question.findMany({
      where: {
        grade,
        status: 'ACTIVE',
        section: { in: ['LANGUAGE', 'LITERATURE'] },
        type: { in: ['SINGLE_CHOICE', 'SHORT_ANSWER'] },
      },
      include: { work: true },
    });
    const pool = new QuestionPool();
    for (const r of rows) {
      if (r.type === 'SINGLE_CHOICE' && (r.correctIndex == null || r.options.length < 2)) continue;
      if (r.type === 'SHORT_ANSWER' && r.acceptedAnswers.length === 0) continue;
      const q: PoolQuestion = {
        id: r.id,
        type: r.type as PoolQuestion['type'],
        prompt: r.prompt,
        context: r.context,
        options: r.type === 'SINGLE_CHOICE' ? r.options : [],
        correctIndex: r.correctIndex,
        acceptedAnswers: r.acceptedAnswers,
        explanation: r.explanation,
        workId: r.workId,
        workTitle: r.work ? r.work.title : null,
        topicLabel: r.topic ? TOPIC_LABELS[r.topic] : SECTION_LABELS[r.section],
      };
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

  /** Произведения, за които има поне един въпрос. */
  worksWithQuestions(): { id: string; title: string }[] {
    return [...this.byWork.entries()].map(([id, qs]) => ({ id, title: qs[0].workTitle ?? '' }));
  }

  /** Случаен въпрос (без повторение, докато не свършат). */
  random(): PoolQuestion {
    if (!this.queue.length) this.queue = shuffle(this.all);
    let q = this.queue.shift()!;
    // опит да избегнем вече използвани (напр. изтеглени през произведение)
    for (let i = 0; i < this.queue.length && this.used.has(q.id); i++) {
      this.queue.push(q);
      q = this.queue.shift()!;
    }
    this.used.add(q.id);
    return q;
  }

  /** Въпрос за конкретно произведение; ако са свършили — случаен. */
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

export function isCorrect(q: PoolQuestion, a: { index?: number; text?: string }): boolean {
  if (q.type === 'SINGLE_CHOICE') return typeof a.index === 'number' && a.index === q.correctIndex;
  return typeof a.text === 'string' && isShortAnswerCorrect(a.text, q.acceptedAnswers);
}

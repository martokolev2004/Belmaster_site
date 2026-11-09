import type { PrismaClient } from '@prisma/client';

export interface AnswerRecord {
  questionId: string;
  /** 0..1 */
  score: number;
  correct: boolean;
}

/** Записва отговорите: статистика по теми + „Моите грешки“ (маха се след 2 поредни верни). */
export async function recordAnswers(prisma: PrismaClient, userId: string, items: AnswerRecord[]): Promise<void> {
  if (!items.length) return;
  const qs = await prisma.question.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.questionId))] } },
    select: { id: true, section: true, topic: true, workId: true },
  });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const stats = new Map<string, { answered: number; score: number }>();
  const add = (key: string, score: number) => {
    const s = stats.get(key) ?? { answered: 0, score: 0 };
    s.answered++;
    s.score += score;
    stats.set(key, s);
  };
  for (const it of items) {
    const q = byId.get(it.questionId);
    if (!q) continue;
    add(`S:${q.section}`, it.score);
    if (q.topic) add(`T:${q.topic}`, it.score);
    if (q.workId) add(`W:${q.workId}`, it.score);
  }
  const ops = [...stats.entries()].map(([key, s]) =>
    prisma.userTopicStat.upsert({
      where: { userId_key: { userId, key } },
      update: { answered: { increment: s.answered }, score: { increment: s.score } },
      create: { userId, key, answered: s.answered, score: s.score },
    }),
  );
  await prisma.$transaction(ops);

  // обща статистика на въпроса — от нея се смята трудността
  for (const it of items) {
    if (!byId.has(it.questionId)) continue;
    await prisma.question.update({ where: { id: it.questionId }, data: { answeredCount: { increment: 1 }, ...(it.correct ? { correctCount: { increment: 1 } } : {}) } });
  }

  // „Моите грешки“ с повторение: след верен отговор въпросът се връща след 1, после 3, после 7 дни; след 4-ия верен — изчистен
  const now = Date.now();
  let cleared = 0;
  for (const it of items) {
    if (!byId.has(it.questionId)) continue;
    const where = { userId_questionId: { userId, questionId: it.questionId } };
    if (!it.correct) {
      await prisma.userMistake.upsert({
        where,
        update: { streak: 0, wrongCount: { increment: 1 }, dueAt: new Date(now) },
        create: { userId, questionId: it.questionId, dueAt: new Date(now) },
      });
    } else {
      const m = await prisma.userMistake.findUnique({ where });
      if (!m || m.dueAt.getTime() > now) continue; // още не е време — не се брои
      const streak = m.streak + 1;
      if (streak >= REVIEW_DAYS.length + 1) {
        await prisma.userMistake.delete({ where });
        cleared++;
      } else await prisma.userMistake.update({ where, data: { streak, dueAt: new Date(now + REVIEW_DAYS[streak - 1] * 86_400_000) } });
    }
  }
  if (cleared) await prisma.user.update({ where: { id: userId }, data: { mistakesCleared: { increment: cleared } } });
}

/** След колко дни се връща въпросът при 1-ви, 2-ри, 3-ти верен отговор. */
export const REVIEW_DAYS = [1, 3, 7];

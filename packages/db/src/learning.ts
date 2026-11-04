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

  for (const it of items) {
    if (!byId.has(it.questionId)) continue;
    const where = { userId_questionId: { userId, questionId: it.questionId } };
    if (!it.correct) {
      await prisma.userMistake.upsert({ where, update: { streak: 0, wrongCount: { increment: 1 } }, create: { userId, questionId: it.questionId } });
    } else {
      const m = await prisma.userMistake.findUnique({ where });
      if (!m) continue;
      if (m.streak + 1 >= 2) await prisma.userMistake.delete({ where });
      else await prisma.userMistake.update({ where, data: { streak: { increment: 1 } } });
    }
  }
}

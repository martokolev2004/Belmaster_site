'use server';

import { XP_PER_CORRECT } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { awardProgress } from '@/lib/progress';
import { grade } from '@/lib/quiz';
import type { Answer, FinishResult, QuestionResult, TestKind } from '@/lib/quiz-types';

export async function checkAnswerAction(questionId: string, answer: Answer): Promise<QuestionResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return null;
  return grade(q, answer);
}

export async function finishTestAction(
  kind: TestKind,
  examId: string | null,
  answers: { id: string; answer: Answer }[],
): Promise<FinishResult | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.grade) return { error: 'Не си влязъл.' };
  const ids = answers.map((a) => a.id).slice(0, 200);
  const qs = await prisma.question.findMany({ where: { id: { in: ids } } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const results: QuestionResult[] = [];
  for (const a of answers) {
    const q = byId.get(a.id);
    if (q) results.push(grade(q, a.answer));
  }
  const score = results.filter((r) => r.correct).length;
  const xpEarned = score * XP_PER_CORRECT;
  const before = user.level;

  await prisma.$transaction([
    prisma.quizAttempt.create({
      data: { userId: user.id, grade: user.grade, kind, examId, score, total: results.length, xpEarned, answers: answers as object[] },
    }),
    ...results.map((r) =>
      prisma.question.update({
        where: { id: r.id },
        data: { timesAsked: { increment: 1 }, timesCorrect: { increment: r.correct ? 1 : 0 } },
      }),
    ),
  ]);
  const { user: updated, unlocked } = await awardProgress(user.id, xpEarned, {
    perfect: results.length >= 5 && score === results.length,
  });

  return {
    score,
    total: results.length,
    xpEarned,
    newXp: updated.xp,
    level: updated.level,
    leveledUp: updated.level > before,
    streak: updated.streak,
    unlocked,
    results,
  };
}

const REASONS = ['Грешен верен отговор', 'Грешка в условието', 'Неясен въпрос', 'Друго'];

export async function reportQuestionAction(questionId: string, reason: string, message: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const exists = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!exists) return { ok: false };
  const recent = await prisma.questionReport.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent > 30) return { ok: false };
  await prisma.questionReport.create({
    data: {
      questionId,
      userId: user.id,
      reason: REASONS.includes(reason) ? reason : 'Друго',
      message: message.slice(0, 1000) || null,
    },
  });
  return { ok: true };
}

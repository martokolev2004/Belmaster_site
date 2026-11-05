'use server';

import { XP_PER_CORRECT, estimateGrade } from '@belmaster/shared';
import { recordAnswers } from '@belmaster/db';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { awardProgress } from '@/lib/progress';
import { grade, nextSurvivalQuestion, survivalBest } from '@/lib/quiz';
import type { Answer, FinishResult, QuestionResult, TestKind } from '@/lib/quiz-types';

export async function checkAnswerAction(questionId: string, answer: Answer): Promise<QuestionResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return null;
  return grade(q, answer);
}

/** Нощна птица / ранобудник — по часа в София. */
function timeOfDayEvents(): string[] {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
  const t = h * 60 + m;
  if (t >= 23 * 60 || t < 4 * 60) return ['night_owl'];
  if (t >= 5 * 60 && t < 7 * 60 + 30) return ['early_bird'];
  return [];
}

export async function finishTestAction(
  kind: TestKind,
  examId: string | null,
  answers: { id: string; answer: Answer }[],
  meta: { timeUsedSec?: number | null; timedOut?: boolean } = {},
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
  // частични точки (свързване, празни места, пунктуация) се събират
  const score = Math.round(results.reduce((s, r) => s + r.score, 0) * 100) / 100;
  const xpEarned = Math.round(score * XP_PER_CORRECT);
  const before = user.level;
  // матура: точки по ключа (частичните се смятат пропорционално)
  let exam: FinishResult['exam'];
  if (kind === 'EXAM') {
    const maxPoints = results.reduce((s, r) => s + (byId.get(r.id)?.points ?? 1), 0);
    const points = Math.round(results.reduce((s, r) => s + r.score * (byId.get(r.id)?.points ?? 1), 0) * 10) / 10;
    exam = { points, maxPoints, grade: estimateGrade(points, maxPoints), timeUsedSec: meta.timeUsedSec ?? null, timedOut: !!meta.timedOut };
  }

  await prisma.$transaction([
    prisma.quizAttempt.create({
      data: {
        userId: user.id,
        grade: user.grade,
        kind,
        examId,
        score: exam ? exam.points : score,
        total: exam ? exam.maxPoints : results.length,
        xpEarned,
        answers: answers as object[],
      },
    }),
    ...results.map((r) =>
      prisma.question.update({
        where: { id: r.id },
        data: { timesAsked: { increment: 1 }, timesCorrect: { increment: r.correct ? 1 : 0 } },
      }),
    ),
  ]);
  await recordAnswers(prisma, user.id, results.map((r) => ({ questionId: r.id, score: r.score, correct: r.correct })));
  const mistakesCount = await prisma.userMistake.count({ where: { userId: user.id, dueAt: { lte: new Date() }, question: { status: 'ACTIVE', grade: user.grade } } });
  const { user: updated, unlocked } = await awardProgress(user.id, xpEarned, {
    perfect: results.length >= 5 && results.every((r) => r.correct),
    events: [
      ...(exam && exam.grade >= 5.5 ? ['exam_550'] : []),
      ...(exam && exam.maxPoints > 0 && exam.points >= exam.maxPoints ? ['exam_perfect'] : []),
      ...timeOfDayEvents(),
    ],
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
    mistakesCount,
    exam,
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

// ───────────── „До първа грешка“ ─────────────

export async function nextSurvivalAction(seen: string[]) {
  const user = await getCurrentUser();
  if (!user?.grade) return null;
  return nextSurvivalQuestion(user.grade, Array.isArray(seen) ? seen.map(String) : []);
}

export async function finishSurvivalAction(answers: { id: string; answer: Answer }[]): Promise<{ streak: number; best: number; record: boolean; xpEarned: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.grade) return { error: 'Не си влязъл.' };
  const list = answers.slice(0, 500);
  const qs = await prisma.question.findMany({ where: { id: { in: list.map((a) => a.id) } } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const results = list.map((a) => byId.get(a.id)).map((q, i) => (q ? grade(q, list[i].answer) : null)).filter((r): r is QuestionResult => !!r);
  // серията = верните отговори до първата грешка (проверява се на сървъра)
  let streak = 0;
  for (const r of results) {
    if (!r.correct) break;
    streak++;
  }
  const previous = await survivalBest(user.id);
  const xpEarned = streak * XP_PER_CORRECT;
  await prisma.quizAttempt.create({ data: { userId: user.id, grade: user.grade, kind: 'SURVIVAL', score: streak, total: results.length, xpEarned, answers: list as object[] } });
  await recordAnswers(prisma, user.id, results.map((r) => ({ questionId: r.id, score: r.score, correct: r.correct })));
  await awardProgress(user.id, xpEarned);
  return { streak, best: Math.max(previous, streak), record: streak > previous && streak > 0, xpEarned };
}

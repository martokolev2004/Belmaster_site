'use server';

import type { TowerRun } from '@belmaster/db';
import { recordAnswers } from '@belmaster/db';
import { currentSeason, simulateDrop, TOWER, type DropKind } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { awardProgress } from '@/lib/progress';
import type { ClientQuestion } from '@/lib/quiz-types';
import { pickTowerQuestion, randomTheme, saveTowerBest, towerBest, towerState, towerXpLimit, xpAnswersToday, type TowerState } from '@/lib/tower';

type LogItem = { prompt: string; chosen: string | null; correct: string; ok: boolean };

export interface TowerFinish {
  floors: number;
  best: number;
  record: boolean;
  xpEarned: number;
}

async function myRun(runId: string) {
  const user = await getCurrentUser();
  if (!user?.grade) return null;
  const run = await prisma.towerRun.findFirst({ where: { id: String(runId), userId: user.id, status: 'ACTIVE' } });
  return run ? { user, run } : null;
}

/** Задава следващ въпрос и връща вида му за клиента (без верния отговор). */
async function askNext(run: TowerRun, admin: boolean) {
  const picked = await pickTowerQuestion(run.grade, run.seen, run.xs.length);
  if (!picked) return { run: await prisma.towerRun.update({ where: { id: run.id }, data: { phase: 'over' } }), question: null };
  const updated = await prisma.towerRun.update({
    where: { id: run.id },
    data: { phase: 'question', phaseAt: new Date(), questionId: picked.raw.id, perm: picked.perm, seen: [...run.seen, picked.raw.id] },
  });
  let question: ClientQuestion = picked.question;
  if (admin && picked.raw.correctIndex != null) question = { ...question, hint: picked.perm.indexOf(picked.raw.correctIndex) };
  return { run: updated, question };
}

/** Край: рекорд, XP, постижения. */
async function finishRun(run: TowerRun, reason: string, isGuest: boolean, userId: string): Promise<TowerFinish> {
  const floors = run.xs.length;
  const prevBest = await towerBest(userId, run.grade);
  if (!isGuest && floors > 0) await saveTowerBest(userId, run.grade, floors);
  const xp = run.xpAnswers * TOWER.XP_PER_CORRECT;
  await prisma.towerRun.update({ where: { id: run.id }, data: { status: 'DONE', phase: 'over', endReason: run.endReason ?? reason, endedAt: new Date(), xpEarned: xp } });
  const events = ['tower_game'];
  if (run.perfects >= 10) events.push('tower_perfect10');
  await awardProgress(userId, xp, { events });
  return { floors, best: Math.max(prevBest, floors), record: !isGuest && floors > prevBest, xpEarned: xp };
}

export async function startTowerAction(): Promise<{ state: TowerState; question: ClientQuestion | null; best: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user?.grade) return { error: 'Не си влязъл.' };
  // незавършени игри се приключват (с каквото са построили)
  for (const old of await prisma.towerRun.findMany({ where: { userId: user.id, status: 'ACTIVE' } })) await finishRun(old, 'left', user.isGuest, user.id);
  const run = await prisma.towerRun.create({
    data: { userId: user.id, grade: user.grade, season: currentSeason(), theme: randomTheme(), seed: Math.random(), lives: TOWER.LIVES, log: [] },
  });
  const { run: r, question } = await askNext(run, isAdmin(user));
  return { state: towerState(r), question, best: await towerBest(user.id, user.grade) };
}

export async function answerTowerAction(
  runId: string,
  shownIndex: number,
): Promise<{ ok: boolean; correctIndex: number | null; state: TowerState; question: ClientQuestion | null; finish: TowerFinish | null } | { error: string }> {
  const r = await myRun(runId);
  if (!r) return { error: 'Играта не е намерена.' };
  let { run } = r;
  const { user } = r;
  if (run.phase !== 'question' || !run.questionId) return { error: 'Сега не е време за отговор.' };
  const q = await prisma.question.findUniqueOrThrow({ where: { id: run.questionId } });
  const elapsed = Date.now() - run.phaseAt.getTime();
  const late = elapsed > TOWER.QUESTION_MS + 1500;
  const idx = Number.isInteger(shownIndex) && shownIndex >= 0 && shownIndex < run.perm.length ? shownIndex : -1;
  const ok = !late && idx >= 0 && run.perm[idx] === q.correctIndex;
  const correctIndex = q.correctIndex != null ? run.perm.indexOf(q.correctIndex) : null;
  const log = [...((run.log as LogItem[]) ?? []), { prompt: q.prompt.slice(0, 200), chosen: idx >= 0 ? q.options[run.perm[idx]] : null, correct: q.correctIndex != null ? q.options[q.correctIndex] : '', ok }];
  await recordAnswers(prisma, user.id, [{ questionId: q.id, score: ok ? 1 : 0, correct: ok }]);

  if (ok) {
    const xpOk = (await xpAnswersToday(user.id)) < towerXpLimit;
    run = await prisma.towerRun.update({
      where: { id: run.id },
      data: { phase: 'drop', phaseAt: new Date(), correct: { increment: 1 }, xpAnswers: { increment: xpOk ? 1 : 0 }, log, questionId: null },
    });
    return { ok, correctIndex, state: towerState(run), question: null, finish: null };
  }
  const lives = run.lives - 1;
  run = await prisma.towerRun.update({ where: { id: run.id }, data: { wrong: { increment: 1 }, lives, log, questionId: null, ...(lives <= 0 ? { endReason: 'lives', phase: 'over' } : {}) } });
  if (lives <= 0) {
    const finish = await finishRun(run, 'lives', user.isGuest, user.id);
    return { ok, correctIndex, state: towerState({ ...run, status: 'DONE' }), question: null, finish };
  }
  const next = await askNext(run, isAdmin(user));
  return { ok, correctIndex, state: towerState(next.run), question: next.question, finish: null };
}

export async function dropTowerAction(
  runId: string,
  tClient: number,
): Promise<{ kind: DropKind; t: number; steadied: boolean; state: TowerState; question: ClientQuestion | null; finish: TowerFinish | null } | { error: string }> {
  const r = await myRun(runId);
  if (!r) return { error: 'Играта не е намерена.' };
  let { run } = r;
  const { user } = r;
  if (run.phase !== 'drop') return { error: 'Няма етаж за пускане.' };
  // времето на тапа трябва да е правдоподобно спрямо часовника на сървъра
  const elapsed = Date.now() - run.phaseAt.getTime();
  const lo = Math.max(0, elapsed - TOWER.DROP_GRACE_MS);
  const hi = Math.min(TOWER.DROP_MS, elapsed + 150);
  const t = elapsed > TOWER.DROP_MS + TOWER.DROP_GRACE_MS ? TOWER.DROP_MS : Math.min(hi, Math.max(lo, Number(tClient) || 0));
  const res = simulateDrop({ xs: run.xs, lean: run.lean, streak: run.streak, lives: run.lives }, t, run.seed);
  const n = res.next;
  const over = res.kind === 'collapse' || n.lives <= 0;
  run = await prisma.towerRun.update({
    where: { id: run.id },
    data: {
      xs: n.xs,
      lean: n.lean,
      streak: n.streak,
      lives: n.lives,
      perfects: { increment: res.kind === 'perfect' ? 1 : 0 },
      ...(over ? { phase: 'over', endReason: res.kind === 'collapse' ? 'collapse' : 'lives' } : {}),
    },
  });
  if (over) {
    const finish = await finishRun(run, run.endReason ?? 'lives', user.isGuest, user.id);
    return { kind: res.kind, t, steadied: res.steadied, state: towerState({ ...run, status: 'DONE' }), question: null, finish };
  }
  const next = await askNext(run, isAdmin(user));
  return { kind: res.kind, t, steadied: res.steadied, state: towerState(next.run), question: next.question, finish: null };
}

/** Отказ / излизане — приключва с построеното дотук. */
export async function quitTowerAction(runId: string): Promise<TowerFinish | null> {
  const r = await myRun(runId);
  if (!r) return null;
  return finishRun(r.run, 'quit', r.user.isGuest, r.user.id);
}

export async function towerReviewAction(runId: string): Promise<LogItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const run = await prisma.towerRun.findFirst({ where: { id: String(runId), userId: user.id } });
  return ((run?.log as LogItem[]) ?? []).slice(-60);
}


import 'server-only';
import type { Grade, TowerRun } from '@belmaster/db';
import { currentSeason, sofiaDay, TOWER, TOWER_THEMES, towerLevel, type TowerTheme } from '@belmaster/shared';
import { prisma } from './db';
import { toClient } from './quiz';
import type { ClientQuestion } from './quiz-types';

export interface TowerQuestionView {
  question: ClientQuestion;
  /** кога сървърът е задал въпроса (ms) — за таймера */
  askedAt: number;
}

export interface TowerState {
  runId: string;
  theme: TowerTheme;
  seed: number;
  phase: 'intro' | 'question' | 'drop' | 'over';
  phaseAt: number;
  xs: number[];
  lean: number;
  streak: number;
  lives: number;
  correct: number;
  wrong: number;
  perfects: number;
  endReason: string | null;
  xpEarned: number;
  serverNow: number;
}

export function towerState(run: TowerRun): TowerState {
  return {
    runId: run.id,
    theme: run.theme as TowerTheme,
    seed: run.seed,
    phase: run.phase as TowerState['phase'],
    phaseAt: run.phaseAt.getTime(),
    xs: run.xs,
    lean: run.lean,
    streak: run.streak,
    lives: run.lives,
    correct: run.correct,
    wrong: run.wrong,
    perfects: run.perfects,
    endReason: run.endReason,
    xpEarned: run.xpEarned,
    serverNow: Date.now(),
  };
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * Следващ въпрос: само с избор (А–Г), без текст за четене.
 * На всеки 10 етажа — по-трудни: изборът се стеснява към въпросите с по-нисък процент верни отговори.
 */
export async function pickTowerQuestion(grade: Grade, seen: string[], floors: number) {
  const base = { grade, status: 'ACTIVE' as const, type: 'SINGLE_CHOICE' as const, passageId: null };
  const sel = { id: true, answeredCount: true, correctCount: true, context: true } as const;
  // за 20 секунди не се чете дълъг текст — само кратки условия
  const short = <T extends { context: string | null }>(l: T[]) => l.filter((q) => !q.context || q.context.length <= 220);
  let pool = short(await prisma.question.findMany({ where: { ...base, id: { notIn: seen.slice(-400) } }, select: sel }));
  if (!pool.length) pool = short(await prisma.question.findMany({ where: base, select: sel }));
  if (!pool.length) return null;
  const level = towerLevel(floors);
  if (level > 0 && pool.length > 12) {
    // „лесно“ = висок дял верни; с малко данни всички са ~0,5
    const rate = (q: (typeof pool)[number]) => (q.correctCount + 1) / (q.answeredCount + 2);
    pool.sort((a, b) => rate(a) - rate(b));
    const keep = Math.max(12, Math.round(pool.length * Math.max(0.3, 1 - level * 0.18)));
    pool = pool.slice(0, keep);
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const q = await prisma.question.findUniqueOrThrow({ where: { id: pick.id }, include: { work: true } });
  const perm = shuffle(q.options.map((_, i) => i));
  const view = toClient(q);
  view.options = perm.map((i) => q.options[i]);
  return { question: view, perm, raw: q };
}

export function randomTheme(): TowerTheme {
  return TOWER_THEMES[Math.floor(Math.random() * TOWER_THEMES.length)];
}

/** Колко верни отговора днес вече са донесли XP в кулата. */
export async function xpAnswersToday(userId: string): Promise<number> {
  const today = sofiaDay();
  const runs = await prisma.towerRun.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 36 * 3600_000) } }, select: { createdAt: true, xpAnswers: true } });
  return runs.filter((r) => sofiaDay(r.createdAt) === today).reduce((s, r) => s + r.xpAnswers, 0);
}

export async function towerBest(userId: string, grade: Grade, season = 'all'): Promise<number> {
  const b = await prisma.towerBest.findUnique({ where: { userId_grade_season: { userId, grade, season } } });
  return b?.best ?? 0;
}

/** Записва рекорда за месеца и за всички времена (без гости). */
export async function saveTowerBest(userId: string, grade: Grade, floors: number) {
  for (const season of [currentSeason(), 'all']) {
    await prisma.towerBest.upsert({
      where: { userId_grade_season: { userId, grade, season } },
      update: {},
      create: { userId, grade, season, best: floors },
    });
    await prisma.towerBest.updateMany({ where: { userId, grade, season, best: { lt: floors } }, data: { best: floors } });
  }
}

export const towerXpLimit = TOWER.XP_DAILY_QUESTIONS;

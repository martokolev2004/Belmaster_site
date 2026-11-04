import 'server-only';
import { redirect } from 'next/navigation';
import type { Assignment, Submission, User } from '@belmaster/db';
import { answerSummary, scoreTeacherQuestion, type AnyAnswer, type TeacherQuestion } from '@belmaster/shared';
import { prisma } from './db';
import { isAdmin, requireUser } from './auth';

export function isTeacher(user: Pick<User, 'teacherStatus' | 'email' | 'isGuest'> | null | undefined): boolean {
  return !!user && (user.teacherStatus === 'APPROVED' || isAdmin(user));
}

export async function requireTeacher(): Promise<User> {
  const user = await requireUser({ allowNoGrade: true });
  if (!isTeacher(user)) redirect('/teacher');
  return user;
}

/** Известие до един или няколко потребители. */
export async function notify(userIds: string | string[], n: { title: string; body?: string; href?: string }) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: n.title, body: n.body ?? null, href: n.href ?? null })) });
}

export async function adminIds(): Promise<string[]> {
  const email = (process.env.ADMIN_EMAIL ?? 'm.kolev@bulinfo.org').toLowerCase();
  const rows = await prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Класът, ако е на този учител (админът вижда всички). */
export async function ownClass(user: User, classId: string) {
  const c = await prisma.schoolClass.findUnique({ where: { id: classId } });
  if (!c || (c.teacherId !== user.id && !isAdmin(user))) return null;
  return c;
}

export const questionsOf = (a: { questions: unknown }) => (Array.isArray(a.questions) ? (a.questions as TeacherQuestion[]) : []);
export const maxScoreOf = (qs: TeacherQuestion[]) => qs.reduce((s, q) => s + q.points, 0);

export type AssignmentState = 'upcoming' | 'open' | 'closed';
export function assignmentState(a: Pick<Assignment, 'opensAt' | 'closesAt'>, now = new Date()): AssignmentState {
  if (now < a.opensAt) return 'upcoming';
  if (now > a.closesAt) return 'closed';
  return 'open';
}

/** Краен срок за конкретен опит: по-ранното от затварянето и таймера. */
export function deadlineOf(a: Pick<Assignment, 'closesAt' | 'timeLimitMin'>, s: Pick<Submission, 'startedAt'>): Date {
  const close = a.closesAt.getTime();
  const timer = a.timeLimitMin ? s.startedAt.getTime() + a.timeLimitMin * 60_000 : Infinity;
  return new Date(Math.min(close, timer));
}

/** Пресмята точките на опит (автоматични + на учителя). */
export function computeScores(qs: TeacherQuestion[], answers: Record<string, AnyAnswer>, manual: Record<string, number>) {
  const auto: Record<string, number> = {};
  let score = 0;
  for (const q of qs) {
    const a = scoreTeacherQuestion(q, answers[q.id]);
    if (a != null) auto[q.id] = a;
    const m = manual[q.id];
    score += m != null ? m : a ?? 0;
  }
  return { auto, score: Math.round(score * 100) / 100, max: maxScoreOf(qs) };
}

/** Предава опитите, на които е изтекло времето (ученикът не е натиснал „Предай“). */
export async function finalizeExpired(a: Assignment) {
  const started = await prisma.submission.findMany({ where: { assignmentId: a.id, status: 'STARTED' } });
  const now = new Date();
  for (const s of started) {
    const dl = deadlineOf(a, s);
    if (now.getTime() < dl.getTime() + 60_000) continue;
    const qs = questionsOf(a);
    const { auto, score, max } = computeScores(qs, s.answers as Record<string, AnyAnswer>, s.manualScores as Record<string, number>);
    await prisma.submission.update({ where: { id: s.id }, data: { status: 'SUBMITTED', submittedAt: dl, autoScores: auto, score, maxScore: max } });
  }
}

export const needsManual = (qs: TeacherQuestion[]) => qs.some((q) => q.type === 'FREE_TEXT');

/** Статистика по въпросите: колко са сгрешили и най-честите грешни отговори. */
export function questionStats(qs: TeacherQuestion[], subs: Pick<Submission, 'answers' | 'autoScores' | 'manualScores'>[]) {
  return qs.map((q, i) => {
    let full = 0;
    let earned = 0;
    const wrong = new Map<string, number>();
    let blank = 0;
    for (const s of subs) {
      const ans = (s.answers as Record<string, AnyAnswer>)[q.id];
      const m = (s.manualScores as Record<string, number>)[q.id];
      const pts = m ?? (s.autoScores as Record<string, number>)[q.id] ?? 0;
      earned += pts;
      if (pts >= q.points - 1e-6) full++;
      else if (q.type !== 'FREE_TEXT') {
        const t = answerSummary(q, ans);
        if (t === '—') blank++;
        else wrong.set(t, (wrong.get(t) ?? 0) + 1);
      }
    }
    const n = subs.length;
    return {
      no: i + 1,
      id: q.id,
      prompt: q.prompt,
      points: q.points,
      type: q.type,
      n,
      fullCorrect: full,
      avgPct: n ? Math.round((earned / (n * q.points)) * 100) : 0,
      blank,
      wrongAnswers: [...wrong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, count]) => ({ text, count })),
    };
  });
}

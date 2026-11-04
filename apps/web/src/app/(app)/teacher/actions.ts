'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Grade, Question } from '@belmaster/db';
import {
  defaultTeacherPoints,
  displayAccepted,
  newClassCode,
  prepareTeacherQuestion,
  renderPunctuated,
  type BlanksData,
  type MatchingData,
  type PunctuationData,
  type TeacherQuestion,
} from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { adminIds, isTeacher, notify, ownClass, questionsOf, computeScores, maxScoreOf } from '@/lib/teacher';

const GRADES: Grade[] = ['G7', 'G10', 'G12'];
const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? '').trim().slice(0, max);

async function teacher() {
  const u = await getCurrentUser();
  if (!u || !isTeacher(u)) throw new Error('Само за учители.');
  return u;
}

// ───────────── заявка за учител ─────────────

export async function requestTeacherAction(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await getCurrentUser();
  if (!u || u.isGuest) return { error: 'Трябва да имаш профил (не гост).' };
  const school = str(fd.get('school'));
  const subject = str(fd.get('subject'));
  const email = str(fd.get('email'), 120);
  const note = str(fd.get('note'), 1000);
  if (school.length < 3) return { error: 'Напиши училището.' };
  if (subject.length < 2) return { error: 'Напиши предмета.' };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Служебният имейл не е валиден.' };
  await prisma.user.update({
    where: { id: u.id },
    data: { teacherStatus: 'PENDING', teacherSchool: school, teacherSubject: subject, teacherEmail: email || null, teacherNote: note || null, teacherAt: new Date() },
  });
  await notify(await adminIds(), { title: 'Нова заявка за учител', body: `${u.displayName} — ${school}, ${subject}`, href: '/admin/teachers' });
  revalidatePath('/teacher');
  return { ok: true };
}

export async function decideTeacherAction(userId: string, approve: boolean) {
  const u = await getCurrentUser();
  if (!u || !isAdmin(u)) return;
  await prisma.user.update({ where: { id: userId }, data: { teacherStatus: approve ? 'APPROVED' : 'REJECTED' } });
  await notify(userId, approve
    ? { title: 'Одобрен си като учител ✅', body: 'Вече можеш да правиш класове и тестове.', href: '/teacher' }
    : { title: 'Заявката ти за учител е отказана', body: 'Ако е грешка, пиши ни.', href: '/teacher' });
  revalidatePath('/admin/teachers');
}

// ───────────── класове ─────────────

async function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = newClassCode();
    if (!(await prisma.schoolClass.findUnique({ where: { code } }))) return code;
  }
  throw new Error('Опитай пак.');
}

export async function createClassAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const u = await teacher();
  const name = str(fd.get('name'), 40);
  const grade = str(fd.get('grade')) as Grade;
  const capacity = Number(fd.get('capacity'));
  if (!name) return { error: 'Напиши име на класа (напр. 12Б).' };
  if (!GRADES.includes(grade)) return { error: 'Избери клас.' };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) return { error: 'Броят ученици трябва да е между 1 и 60.' };
  const c = await prisma.schoolClass.create({ data: { teacherId: u.id, name, grade, capacity, code: await uniqueCode() } });
  redirect(`/teacher/classes/${c.id}`);
}

export async function updateClassAction(classId: string, data: { name?: string; capacity?: number }) {
  const u = await teacher();
  const c = await ownClass(u, classId);
  if (!c) return { error: 'Няма такъв клас.' };
  const approved = await prisma.classMember.count({ where: { classId, status: 'APPROVED' } });
  const capacity = data.capacity != null ? Math.round(data.capacity) : c.capacity;
  if (capacity < approved || capacity > 60) return { error: `Броят трябва да е между ${Math.max(1, approved)} и 60.` };
  await prisma.schoolClass.update({ where: { id: classId }, data: { name: data.name?.trim().slice(0, 40) || c.name, capacity } });
  revalidatePath(`/teacher/classes/${classId}`);
  return {};
}

export async function regenerateCodeAction(classId: string) {
  const u = await teacher();
  if (!(await ownClass(u, classId))) return;
  await prisma.schoolClass.update({ where: { id: classId }, data: { code: await uniqueCode() } });
  revalidatePath(`/teacher/classes/${classId}`);
}

export async function deleteClassAction(classId: string) {
  const u = await teacher();
  if (!(await ownClass(u, classId))) return;
  await prisma.schoolClass.delete({ where: { id: classId } });
  redirect('/teacher');
}

/** Одобрява ученици (един или всички чакащи), докато има места. */
export async function approveMembersAction(classId: string, memberIds: string[] | 'all'): Promise<{ approved: number; left: number }> {
  const u = await teacher();
  const c = await ownClass(u, classId);
  if (!c) return { approved: 0, left: 0 };
  const approvedNow = await prisma.classMember.count({ where: { classId, status: 'APPROVED' } });
  const free = Math.max(0, c.capacity - approvedNow);
  const pending = await prisma.classMember.findMany({
    where: { classId, status: 'PENDING', ...(memberIds === 'all' ? {} : { id: { in: memberIds } }) },
    orderBy: { createdAt: 'asc' },
  });
  const take = pending.slice(0, free);
  if (take.length) {
    await prisma.classMember.updateMany({ where: { id: { in: take.map((m) => m.id) } }, data: { status: 'APPROVED' } });
    await notify(take.map((m) => m.userId), { title: `Приет си в клас ${c.name} ✅`, body: 'Тук ще виждаш тестовете от учителя.', href: '/class' });
  }
  revalidatePath(`/teacher/classes/${classId}`);
  return { approved: take.length, left: pending.length - take.length };
}

export async function removeMemberAction(classId: string, memberId: string) {
  const u = await teacher();
  const c = await ownClass(u, classId);
  if (!c) return;
  const m = await prisma.classMember.findFirst({ where: { id: memberId, classId } });
  if (!m) return;
  await prisma.classMember.delete({ where: { id: m.id } });
  await notify(m.userId, { title: m.status === 'PENDING' ? `Заявката ти за клас ${c.name} е отказана` : `Премахнат си от клас ${c.name}`, href: '/class' });
  revalidatePath(`/teacher/classes/${classId}`);
}

// ───────────── тестове ─────────────

export interface SaveTestInput {
  id: string | null;
  title: string;
  grade: Grade;
  description: string;
  questions: TeacherQuestion[];
}

export async function saveTestAction(input: SaveTestInput): Promise<{ id?: string; errors?: { index: number; messages: string[] }[]; error?: string }> {
  const u = await teacher();
  const title = input.title.trim().slice(0, 120);
  if (!title) return { error: 'Напиши заглавие на теста.' };
  if (!GRADES.includes(input.grade)) return { error: 'Избери клас.' };
  if (!input.questions.length) return { error: 'Добави поне един въпрос.' };
  if (input.questions.length > 100) return { error: 'Най-много 100 въпроса.' };
  const errors: { index: number; messages: string[] }[] = [];
  const clean: TeacherQuestion[] = [];
  input.questions.forEach((q, i) => {
    const r = prepareTeacherQuestion(q);
    if (r.errors.length) errors.push({ index: i, messages: r.errors });
    clean.push(r.q);
  });
  if (errors.length) return { errors };
  const data = { title, grade: input.grade, description: input.description.trim().slice(0, 1000) || null, questions: clean as object[] };
  if (input.id) {
    const t = await prisma.teacherTest.findUnique({ where: { id: input.id } });
    if (!t || (t.teacherId !== u.id && !isAdmin(u))) return { error: 'Няма такъв тест.' };
    await prisma.teacherTest.update({ where: { id: t.id }, data });
    revalidatePath('/teacher');
    return { id: t.id };
  }
  const t = await prisma.teacherTest.create({ data: { ...data, teacherId: u.id } });
  revalidatePath('/teacher');
  return { id: t.id };
}

export async function duplicateTestAction(testId: string) {
  const u = await teacher();
  const t = await prisma.teacherTest.findUnique({ where: { id: testId } });
  if (!t || (t.teacherId !== u.id && !isAdmin(u))) return;
  const c = await prisma.teacherTest.create({
    data: { teacherId: u.id, title: `${t.title} (копие)`, grade: t.grade, description: t.description, questions: t.questions ?? [] },
  });
  redirect(`/teacher/tests/${c.id}`);
}

export async function deleteTestAction(testId: string) {
  const u = await teacher();
  const t = await prisma.teacherTest.findUnique({ where: { id: testId } });
  if (!t || (t.teacherId !== u.id && !isAdmin(u))) return;
  await prisma.teacherTest.delete({ where: { id: t.id } });
  redirect('/teacher');
}

/** Търсене във въпросите от матурите — за добавяне към теста. */
export async function searchBankAction(f: { grade: Grade; section?: string; examId?: string; text?: string; skip?: number }) {
  await teacher();
  const where: Record<string, unknown> = { grade: f.grade, status: 'ACTIVE' };
  if (f.section) where.section = f.section;
  if (f.examId) where.examId = f.examId;
  if (f.text?.trim()) where.OR = [{ prompt: { contains: f.text.trim(), mode: 'insensitive' } }, { context: { contains: f.text.trim(), mode: 'insensitive' } }];
  const [rows, total] = await Promise.all([
    prisma.question.findMany({ where, include: { exam: true, work: true, passage: true }, orderBy: [{ exam: { year: 'desc' } }, { sourceNo: 'asc' }], take: 30, skip: f.skip ?? 0 }),
    prisma.question.count({ where }),
  ]);
  return {
    total,
    items: rows.map((q) => ({
      label: [q.exam?.title, q.sourceNo ? `зад. ${q.sourceNo}` : null, q.work?.title].filter(Boolean).join(' · '),
      question: bankToTeacher(q),
    })),
  };
}

export async function bankFiltersAction(grade: Grade) {
  await teacher();
  return prisma.exam.findMany({ where: { grade }, orderBy: [{ year: 'desc' }], select: { id: true, title: true } });
}

function bankToTeacher(q: Question & { passage?: { title: string | null; text: string } | null }): TeacherQuestion {
  const d = q.data as { blanks?: BlanksData; punctuation?: PunctuationData } | null;
  // текстът за четене се добавя към контекста (без картинките)
  const passage = q.passage ? `${q.passage.title ? `${q.passage.title}\n\n` : ''}${q.passage.text.replace(/\[\[img:[^\]]+\]\]/g, '[диаграма — виж матурата]')}` : null;
  const context = [passage, q.context].filter(Boolean).join('\n\n') || null;
  const base = { id: crypto.randomUUID(), prompt: q.prompt, context, sourceQuestionId: q.id };
  let t: TeacherQuestion;
  switch (q.type) {
    case 'SINGLE_CHOICE':
      t = { ...base, type: 'SINGLE_CHOICE', options: q.options, correctIndex: q.correctIndex, points: 1 };
      break;
    case 'SHORT_ANSWER':
      t = { ...base, type: 'SHORT_ANSWER', acceptedAnswers: q.acceptedAnswers, answerCount: q.answerCount, points: 0 };
      break;
    case 'MATCHING':
      t = { ...base, type: 'MATCHING', matching: q.matching as unknown as MatchingData, points: 0 };
      break;
    case 'FILL_BLANKS':
      t = { ...base, type: 'FILL_BLANKS', context: passage, blanks: d?.blanks ?? null, points: 0 };
      break;
    case 'PUNCTUATION':
      t = {
        ...base,
        type: 'PUNCTUATION',
        punctText: d?.punctuation?.tokens.join(' ') ?? '',
        punctAnswer: d?.punctuation ? renderPunctuated(d.punctuation) : '',
        punctuation: d?.punctuation ?? null,
        points: 0,
      };
      break;
  }
  // точките: като в матурата, иначе по подразбиране
  t.points = q.points > 1 ? q.points : t.points || defaultTeacherPoints(t);
  if (t.type === 'SHORT_ANSWER' && !t.acceptedAnswers?.length) t.guide = displayAccepted(q.acceptedAnswers);
  return t;
}

// ───────────── задания ─────────────

export async function assignTestAction(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await teacher();
  const classId = str(fd.get('classId'));
  const testId = str(fd.get('testId'));
  const c = await ownClass(u, classId);
  if (!c) return { error: 'Няма такъв клас.' };
  const t = await prisma.teacherTest.findUnique({ where: { id: testId } });
  if (!t || (t.teacherId !== u.id && !isAdmin(u))) return { error: 'Избери тест.' };
  // датите идват като местно време (София) от <input type="datetime-local">
  const tz = Number(fd.get('tzOffset') ?? 0); // минути, като Date.getTimezoneOffset()
  const parse = (v: string) => (v ? new Date(new Date(`${v}:00Z`).getTime() + tz * 60_000) : null);
  const opensAt = parse(str(fd.get('opensAt'))) ?? new Date();
  const closesAt = parse(str(fd.get('closesAt')));
  if (!closesAt || closesAt <= opensAt) return { error: 'Крайният срок трябва да е след началото.' };
  const timer = str(fd.get('timeLimitMin'));
  const timeLimitMin = timer ? Number(timer) : null;
  if (timeLimitMin != null && (!Number.isInteger(timeLimitMin) || timeLimitMin < 1 || timeLimitMin > 600)) return { error: 'Таймерът трябва да е от 1 до 600 минути.' };
  const showResult = fd.get('showResult') === 'now';
  const a = await prisma.assignment.create({
    data: { classId, testId, title: t.title, questions: t.questions ?? [], opensAt, closesAt, timeLimitMin, showResult },
  });
  const students = await prisma.classMember.findMany({ where: { classId, status: 'APPROVED' }, select: { userId: true } });
  await notify(students.map((s) => s.userId), {
    title: `Нов тест: ${t.title}`,
    body: `От ${opensAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' })} до ${closesAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' })}`,
    href: `/class/${a.id}`,
  });
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true };
}

async function ownAssignment(assignmentId: string) {
  const u = await teacher();
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { class: true } });
  if (!a || (a.class.teacherId !== u.id && !isAdmin(u))) return null;
  return a;
}

export async function updateAssignmentAction(assignmentId: string, data: { closesAt?: string; tzOffset?: number }) {
  const a = await ownAssignment(assignmentId);
  if (!a || !data.closesAt) return { error: 'Грешка.' };
  const closesAt = new Date(new Date(`${data.closesAt}:00Z`).getTime() + (data.tzOffset ?? 0) * 60_000);
  if (closesAt <= a.opensAt) return { error: 'Срокът трябва да е след началото.' };
  await prisma.assignment.update({ where: { id: a.id }, data: { closesAt } });
  revalidatePath(`/teacher/assignments/${a.id}`);
  return {};
}

export async function deleteAssignmentAction(assignmentId: string) {
  const a = await ownAssignment(assignmentId);
  if (!a) return;
  await prisma.assignment.delete({ where: { id: a.id } });
  redirect(`/teacher/classes/${a.classId}`);
}

/** Учителят пише/променя точките на въпрос за един ученик. */
export async function gradeAction(submissionId: string, questionId: string, points: number | null) {
  const s = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!s) return { error: 'Няма такъв опит.' };
  const a = await ownAssignment(s.assignmentId);
  if (!a) return { error: 'Нямаш достъп.' };
  const qs = questionsOf(a);
  const q = qs.find((x) => x.id === questionId);
  if (!q) return { error: 'Няма такъв въпрос.' };
  const manual = { ...(s.manualScores as Record<string, number>) };
  if (points == null || Number.isNaN(points)) delete manual[questionId];
  else manual[questionId] = Math.max(0, Math.min(q.points, Math.round(points * 2) / 2));
  const { score, max } = computeScores(qs, s.answers as never, manual);
  await prisma.submission.update({ where: { id: s.id }, data: { manualScores: manual, score, maxScore: max } });
  revalidatePath(`/teacher/assignments/${a.id}`);
  return { score, max };
}

/** Пуска резултатите на учениците (известие до всеки, който е предал). */
export async function releaseResultsAction(assignmentId: string) {
  const a = await ownAssignment(assignmentId);
  if (!a) return;
  await prisma.assignment.update({ where: { id: a.id }, data: { releasedAt: new Date() } });
  const subs = await prisma.submission.findMany({ where: { assignmentId: a.id, status: 'SUBMITTED' }, select: { userId: true, score: true, maxScore: true } });
  for (const s of subs)
    await notify(s.userId, { title: `Резултат: ${a.title}`, body: `${s.score} от ${s.maxScore || maxScoreOf(questionsOf(a))} точки. Виж какво си сгрешил.`, href: `/class/${a.id}` });
  revalidatePath(`/teacher/assignments/${a.id}`);
}

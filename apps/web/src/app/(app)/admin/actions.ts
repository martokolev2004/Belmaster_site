'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { importQuestions, type ImportReport } from '@belmaster/db';
import { isGrade } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const SECTIONS = ['LANGUAGE', 'LITERATURE', 'READING'] as const;
const TOPICS = ['GRAMMAR', 'LEXIS', 'SPELLING', 'PUNCTUATION'] as const;
const TYPES = ['SINGLE_CHOICE', 'SHORT_ANSWER', 'MATCHING'] as const;
const STATUSES = ['ACTIVE', 'DRAFT', 'HIDDEN'] as const;

function pick<T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] {
  return (list as readonly string[]).includes(String(v)) ? (String(v) as T[number]) : fallback;
}
function lines(v: FormDataEntryValue | null): string[] {
  return String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

export async function saveQuestionAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const grade = form.get('grade');
  if (!isGrade(grade)) throw new Error('Невалиден клас');
  const section = pick(SECTIONS, form.get('section'), 'LANGUAGE');
  const type = pick(TYPES, form.get('type'), 'SINGLE_CHOICE');
  const options = type === 'SINGLE_CHOICE' ? lines(form.get('options')) : [];
  const ci = Number(form.get('correctIndex'));
  let matching: object | undefined;
  if (type === 'MATCHING') {
    const left = lines(form.get('mLeft'));
    const right = lines(form.get('mRight'));
    const pairs = String(form.get('mPairs') ?? '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((p) => ['А', 'Б', 'В', 'Г', 'Д', 'Е'].indexOf(p.toUpperCase()));
    matching = { left, right, pairs };
  }
  const data = {
    grade,
    section,
    topic: section === 'LANGUAGE' ? pick(TOPICS, form.get('topic'), 'GRAMMAR') : null,
    type,
    prompt: String(form.get('prompt') ?? '').trim(),
    context: str(form.get('context')),
    options,
    correctIndex: type === 'SINGLE_CHOICE' && Number.isInteger(ci) && ci >= 0 && ci < options.length ? ci : null,
    acceptedAnswers: type === 'SHORT_ANSWER' ? lines(form.get('acceptedAnswers')) : [],
    matching,
    explanation: str(form.get('explanation')),
    status: pick(STATUSES, form.get('status'), 'ACTIVE'),
    workId: section === 'LITERATURE' ? str(form.get('workId')) : null,
    passageId: section === 'READING' ? str(form.get('passageId')) : null,
    sourceNo: form.get('sourceNo') ? Number(form.get('sourceNo')) || null : null,
    sourceNote: str(form.get('sourceNote')),
  };
  if (!data.prompt) throw new Error('Липсва условие');
  if (id && id !== 'new') await prisma.question.update({ where: { id }, data });
  else await prisma.question.create({ data });
  revalidatePath('/admin/questions');
  redirect(String(form.get('back') || '/admin/questions'));
}

export async function deleteQuestionAction(form: FormData) {
  await requireAdmin();
  await prisma.question.delete({ where: { id: String(form.get('id')) } });
  revalidatePath('/admin/questions');
  redirect('/admin/questions');
}

const WORK_FIELDS = ['title', 'author', 'period', 'genre', 'year', 'summary', 'themes', 'characters', 'authorInfo', 'quotes', 'extra'] as const;

export async function saveWorkAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const grade = form.get('grade');
  if (!isGrade(grade)) throw new Error('Невалиден клас');
  const data: Record<string, unknown> = { grade, published: form.get('published') === 'on', sortOrder: Number(form.get('sortOrder')) || 0 };
  for (const f of WORK_FIELDS) data[f] = str(form.get(f));
  if (!data.title || !data.author) throw new Error('Заглавие и автор са задължителни');
  const saved =
    id && id !== 'new'
      ? await prisma.work.update({ where: { id }, data: data as never })
      : await prisma.work.create({ data: data as never });
  revalidatePath('/library');
  revalidatePath('/admin/works');
  redirect(`/admin/works/${saved.id}?saved=1`);
}

export async function deleteWorkAction(form: FormData) {
  await requireAdmin();
  await prisma.work.delete({ where: { id: String(form.get('id')) } });
  revalidatePath('/admin/works');
  redirect('/admin/works');
}

export async function deleteExamAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { examId: id } }),
    prisma.passage.deleteMany({ where: { examId: id } }),
    prisma.exam.delete({ where: { id } }),
  ]);
  revalidatePath('/admin/exams');
}

export async function savePassageAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id'));
  await prisma.passage.update({ where: { id }, data: { title: str(form.get('title')), text: String(form.get('text') ?? '') } });
  redirect(`/admin/passages/${id}?saved=1`);
}

export async function importAction(_: unknown, form: FormData): Promise<{ report?: ImportReport; error?: string }> {
  await requireAdmin();
  let raw = String(form.get('json') ?? '').trim();
  const file = form.get('file');
  if (file && typeof file === 'object' && 'text' in file && file.size > 0) raw = await file.text();
  if (!raw) return { error: 'Постави JSON или избери файл.' };
  try {
    const report = await importQuestions(prisma, JSON.parse(raw));
    revalidatePath('/admin');
    return { report };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Грешка при импорта.' };
  }
}

export async function setReportStatusAction(form: FormData) {
  await requireAdmin();
  const status = form.get('status') === 'RESOLVED' ? 'RESOLVED' : 'DISMISSED';
  await prisma.questionReport.update({ where: { id: String(form.get('id')) }, data: { status } });
  revalidatePath('/admin/reports');
}

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { questionsOf, requireTeacher } from '@/lib/teacher';
import { TestEditor } from './TestEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Тест' };

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTeacher();
  if (id === 'new') return <TestEditor initial={{ id: null, title: '', grade: user.grade ?? 'G12', description: '', questions: [] }} />;
  const t = await prisma.teacherTest.findUnique({ where: { id } });
  if (!t || (t.teacherId !== user.id && !isAdmin(user))) notFound();
  return <TestEditor initial={{ id: t.id, title: t.title, grade: t.grade, description: t.description ?? '', questions: questionsOf(t) }} />;
}

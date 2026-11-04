import { notFound } from 'next/navigation';
import { renderPunctuated, type QuestionData } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { QuestionForm } from './QuestionForm';

export default async function EditQuestion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  const { back } = await searchParams;
  const q = id === 'new' ? null : await prisma.question.findUnique({ where: { id }, include: { exam: true, reports: { where: { status: 'OPEN' } } } });
  if (id !== 'new' && !q) notFound();
  const [works, passages] = await Promise.all([
    prisma.work.findMany({ orderBy: [{ grade: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }], select: { id: true, grade: true, title: true, author: true } }),
    prisma.passage.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, grade: true, title: true, text: true } }),
  ]);
  return (
    <QuestionForm
      question={
        q
          ? (() => {
              const d = q.data as QuestionData;
              const L = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
              return {
                ...q,
                matching: q.matching as { left: string[]; right: string[]; pairs: number[] } | null,
                examTitle: q.exam?.title ?? null,
                openReports: q.reports.length,
                blanksText: d?.blanks?.text ?? null,
                blanksLines: d?.blanks ? d.blanks.blanks.map((b) => `${b.label}: ${b.options.map((o, i) => (i === b.correct ? `${o}*` : o)).join(' | ')}`).join('\n') : null,
                punctOriginal: d?.punctuation ? d.punctuation.tokens.join(' ') : null,
                punctAnswer: d?.punctuation ? renderPunctuated(d.punctuation) : null,
              };
            })()
          : null
      }
      works={works}
      passages={passages.map((p) => ({ id: p.id, grade: p.grade, label: p.title ?? p.text.slice(0, 60) + '…' }))}
      back={back ?? '/admin/questions'}
    />
  );
}

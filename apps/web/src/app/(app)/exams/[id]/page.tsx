import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { buildExamTest } from '@/lib/quiz';
import { QuizRunner } from '@/components/quiz/QuizRunner';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await buildExamTest(user.grade!, id);
  if (!data || !data.questions.length) notFound();
  return (
    <>
      <h1 className="mb-4 text-xl font-black">{data.exam.title}</h1>
      <QuizRunner kind="EXAM" examId={data.exam.id} mode="exam" title={data.exam.title} questions={data.questions} passages={data.passages} backHref="/exams" againHref={`/exams/${id}`} />
    </>
  );
}

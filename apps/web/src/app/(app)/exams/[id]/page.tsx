import { notFound } from 'next/navigation';
import { isAdmin, requireUser } from '@/lib/auth';
import { buildExamTest, withAdminHints } from '@/lib/quiz';
import { QuizRunner } from '@/components/quiz/QuizRunner';

export const dynamic = 'force-dynamic';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await buildExamTest(user.grade!, id);
  if (!data || !data.questions.length) notFound();
  // времето е пропорционално на истинската матура: 240 мин за 100 точки
  const maxPoints = data.questions.reduce((s, q) => s + q.points, 0);
  const timeLimitMin = Math.round((240 * maxPoints) / 100 / 5) * 5;
  return (
    <>
      <h1 className="mb-4 text-xl font-black">{data.exam.title}</h1>
      <QuizRunner kind="EXAM" examId={data.exam.id} mode="exam" title={data.exam.title} questions={await withAdminHints(data.questions, isAdmin(user))} passages={data.passages} backHref="/exams" againHref={`/exams/${id}`} timeLimitMin={timeLimitMin} />
    </>
  );
}

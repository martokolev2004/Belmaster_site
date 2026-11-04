import { notFound } from 'next/navigation';
import { TOPIC_LABELS } from '@belmaster/shared';
import { requireUser } from '@/lib/auth';
import { buildPracticeTest } from '@/lib/quiz';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { ButtonLink, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KINDS = { language: 'LANGUAGE', literature: 'LITERATURE', reading: 'READING' } as const;
const TITLES = { language: 'Език', literature: 'Литература', reading: 'Четене с разбиране' };

export default async function TestPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ topic?: string; work?: string }> }) {
  const { kind } = await params;
  const { topic, work } = await searchParams;
  if (!(kind in KINDS)) notFound();
  const k = kind as keyof typeof KINDS;
  const user = await requireUser();
  const { questions, passages } = await buildPracticeTest(user.grade!, KINDS[k], topic, work);
  const title = topic && topic in TOPIC_LABELS ? TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] : TITLES[k];

  if (!questions.length) {
    return (
      <EmptyState title="Още няма въпроси тук" icon={<span className="text-5xl">📚</span>}>
        <p>Въпросите от матурите за твоя клас скоро ще бъдат добавени.</p>
        <ButtonLink href="/tests" variant="outline" className="mt-5">
          Назад
        </ButtonLink>
      </EmptyState>
    );
  }
  const again = `/tests/${kind}${topic ? `?topic=${topic}` : work ? `?work=${work}` : ''}`;
  return <QuizRunner key={questions.map((q) => q.id).join()} kind={KINDS[k]} mode="practice" title={title} questions={questions} passages={passages} backHref="/tests" againHref={again} />;
}

import { notFound } from 'next/navigation';
import { TOPIC_LABELS } from '@belmaster/shared';
import { isAdmin, requireUser } from '@/lib/auth';
import { buildMistakesTest, buildPracticeTest, withAdminHints } from '@/lib/quiz';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { ButtonLink, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

const KINDS = { language: 'LANGUAGE', literature: 'LITERATURE', reading: 'READING', mistakes: 'MISTAKES' } as const;
const TITLES = { language: 'Език', literature: 'Литература', reading: 'Четене с разбиране', mistakes: 'Моите грешки' };

export default async function TestPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ topic?: string; work?: string }> }) {
  const { kind } = await params;
  const { topic, work } = await searchParams;
  if (!(kind in KINDS)) notFound();
  const k = kind as keyof typeof KINDS;
  const user = await requireUser();
  const { questions, passages } = k === 'mistakes' ? await buildMistakesTest(user.id, user.grade!) : await buildPracticeTest(user.grade!, KINDS[k] as 'LANGUAGE' | 'LITERATURE' | 'READING', topic, work);
  const title = topic && topic in TOPIC_LABELS ? TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] : TITLES[k];

  if (!questions.length) {
    return (
      <EmptyState title={k === 'mistakes' ? 'Нямаш грешки за преговор 🎉' : 'Още няма въпроси тук'} icon={<span className="text-5xl">{k === 'mistakes' ? '✅' : '📚'}</span>}>
        <p>{k === 'mistakes' ? 'Тук се събират въпросите, на които си сгрешил. След верен отговор въпросът се връща след 1 ден, после след 3 и после след 7 дни — така се запомня трайно. След 4 верни отговора подред изчезва.' : 'Въпросите от матурите за твоя клас скоро ще бъдат добавени.'}</p>
        <ButtonLink href="/tests" variant="outline" className="mt-5">
          Назад
        </ButtonLink>
      </EmptyState>
    );
  }
  const again = `/tests/${kind}${topic ? `?topic=${topic}` : work ? `?work=${work}` : ''}`;
  return <QuizRunner key={questions.map((q) => q.id).join()} kind={KINDS[k]} mode="practice" title={title} questions={await withAdminHints(questions, isAdmin(user))} passages={passages} backHref="/tests" againHref={again} />;
}

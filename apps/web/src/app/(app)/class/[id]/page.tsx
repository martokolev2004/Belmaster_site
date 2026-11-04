import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { answerSummary, publicTeacherQuestion, teacherCorrectText, type AnyAnswer } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assignmentState, deadlineOf, finalizeExpired, maxScoreOf, questionStats, questionsOf } from '@/lib/teacher';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AssignmentRunner, StartButton } from './AssignmentRunner';

export const dynamic = 'force-dynamic';
const fmt = (d: Date) => d.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' });

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const m = await prisma.classMember.findUnique({ where: { userId: user.id } });
  if (!m || m.status !== 'APPROVED') notFound();
  const a = await prisma.assignment.findFirst({ where: { id, classId: m.classId }, include: { test: { select: { description: true } } } });
  if (!a) notFound();
  await finalizeExpired(a);
  const s = await prisma.submission.findUnique({ where: { assignmentId_userId: { assignmentId: a.id, userId: user.id } } });
  const qs = questionsOf(a);
  const max = maxScoreOf(qs);
  const st = assignmentState(a);
  const back = (
    <Link href="/class" className="mb-4 inline-flex items-center gap-1 font-bold text-secondary">
      <ArrowLeft className="size-4" /> Моят клас
    </Link>
  );

  // решава в момента
  if (s?.status === 'STARTED') {
    const dl = deadlineOf(a, s);
    return (
      <>
        <h1 className="mb-4 text-xl font-black">{a.title}</h1>
        <AssignmentRunner
          assignmentId={a.id}
          questions={qs.map(publicTeacherQuestion)}
          initialAnswers={s.answers as Record<string, AnyAnswer>}
          deadline={dl.getTime()}
          serverNow={Date.now()}
          showTimer={!!a.timeLimitMin || dl.getTime() - Date.now() < 3 * 3_600_000}
        />
      </>
    );
  }

  // не е започнал
  if (!s) {
    return (
      <div className="mx-auto max-w-xl">
        {back}
        <Card className="text-center">
          <h1 className="text-2xl font-black">{a.title}</h1>
          {a.test?.description && <p className="mt-2 whitespace-pre-line text-muted">{a.test.description}</p>}
          <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm">
            <li>📝 {qs.length} въпроса · {max} точки</li>
            <li>⏱ {a.timeLimitMin ? `${a.timeLimitMin} минути от момента, в който започнеш` : 'Без таймер'}</li>
            <li>📅 До {fmt(a.closesAt)}</li>
            <li>⚠️ Имаш само <b>един опит</b>. Отговорите се запазват сами.</li>
            <li>{a.showResult ? '✅ Резултатът се вижда веднага след предаване.' : '🔒 Резултата ще видиш, когато учителят го пусне.'}</li>
          </ul>
          <div className="mt-6">
            {st === 'open' ? (
              <StartButton assignmentId={a.id} />
            ) : st === 'upcoming' ? (
              <p className="font-bold text-muted">Отваря се на {fmt(a.opensAt)}.</p>
            ) : (
              <p className="font-bold text-error">Срокът изтече — не си решил този тест.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // предаден
  const visible = a.showResult || !!a.releasedAt;
  if (!visible) {
    return (
      <div className="mx-auto max-w-xl">
        {back}
        <Card className="text-center">
          <p className="text-4xl">📬</p>
          <h1 className="mt-2 text-2xl font-black">Тестът е предаден</h1>
          <p className="mt-1 text-muted">Учителят ще провери и ще пусне резултатите. Ще получиш известие.</p>
        </Card>
      </div>
    );
  }

  const answers = s.answers as Record<string, AnyAnswer>;
  const auto = s.autoScores as Record<string, number>;
  const manual = s.manualScores as Record<string, number>;
  const pct = max ? Math.round((s.score / max) * 100) : 0;
  let classStats: ReturnType<typeof questionStats> | null = null;
  if (a.releasedAt) {
    const all = await prisma.submission.findMany({ where: { assignmentId: a.id, status: 'SUBMITTED' } });
    if (all.length >= 2) classStats = questionStats(qs, all).filter((x) => x.avgPct < 100).sort((x, y) => x.avgPct - y.avgPct).slice(0, 5);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {back}
      <div className="animate-pop text-center">
        <h1 className="text-3xl font-black">{a.title}</h1>
        <p className="mt-3 text-5xl font-black text-ink-strong">
          {s.score}
          <span className="text-2xl text-muted">/{max}</span>
        </p>
        <p className="font-bold text-muted">{pct}%</p>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-black">Какво си сгрешил</h2>
      <ol className="space-y-3">
        {qs.map((q, i) => {
          const pts = manual[q.id] ?? auto[q.id] ?? 0;
          const ok = pts >= q.points - 1e-6;
          const pendingFree = q.type === 'FREE_TEXT' && manual[q.id] == null;
          return (
            <li key={q.id} className={cn('card3d rounded-2xl bg-surface p-4', ok ? 'border-primary/40!' : pts > 0 ? 'border-orange/40!' : 'border-error/40!')}>
              <div className="flex items-start gap-3">
                <p className="flex-1 whitespace-pre-line font-bold">
                  {i + 1}. {q.prompt}
                </p>
                <span className={cn('shrink-0 rounded-lg px-2 py-0.5 text-sm font-black', ok ? 'bg-primary/15 text-primary-dark' : pts > 0 ? 'bg-orange/15 text-orange' : 'bg-error/15 text-error-dark')}>
                  {pts}/{q.points}
                </span>
              </div>
              {pendingFree && <p className="mt-1 text-xs font-bold text-orange">Учителят не е проверил този отговор.</p>}
              <p className="mt-1 whitespace-pre-line text-sm">
                <span className="font-extrabold text-muted">Твоят отговор: </span>
                {answerSummary(q, answers[q.id])}
              </p>
              {!ok && q.type !== 'FREE_TEXT' && (
                <p className="mt-1 whitespace-pre-line text-sm text-primary-dark">
                  <span className="font-extrabold">Верен отговор: </span>
                  {teacherCorrectText(q)}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {classStats && classStats.length > 0 && (
        <Card className="mt-8">
          <h2 className="mb-1 text-lg font-black">Най-често сгрешени в класа</h2>
          <p className="mb-3 text-sm text-muted">Без имена — само колко хора са сгрешили и как.</p>
          <ul className="space-y-3">
            {classStats.map((x) => (
              <li key={x.id} className="rounded-xl bg-surface-2 p-3">
                <p className="font-bold">
                  {x.no}. {x.prompt} <span className="text-sm font-black text-error-dark">· {x.avgPct}% среден резултат</span>
                </p>
                {x.wrongAnswers.length > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    Чести грешни отговори: {x.wrongAnswers.map((w) => `„${w.text}“ (${w.count})`).join(', ')}
                  </p>
                )}
                {x.blank > 0 && <p className="text-sm text-muted">Без отговор: {x.blank}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

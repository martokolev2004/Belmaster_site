'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Check, Flag, Flame, Trophy, X } from 'lucide-react';
import { Avatar, Badge, Button, ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Answer, ClientQuestion, QuestionResult } from '@/lib/quiz-types';
import { notifyProgress } from '@/components/unlocks/UnlockCelebration';
import { checkAnswerAction, finishSurvivalAction, nextSurvivalAction } from '@/app/(app)/tests/actions';
import { correctAnswerText, QuestionInput, ReportDialog } from './QuizRunner';
import { hasAnswer } from './inputs';
import { ContextBox } from './ContextBox';

interface TopRow {
  userId: string;
  name: string;
  avatar: unknown;
  score: number;
}

type Done = { streak: number; best: number; record: boolean; xpEarned: number };

export function SurvivalRunner({ best: initialBest, top, meId }: { best: number; top: TopRow[]; meId: string }) {
  const [phase, setPhase] = useState<'start' | 'play' | 'done'>('start');
  const [q, setQ] = useState<ClientQuestion | null>(null);
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [log, setLog] = useState<{ id: string; answer: Answer }[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const [empty, setEmpty] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const streak = log.length - (result && !result.correct ? 1 : 0);

  const load = (seen: string[]) =>
    start(async () => {
      const next = await nextSurvivalAction(seen);
      if (!next) {
        if (!seen.length) setEmpty(true);
        else finish(log);
        return;
      }
      setQ(next);
      setAnswer(undefined);
      setResult(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

  const begin = () => {
    setLog([]);
    setDone(null);
    setPhase('play');
    load([]);
  };

  const finish = (entries: { id: string; answer: Answer }[]) =>
    start(async () => {
      const r = await finishSurvivalAction(entries);
      if ('error' in r) return;
      setDone(r);
      setPhase('done');
      window.scrollTo({ top: 0 });
      notifyProgress(1800);
    });

  const check = () =>
    start(async () => {
      if (!q || !answer) return;
      const r = await checkAnswerAction(q.id, answer);
      if (!r) return;
      setResult(r);
      setLog((prev) => [...prev, { id: q.id, answer }]);
    });

  const next = () => {
    if (!result || !q) return;
    if (result.correct) load(log.map((l) => l.id));
    else finish(log);
  };

  useEffect(() => {
    if (phase !== 'play' || !q) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (q.type === 'SINGLE_CHOICE' && tag !== 'INPUT' && /^[1-6]$/.test(e.key) && !result) {
        const i = Number(e.key) - 1;
        if (i < q.options.length) setAnswer({ index: i });
      }
      if (e.key === 'Enter' && !pending) {
        e.preventDefault();
        if (result) next();
        else if (hasAnswer(q, answer)) check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (empty)
    return (
      <div className="card3d mx-auto max-w-lg rounded-2xl bg-surface p-8 text-center">
        <p className="text-5xl">📚</p>
        <p className="mt-3 text-muted">Още няма въпроси за твоя клас.</p>
        <ButtonLink href="/tests" variant="outline" className="mt-5">
          Назад
        </ButtonLink>
      </div>
    );

  if (phase === 'start' || phase === 'done') {
    const best = done?.best ?? initialBest;
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div className="card3d rounded-3xl bg-surface p-6 text-center">
          {phase === 'done' && done ? (
            <>
              <p className="text-6xl">{done.record ? '🏆' : done.streak >= 10 ? '🔥' : '💥'}</p>
              <h1 className="mt-2 text-3xl font-black text-ink-strong">{done.record ? 'Нов рекорд!' : 'Край на серията'}</h1>
              <p className="mt-1 text-muted">Поредни верни отговори</p>
              <p className="mt-2 text-7xl font-black tabular-nums text-orange">{done.streak}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Badge tone="yellow">Рекорд: {best}</Badge>
                {done.xpEarned > 0 && <Badge tone="green">+{done.xpEarned} XP</Badge>}
              </div>
            </>
          ) : (
            <>
              <p className="text-6xl">🔥</p>
              <h1 className="mt-2 text-3xl font-black text-ink-strong">До първа грешка</h1>
              <p className="mt-2 text-muted">Въпроси по език и литература един след друг. Колко поредни верни ще отговориш? Една грешка — и серията свършва.</p>
              <div className="mt-4 flex justify-center">
                <Badge tone="yellow">
                  <Trophy className="mr-1 inline size-4" />
                  Твоят рекорд: {best}
                </Badge>
              </div>
            </>
          )}
          <div className="mt-6 grid gap-2">
            <Button block size="lg" onClick={begin} disabled={pending} icon={<Flame className="size-5" />}>
              {phase === 'done' ? 'Още веднъж' : 'Започни'}
            </Button>
            <ButtonLink href="/tests" block variant="outline">
              Към тестовете
            </ButtonLink>
          </div>
        </div>

        <div className="card3d rounded-2xl bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-ink-strong">
            <Trophy className="size-5 text-accent" /> Най-дълги серии
          </h2>
          {top.length ? (
            <ol className="space-y-2">
              {top.map((r, i) => (
                <li key={r.userId} className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5', r.userId === meId && 'bg-secondary/10')}>
                  <span className="w-6 text-center font-black text-muted">{i + 1}</span>
                  <Avatar name={r.name} avatar={r.avatar as never} seed={r.userId} size={32} />
                  <span className="flex-1 truncate font-bold">{r.name}</span>
                  <span className="font-black tabular-nums text-orange">🔥 {r.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Още никой не е играл. Бъди първият!</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/tests" aria-label="Изход" className="rounded-xl p-1.5 text-muted hover:bg-surface-2">
          <X className="size-6" />
        </Link>
        <span className="flex-1" />
        <span className={cn('flex items-center gap-1.5 rounded-2xl bg-orange/15 px-3 py-1.5 text-lg font-black tabular-nums text-orange', result?.correct && 'animate-pop')}>
          <Flame className="size-5" /> {streak}
        </span>
        <span className="flex items-center gap-1 text-sm font-extrabold text-muted">
          <Trophy className="size-4" /> {Math.max(initialBest, streak)}
        </span>
      </div>

      {q ? (
        <section key={q.id} className="animate-rise">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{q.label}</Badge>
            {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
          </div>
          <h2 className="whitespace-pre-line text-xl font-extrabold leading-snug md:text-2xl">{q.prompt}</h2>
          {q.context && <ContextBox text={q.context} />}
          <div className="mt-6">
            <QuestionInput q={q} answer={answer} result={result ?? undefined} onAnswer={setAnswer} />
          </div>
        </section>
      ) : (
        <p className="py-20 text-center text-muted">Зареждане…</p>
      )}

      <div className={cn('fixed inset-x-0 bottom-0 z-40 border-t-2 md:left-64', result ? (result.correct ? 'border-primary/30 bg-[#d7ffb8] dark:bg-[#1f3a12]' : 'border-error/30 bg-[#ffdfe0] dark:bg-[#3a1717]') : 'border-line bg-bg')}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          {result && q ? (
            <div className="flex items-start gap-3">
              <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-white', result.correct ? 'text-primary' : 'text-error')}>
                {result.correct ? <Check className="size-7" strokeWidth={3} /> : <X className="size-7" strokeWidth={3} />}
              </span>
              <div>
                <p className={cn('text-xl font-black', result.correct ? 'text-primary-dark' : 'text-error-dark')}>{result.correct ? `Вярно! Серия: ${streak}` : 'Грешка — серията свършва'}</p>
                {!result.correct && <p className="font-bold text-error-dark">Верен отговор: {correctAnswerText(q, result)}</p>}
                {result.explanation && <p className="mt-1 text-sm text-ink">{result.explanation}</p>}
                <button onClick={() => setReportFor(q.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted hover:underline">
                  <Flag className="size-3" /> Докладвай въпроса
                </button>
              </div>
            </div>
          ) : (
            <span className="hidden text-sm text-muted sm:block">Натисни Enter, за да провериш.</span>
          )}
          {result ? (
            <Button onClick={next} variant={result.correct ? 'primary' : 'danger'} size="lg" className="sm:min-w-44" disabled={pending}>
              {result.correct ? (pending ? '…' : 'Следващ') : pending ? '…' : 'Виж резултата'}
            </Button>
          ) : (
            <Button onClick={check} size="lg" className="sm:min-w-44" disabled={!q || !hasAnswer(q, answer) || pending}>
              {pending ? '…' : 'Провери'}
            </Button>
          )}
        </div>
      </div>
      <div className="h-40" />
      {reportFor && <ReportDialog questionId={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

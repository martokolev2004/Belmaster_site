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
import { Confetti } from '@/components/game/BattleExtras';
import { play } from '@/lib/sound';
import './quiz.css';

/** степените на пламъка: от колко поредни, име и цвят */
const TIERS = [
  { from: 0, name: 'Искра', color: '#ffb020' },
  { from: 5, name: 'Пламък', color: '#ff7a3c' },
  { from: 10, name: 'Огън', color: '#ff3d5a' },
  { from: 20, name: 'Пожар', color: '#b86bff' },
];
const tierOf = (n: number) => [...TIERS].reverse().find((t) => n >= t.from)!;

function Fire({ n, out = false }: { n: number; out?: boolean }) {
  const t = tierOf(n);
  return (
    <div className="sv-fire" data-out={out} style={{ '--s': 0.7 + Math.min(n, 25) * 0.024, '--f': t.color } as React.CSSProperties}>
      <svg viewBox="0 0 84 100" aria-hidden>
        <path d="M42 2C50 22 74 34 74 62a32 32 0 0 1-64 0C10 44 22 36 26 20c6 8 8 14 8 20C40 30 44 18 42 2Z" fill={t.color} />
        <path d="M42 38c5 12 18 18 18 32a18 18 0 0 1-36 0c0-9 6-13 8-21 3 4 4 7 4 10 3-5 7-11 6-21Z" fill="#ffe08a" />
      </svg>
      <b className="ln-display">{n}</b>
    </div>
  );
}

function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + 200;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function DoneCard({ done, best }: { done: Done; best: number }) {
  const n = useCountUp(done.streak);
  const t = tierOf(done.streak);
  useEffect(() => {
    const id = setTimeout(() => play(done.record ? 'win' : 'lose'), 900);
    return () => clearTimeout(id);
  }, [done.record]);
  return (
    <>
      {done.record && <Confetti />}
      <p className="ln-eyebrow" style={{ justifyContent: 'center' }}>{done.record ? 'Нов рекорд!' : 'Край на серията'}</p>
      <p className="sv-big ln-display mt-3">{n}</p>
      <p className="mt-2 font-extrabold text-white">поредни верни · степен „{t.name}“</p>
      <div className="sv-race mx-auto mt-5 max-w-xs" style={{ '--f': t.color } as React.CSSProperties}>
        <i style={{ width: `${Math.min(100, (n / Math.max(1, best)) * 100)}%` }} />
        <em style={{ left: '100%' }}>🏆</em>
      </div>
      <p className="mt-3 text-sm font-bold text-muted">
        {done.record ? `Стар рекорд: счупен. Новият е ${best}.` : `Рекордът ти е ${best} — оставаха още ${Math.max(1, best - done.streak + 1)}.`}
        {done.xpEarned > 0 && <span className="ml-2 text-accent">+{done.xpEarned} XP</span>}
      </p>
    </>
  );
}

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
  const [fx, setFx] = useState<{ k: 'ok' | 'bad'; n: number; toast: string | null } | null>(null);
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
      const s = log.length + (r.correct ? 1 : 0);
      play(r.correct ? 'correct' : 'wrong');
      const up = TIERS.find((t) => t.from === s && s > 0);
      const toast = !r.correct ? null : s === initialBest + 1 && initialBest > 0 ? '🏆 Нов рекорд!' : up ? `🔥 ${up.name}!` : null;
      if (toast) setTimeout(() => play('levelup'), 250);
      setFx((f) => ({ k: r.correct ? 'ok' : 'bad', n: (f?.n ?? 0) + 1, toast }));
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
      <div className="mx-auto max-w-lg space-y-4">
        <div className="nx-panel sv-card animate-rise">
          {phase === 'done' && done ? (
            <DoneCard done={done} best={best} />
          ) : (
            <>
              <div className="flex justify-center">
                <Fire n={best} />
              </div>
              <h1 className="ln-display mt-4 text-3xl">До първа грешка</h1>
              <p className="mt-2 text-muted">Въпроси по език и литература един след друг. Колко поредни верни ще отговориш? Една грешка — и пламъкът угасва.</p>
              <p className="mt-3 font-extrabold text-white">
                <Trophy className="mr-1 inline size-4 text-accent" />
                Твоят рекорд: {best}
              </p>
              <div className="sv-tiers">
                {TIERS.map((t) => (
                  <div key={t.name} style={{ '--f': t.color } as React.CSSProperties}>
                    <b>{t.name}</b>
                    от {t.from}
                  </div>
                ))}
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

        <div className="nx-panel p-5">
          <h2 className="ln-display mb-3 flex items-center gap-2 text-base">
            <Trophy className="size-5 text-accent" /> Най-дълги серии
          </h2>
          {top.length ? (
            <ol className="sv-list">
              {top.map((r, i) => (
                <li key={r.userId} data-me={r.userId === meId}>
                  <span>{i + 1}</span>
                  <Avatar name={r.name} avatar={r.avatar as never} seed={r.userId} size={32} />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="font-black tabular-nums" style={{ color: tierOf(r.score).color }}>🔥 {r.score}</span>
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

  const tier = tierOf(streak);
  const nextTier = TIERS.find((t) => t.from > streak);
  const goal = initialBest > 0 && streak <= initialBest ? initialBest + 1 : nextTier?.from ?? streak + 5;
  const out = !!result && !result.correct;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="sv-glow" style={{ '--f': tier.color, '--o': out ? 0 : Math.min(1, 0.25 + streak * 0.05) } as React.CSSProperties} />
      <div className="sv-top" style={{ '--f': tier.color } as React.CSSProperties}>
        <Link href="/tests" aria-label="Изход" className="rounded-xl p-1.5 text-muted hover:bg-surface-2">
          <X className="size-6" />
        </Link>
        <Fire n={streak} out={out} />
        <div className="sv-meta">
          <p className="sv-tier">{out ? 'Угасна' : tier.name}</p>
          <div className="sv-race">
            <i style={{ width: `${Math.min(100, (streak / goal) * 100)}%` }} />
            <em style={{ left: '100%' }}>{initialBest > 0 && streak <= initialBest ? '🏆' : '🔥'}</em>
          </div>
          <small>
            {initialBest > 0 && streak <= initialBest
              ? `Още ${goal - streak} до нов рекорд (сега ${initialBest})`
              : initialBest > 0
                ? `Нов рекорд! Всеки верен го вдига.`
                : nextTier
                  ? `Още ${nextTier.from - streak} до „${nextTier.name}“`
                  : 'Най-високата степен'}
          </small>
        </div>
      </div>
      {fx && result && <div key={`f${fx.n}`} className="qz-flash" data-k={fx.k} />}
      {fx?.toast && result && (
        <div key={`t${fx.n}`} className="qz-toast">
          {fx.toast}
        </div>
      )}

      {q ? (
        <section key={q.id} className="relative z-[1] animate-rise">
         <div key={fx && result ? fx.n : 0} className={fx && result ? (fx.k === 'bad' ? 'qz-shake' : 'qz-bump') : undefined}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="blue">{q.label}</Badge>
            {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
          </div>
          <h2 className="whitespace-pre-line text-xl font-extrabold leading-snug md:text-2xl">{q.prompt}</h2>
          {q.context && <ContextBox text={q.context} />}
          <div className="mt-6">
            <QuestionInput q={q} answer={answer} result={result ?? undefined} onAnswer={setAnswer} />
          </div>
         </div>
        </section>
      ) : (
        <p className="py-20 text-center text-muted">Зареждане…</p>
      )}

      <div key={result && q ? `r${q.id}` : 'idle'} data-k={result ? (result.correct ? 'ok' : 'bad') : undefined} className={cn('fixed inset-x-0 bottom-0 z-40 border-t-2 md:left-64', result ? 'qz-bar' : 'border-line bg-bg')}>
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          {result && q ? (
            <div className="flex items-start gap-3">
              <span className="qz-ic" data-k={result.correct ? 'ok' : 'bad'}>
                {result.correct ? <Check className="size-7" strokeWidth={3.5} /> : <X className="size-7" strokeWidth={3.5} />}
                {result.correct &&
                  Array.from({ length: 12 }, (_, i) => {
                    const a = (i / 12) * Math.PI * 2;
                    return <b key={i} style={{ '--dx': `${Math.cos(a) * 52}px`, '--dy': `${Math.sin(a) * 52}px`, '--c': ['#ffd166', '#fff', '#ff9d3c'][i % 3] } as React.CSSProperties} />;
                  })}
              </span>
              <div>
                <p className="text-xl font-black text-white">{result.correct ? `Вярно! Серия: ${streak}` : 'Грешка — пламъкът угасна'}</p>
                {!result.correct && <p className="font-bold text-white/90">Верен отговор: {correctAnswerText(q, result)}</p>}
                {result.explanation && <p className="mt-1 text-sm text-white/80">{result.explanation}</p>}
                <button onClick={() => setReportFor(q.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-white/60 hover:underline">
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

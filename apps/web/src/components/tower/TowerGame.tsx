'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Heart, Trophy, X } from 'lucide-react';
import { simulateDrop, TOWER, type DropKind } from '@belmaster/shared';
import { Avatar, Badge, Button, ButtonLink } from '@/components/ui';
import { AnswerInput } from '@/components/quiz/inputs';
import { ContextBox } from '@/components/quiz/ContextBox';
import { Confetti } from '@/components/game/BattleExtras';
import { notifyProgress } from '@/components/unlocks/UnlockCelebration';
import { cn } from '@/lib/cn';
import { play } from '@/lib/sound';
import type { ClientQuestion } from '@/lib/quiz-types';
import type { TowerState } from '@/lib/tower';
import { answerTowerAction, beginTowerAction, dropTowerAction, quitTowerAction, startTowerAction, towerReviewAction, type TowerFinish } from '@/app/(app)/tower/actions';
import { TowerStage, type TowerStageApi } from './TowerStage';

interface TopRow {
  userId: string;
  name: string;
  avatar: unknown;
  score: number;
}

export function TowerGame({ best: bestAll, monthBest, top, meId, isGuest }: { best: number; monthBest: number; top: TopRow[]; meId: string; isGuest: boolean }) {
  const [screen, setScreen] = useState<'start' | 'play' | 'over'>('start');
  const [st, setSt] = useState<TowerState | null>(null);
  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [qStart, setQStart] = useState(0);
  const [dropStart, setDropStart] = useState(0);
  const [feedback, setFeedback] = useState<{ shown: number; correctIndex: number | null; ok: boolean } | null>(null);
  /** върви анимация на пускане (видът му — за брояча) */
  const [anim, setAnim] = useState<DropKind | null>(null);
  const [ready, setReady] = useState(0);
  const stage = useRef<TowerStageApi | null>(null);
  const dropping = useRef(false);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | 'info'; at: number } | null>(null);
  const [finish, setFinish] = useState<TowerFinish | null>(null);
  const [best, setBest] = useState(bestAll);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = useDesktop();

  // кадри
  useEffect(() => {
    if (screen !== 'play') return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  const say = (text: string, tone: 'good' | 'bad' | 'info') => setToast({ text, tone, at: performance.now() });

  const applyState = useCallback((s: TowerState, q: ClientQuestion | null) => {
    setSt(s);
    setQuestion(q);
    const t = performance.now();
    if (q) setQStart(t);
    if (s.phase === 'drop') setDropStart(t);
  }, []);

  const end = useCallback((f: TowerFinish, delay: number) => {
    setTimeout(() => {
      setFinish(f);
      setBest(f.best);
      setScreen('over');
      play(f.record ? 'win' : 'lose');
      notifyProgress(2200);
    }, delay);
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await startTowerAction();
    setBusy(false);
    if ('error' in r) return setError(r.error);
    setFinish(null);
    setFeedback(null);
    setAnim(null);
    dropping.current = false;
    applyState(r.state, r.question);
    setScreen('play');
  };

  const begin = async () => {
    if (!st || busy) return;
    setBusy(true);
    const r = await beginTowerAction(st.runId);
    setBusy(false);
    if ('error' in r) return setError(r.error);
    applyState(r.state, r.question);
  };

  const answer = async (shown: number) => {
    if (!st || !question || busy || feedback) return;
    setBusy(true);
    const r = await answerTowerAction(st.runId, shown);
    setBusy(false);
    if ('error' in r) return setError(r.error);
    setFeedback({ shown, correctIndex: r.correctIndex, ok: r.ok });
    if (r.ok) {
      play('correct');
      say('Вярно! Пусни етажа', 'good');
    } else {
      play('wrong');
      stage.current?.hurt();
      say(shown < 0 ? 'Времето изтече! −1 ❤' : 'Грешно! −1 ❤', 'bad');
    }
    setTimeout(
      () => {
        setFeedback(null);
        if (r.finish) {
          setSt(r.state);
          setQuestion(null);
          end(r.finish, 300);
        } else applyState(r.state, r.question);
      },
      r.ok ? 650 : 1400,
    );
  };

  const drop = useCallback(() => {
    if (!st || st.phase !== 'drop' || dropping.current) return;
    const t = Math.min(TOWER.DROP_MS, performance.now() - dropStart);
    const sim = { xs: st.xs, lean: st.lean, streak: st.streak, lives: st.lives };
    const res = simulateDrop(sim, t, st.seed);
    dropping.current = true;
    setAnim(res.kind);
    play('tick');
    // сцената и сървърът вървят заедно; състоянието идва от сървъра, когато и двете приключат
    Promise.all([dropTowerAction(st.runId, t), stage.current?.play(res)]).then(([r]) => {
      dropping.current = false;
      setAnim(null);
      if ('error' in r) return setError(r.error);
      if (r.finish) {
        setSt(r.state);
        setQuestion(null);
        end(r.finish, 300);
      } else applyState(r.state, r.question);
    });
  }, [st, dropStart, applyState, end]);

  const onLand = useCallback((kind: DropKind) => play(kind === 'perfect' ? 'capture' : kind === 'ok' ? 'turn' : 'hit'), []);
  const onReady = useCallback(() => setReady((n) => n + 1), []);

  // сцената следва състоянието на играта
  useEffect(() => {
    const api = stage.current;
    if (!api || !st || screen !== 'play' || anim) return;
    api.sync(st.seed, { xs: st.xs, lean: st.lean, streak: st.streak, lives: st.lives }, best);
    if (st.phase === 'drop') api.aim(dropStart);
    else api.hold();
  }, [st, dropStart, anim, ready, screen, best]);

  // таймери: въпрос и пускане
  useEffect(() => {
    if (screen !== 'play' || !st) return;
    if (st.phase === 'question' && question && !feedback && !busy && now - qStart > TOWER.QUESTION_MS) answer(-1);
    if (st.phase === 'drop' && !anim && now - dropStart > TOWER.DROP_MS) drop();
  });

  // интервал / Enter = пусни
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter') && st?.phase === 'drop') {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [drop, st?.phase]);

  const quit = async () => {
    if (!st) return;
    const f = await quitTowerAction(st.runId);
    if (f) end(f, 0);
    else setScreen('start');
  };

  if (screen === 'start' || screen === 'over' || !st)
    return <StartScreen screen={screen} finish={finish} runId={st?.runId ?? null} best={best} monthBest={monthBest} top={top} meId={meId} isGuest={isGuest} busy={busy} error={error} onStart={start} />;

  if (desktop) {
    const floorsShown = st.xs.length;
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-[#0b0f1a]">
        <TowerStage theme={st.theme} api={stage} onReady={onReady} onLand={onLand} onTap={drop} />
        {st.phase === 'intro' && <TowerIntro onBegin={begin} busy={busy} best={best} />}
        {toast && now - toast.at < 1400 && (
          <div className="pointer-events-none absolute inset-x-0 top-[44%] flex justify-center">
            <span className={cn('animate-pop rounded-2xl px-5 py-2.5 text-xl font-black text-white shadow-lg', toast.tone === 'good' ? 'bg-primary' : toast.tone === 'bad' ? 'bg-error' : 'bg-secondary')}>{toast.text}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-6 p-6">
          {/* вляво: резултат */}
          <div className="pointer-events-auto w-60 shrink-0 space-y-4 text-white">
            <button onClick={quit} className="inline-flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-extrabold hover:bg-black/65">
              <X className="size-4" /> Край на играта
            </button>
            <div className="rounded-3xl bg-black/45 p-5 backdrop-blur">
              <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">Етажи</p>
              <p className="text-7xl font-black tabular-nums leading-none">{floorsShown}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-accent">
                <Trophy className="size-4" /> Рекорд: {best}
              </p>
            </div>
            <div className="rounded-3xl bg-black/45 p-5 backdrop-blur">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-white/70">Животи</p>
              <div className="flex gap-1.5">
                {Array.from({ length: TOWER.LIVES }, (_, i) => (
                  <Heart key={i} className={cn('size-8', i < st.lives ? 'fill-[#ff4b4b] text-[#ff4b4b]' : 'text-white/30')} />
                ))}
              </div>
              {st.streak > 0 && <p className="mt-3 text-sm font-black text-accent">⭐ {st.streak}/3 перфектни поред</p>}
            </div>
            <p className="rounded-2xl bg-black/35 px-3 py-2 text-xs text-white/80 backdrop-blur">Пускане: клик върху кулата или интервал. 3 перфектни пускания поред успокояват люлеенето.</p>
          </div>

        </div>

        {/* пускане — малка подсказка горе, не пречи на клика */}
        {st.phase === 'drop' && !anim && (
          <div className="pointer-events-none absolute right-6 top-1/2 flex w-64 -translate-y-1/2 flex-col items-center gap-2 text-center">
            <span className="animate-pulse rounded-full bg-black/55 px-5 py-2.5 text-lg font-black text-white">Пусни етажа! (клик или интервал)</span>
            <div className="h-2.5 w-64 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${Math.max(0, 100 - ((now - dropStart) / TOWER.DROP_MS) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* въпросът — голям, в средата; изчезва след отговора */}
        {st.phase === 'question' && question && !anim && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-6 backdrop-blur-[2px]">
            <div className="w-full max-w-3xl">
              <QuestionSheet docked q={question} left={TOWER.QUESTION_MS - (now - qStart)} feedback={feedback} busy={busy} onAnswer={answer} />
            </div>
          </div>
        )}
        {error && <p className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-xl bg-error px-4 py-2 text-center text-sm font-bold text-white">{error}</p>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f1a]">
      <div className="relative size-full overflow-hidden">
        <TowerStage theme={st.theme} api={stage} onReady={onReady} onLand={onLand} onTap={drop} />
        {st.phase === 'intro' && <TowerIntro onBegin={begin} busy={busy} best={best} />}

        {/* горна лента */}
        {/* под стрелата на крана, където и да е тя на този екран */}
        <div className="pointer-events-none absolute inset-x-0 flex items-start justify-between px-3" style={{ top: 'calc((100dvh - min(100dvh, 177.78vw)) / 2 + min(100dvh, 177.78vw) * 0.1)' }}>
          <button onClick={quit} className="pointer-events-auto rounded-full bg-black/45 p-2 text-white" aria-label="Край">
            <X className="size-5" />
          </button>
          <div className="text-center text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]">
            <p className="text-5xl font-black tabular-nums leading-none">{st.xs.length}</p>
            <p className="text-xs font-extrabold uppercase tracking-wider">етажа · рекорд {best}</p>
          </div>
          <div className="flex gap-0.5 rounded-full bg-black/45 px-2.5 py-1.5">
            {Array.from({ length: TOWER.LIVES }, (_, i) => (
              <Heart key={i} className={cn('size-5', i < st.lives ? 'fill-[#ff4b4b] text-[#ff4b4b]' : 'text-white/40')} />
            ))}
          </div>
        </div>
        {st.streak > 0 && (
          <div className="pointer-events-none absolute left-3 rounded-full bg-accent/90 px-2.5 py-1 text-xs font-black text-ink-strong" style={{ top: 'calc((100dvh - min(100dvh, 177.78vw)) / 2 + min(100dvh, 177.78vw) * 0.1 + 3.4rem)' }}>⭐ {st.streak}/3 перфектни</div>
        )}

        {toast && now - toast.at < 1400 && (
          <div className="pointer-events-none absolute inset-x-0 top-[47%] flex justify-center">
            <span className={cn('animate-pop rounded-2xl px-4 py-2 text-lg font-black text-white shadow-lg', toast.tone === 'good' ? 'bg-primary' : toast.tone === 'bad' ? 'bg-error' : 'bg-secondary')}>{toast.text}</span>
          </div>
        )}

        {/* пускане */}
        {st.phase === 'drop' && !anim && (
          <div className="pointer-events-none absolute inset-x-0 top-[39%] flex flex-col items-center gap-2">
            <span className="animate-pulse rounded-full bg-black/55 px-4 py-2 font-black text-white">Тапни, за да пуснеш!</span>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${Math.max(0, 100 - ((now - dropStart) / TOWER.DROP_MS) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* въпрос */}
        {st.phase === 'question' && question && !anim && (
          <QuestionSheet q={question} left={TOWER.QUESTION_MS - (now - qStart)} feedback={feedback} busy={busy} onAnswer={answer} />
        )}
        {error && <p className="absolute inset-x-3 bottom-3 rounded-xl bg-error p-2 text-center text-sm font-bold text-white">{error}</p>}
      </div>
    </div>
  );
}

/** Подготовка: как се играе — таймерът тръгва след „Строй!“. */
function TowerIntro({ onBegin, busy, best }: { onBegin: () => void; busy: boolean; best: number }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="card3d w-full max-w-lg animate-rise rounded-3xl bg-surface p-6 text-center">
        <p className="text-4xl">🏛️</p>
        <p className="mt-1 text-2xl font-black text-ink-strong">Кула на Словото</p>
        <ul className="mx-auto mt-4 space-y-2 text-left text-sm text-ink">
          <li>❓ Отговори вярно на въпроса (30 сек.) — получаваш <b>нов етаж</b>.</li>
          <li>🏗️ Кранът носи етажа наляво-надясно. <b>Тапни / кликни / интервал</b>, когато е точно над кулата.</li>
          <li>⚖️ Ако стъпи на по-малко от половината — пада. Кривото строене люлее кулата, а 3 перфектни поред я успокояват.</li>
          <li>❤️ 3 сърца за цялата игра — губиш сърце при грешка, изтекло време или паднал етаж.</li>
        </ul>
        {best > 0 && <p className="mt-3 text-sm font-extrabold text-accent-dark">Рекордът ти: {best} етажа — можеш ли повече?</p>}
        <Button block size="lg" className="mt-5" onClick={onBegin} disabled={busy}>
          {busy ? '…' : 'Строй!'}
        </Button>
      </div>
    </div>
  );
}

/** Компютър: широк екран с мишка → кулата в средата, въпросът отстрани. */
function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px) and (pointer: fine) and (orientation: landscape)');
    const on = () => setD(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
}

function QuestionSheet({ q, left, feedback, busy, onAnswer, docked = false }: { q: ClientQuestion; left: number; feedback: { shown: number; correctIndex: number | null; ok: boolean } | null; busy: boolean; onAnswer: (i: number) => void; docked?: boolean }) {
  const pct = Math.max(0, Math.min(100, (left / TOWER.QUESTION_MS) * 100));
  return (
    <div className={docked ? '' : 'absolute inset-0 flex flex-col justify-end bg-black/25'}>
      <div className={docked ? 'card3d max-h-[88dvh] animate-rise overflow-y-auto rounded-3xl bg-surface p-7 shadow-2xl' : 'max-h-[66%] animate-rise overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-2xl'}>
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className={cn('h-full rounded-full', left < 5000 ? 'bg-error' : 'bg-secondary')} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-7 text-right text-sm font-black tabular-nums">{Math.max(0, Math.ceil(left / 1000))}</span>
        </div>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <Badge tone="blue">{q.label}</Badge>
          {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
        </div>
        <p className={cn('whitespace-pre-line font-extrabold leading-snug text-ink-strong', docked ? 'text-2xl' : 'text-base')}>{q.prompt}</p>
        {q.context && <ContextBox text={q.context} compact={!docked} />}
        <div className={docked ? 'mt-5' : 'mt-3'}>
          <AnswerInput
            q={q}
            value={feedback ? { index: feedback.shown } : undefined}
            onChange={(a) => typeof a.index === 'number' && onAnswer(a.index)}
            disabled={busy || !!feedback}
            compact={!docked}
            reveal={feedback ? { correctIndex: feedback.correctIndex } : null}
          />
        </div>
      </div>
    </div>
  );
}

function StartScreen({
  screen,
  finish,
  runId,
  best,
  monthBest,
  top,
  meId,
  isGuest,
  busy,
  error,
  onStart,
}: {
  screen: 'start' | 'play' | 'over';
  finish: TowerFinish | null;
  runId: string | null;
  best: number;
  monthBest: number;
  top: TopRow[];
  meId: string;
  isGuest: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const [review, setReview] = useState<Awaited<ReturnType<typeof towerReviewAction>> | null>(null);
  useEffect(() => {
    if (screen === 'over' && runId) towerReviewAction(runId).then(setReview);
  }, [screen, runId]);
  const mb = useMemo(() => Math.max(monthBest, finish?.floors ?? 0), [monthBest, finish]);
  const over = screen === 'over' && !!finish;
  const RULES: [string, string, string][] = [
    ['❓', 'Отговори вярно', `Имаш ${TOWER.QUESTION_MS / 1000} секунди за въпрос. Верен отговор = нов етаж на крана.`],
    ['🏗️', 'Пусни го точно', 'Етажът се люлее наляво-надясно. Натисни, когато е над кулата.'],
    ['❤️', `${TOWER.LIVES} сърца`, 'Губиш сърце при грешен отговор, изтекло време или паднал етаж.'],
    ['✨', 'Перфектно пускане', `${TOWER.PERFECT_STREAK} перфектни поред изправят кулата наполовина.`],
    ['🌪️', 'Кулата се люлее', 'Колкото по-криво строиш, толкова повече се клати. Наклони ли се твърде много — срутва се.'],
    ['⭐', 'Точки', `${TOWER.XP_PER_CORRECT} XP за верен отговор, до ${TOWER.XP_DAILY_QUESTIONS} въпроса на ден. На всеки 10 етажа става по-трудно.`],
  ];
  return (
    <div className="nx-stack mx-auto max-w-4xl" style={{ gap: '1.6rem' }}>
      {finish?.record && <Confetti />}
      <header className="nx-panel tw-hero animate-rise">
        <div className="tw-hero-art" style={{ backgroundImage: 'url(/landing/tower.webp)' }} />
        <div className="tw-hero-copy">
          <p className="ln-eyebrow">Аркада · сам</p>
          <h1 className="ln-display nx-h1">
            Кула на <span className="ln-grad">Словото</span>
          </h1>
          <p className="nx-sub" style={{ color: '#c5cfee' }}>
            Всеки верен отговор е нов етаж. Пусни го точно върху кулата — колко високо ще стигнеш?
          </p>
          <div className="tw-cta">
            <Button size="lg" onClick={onStart} disabled={busy}>
              {busy ? '…' : over ? 'Още една кула' : 'Строй!'}
            </Button>
            {isGuest && <span className="text-xs font-semibold text-muted">Като гост играеш, но не влизаш в класацията.</span>}
          </div>
          {error && <p className="mt-2 text-sm font-bold text-error">{error}</p>}
        </div>
        <div className="tw-score">
          <small>{over ? (finish!.record ? 'Нов рекорд!' : 'Кулата ти') : 'Твоят рекорд'}</small>
          <b className="ln-display ln-grad">{over ? finish!.floors : best}</b>
          <span>етажа</span>
          <em>
            {over ? `рекорд: ${finish!.best}` : `този месец: ${mb}`}
            {over && finish!.xpEarned > 0 && ` · +${finish!.xpEarned} XP`}
          </em>
        </div>
      </header>

      {screen === 'over' && review && review.length > 0 && (
        <div className="nx-panel pf-box">
          <h2 className="ln-display mb-3 text-[0.95rem] text-white">Разбор на въпросите</h2>
          <ul className="space-y-2.5 text-sm">
            {review.map((r, i) => (
              <li key={i} className="flex gap-2">
                {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <X className="mt-0.5 size-4 shrink-0 text-error" />}
                <span>
                  <span className="font-bold">{r.prompt}</span>
                  {!r.ok && (
                    <span className="block text-muted">
                      {r.chosen ? `Ти: ${r.chosen} · ` : 'Без отговор · '}
                      <span className="font-bold text-primary-dark">Вярно: {r.correct}</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pf-two" style={{ alignItems: 'start' }}>
        <div className="nx-panel pf-box">
          <header>
            <h2 className="ln-display">Най-високите кули</h2>
            <Link href="/leaderboard?tab=tower" className="pf-more">Цялата класация →</Link>
          </header>
          {top.length ? (
            <ol className="tw-top">
              {top.map((r, i) => (
                <li key={r.userId} data-me={r.userId === meId}>
                  <span className="ln-display">{i + 1}</span>
                  <Avatar name={r.name} avatar={r.avatar as never} seed={r.userId} size={32} />
                  <span className="flex-1 truncate font-bold">{r.name}</span>
                  <b className="ln-display">{r.score}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm font-semibold text-muted">Още никой не е строил този месец. Бъди първият!</p>
          )}
        </div>
        <div>
          <p className="ln-eyebrow mb-3">Правила</p>
          <div className="ch-rules" style={{ gridTemplateColumns: '1fr' }}>
            {RULES.map(([icon, title, text]) => (
              <div key={title} className="nx-panel">
                <span>{icon}</span>
                <div>
                  <b className="ln-display">{title}</b>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

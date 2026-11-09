'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Heart, Trophy, X } from 'lucide-react';
import { craneX, floorSize, simulateDrop, swayX, TOWER, TOWER_BASE_W, TOWER_STYLE, towerHeight, type DropResult, type TowerTheme } from '@belmaster/shared';
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
import { Floor, Roof } from './floors';

const VW = 450;
const VH = 800;
const CX = VW / 2;
const FH = TOWER.FLOOR_H;
const HANG_Y = 172; // горният ръб на висящия етаж (на екрана)
const BASE: Record<TowerTheme, number> = { town: 742, mountain: 742, library: 722 };
/** цветът на небето в горния край на фона — продължава нагоре */
const SKY: Record<TowerTheme, string> = { town: '#659fe1', mountain: '#4075b8', library: '#332d5e' };
const SKY_WIDE: Record<TowerTheme, string> = { town: '#8ebbe4', mountain: '#407ecf', library: '#856ece' };
/** широката сцена (компютър): 16:9, кулата остава в средата */
const WIDE_W = (VH * 16) / 9;
const WIDE_X = CX - WIDE_W / 2;

// стабилни „звезди“ високо в небето
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 91.7 + n * 17.3) * 43758.5453;
    return v - Math.floor(v);
  };
  return { x: r(1) * VW, y: -1800 - r(2) * 7000, s: 0.6 + r(3) * 1.6 };
});

interface TopRow {
  userId: string;
  name: string;
  avatar: unknown;
  score: number;
}

type Anim = { res: DropResult; start: number; serverDone: boolean; fromX: number };

export function TowerGame({ best: bestAll, monthBest, top, meId, isGuest }: { best: number; monthBest: number; top: TopRow[]; meId: string; isGuest: boolean }) {
  const [screen, setScreen] = useState<'start' | 'play' | 'over'>('start');
  const [st, setSt] = useState<TowerState | null>(null);
  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [qStart, setQStart] = useState(0);
  const [dropStart, setDropStart] = useState(0);
  const [feedback, setFeedback] = useState<{ shown: number; correctIndex: number | null; ok: boolean } | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [shake, setShake] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'bad' | 'info'; at: number } | null>(null);
  const [finish, setFinish] = useState<TowerFinish | null>(null);
  const [best, setBest] = useState(bestAll);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Awaited<ReturnType<typeof dropTowerAction>> | null>(null);
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
      setShake((s) => s + 1);
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
    if (!st || st.phase !== 'drop' || anim) return;
    const t = Math.min(TOWER.DROP_MS, performance.now() - dropStart);
    const sim = { xs: st.xs, lean: st.lean, streak: st.streak, lives: st.lives };
    const res = simulateDrop(sim, t, st.seed);
    pending.current = null;
    setAnim({ res, start: performance.now(), serverDone: false, fromX: res.craneX });
    play('tick');
    dropTowerAction(st.runId, t).then((r) => {
      pending.current = r;
      setAnim((a) => (a ? { ...a, serverDone: true } : a));
    });
  }, [st, anim, dropStart]);

  // край на анимацията на пускането → състоянието от сървъра
  const animDur = anim ? (anim.res.kind === 'collapse' ? 1700 : anim.res.kind === 'fall' ? 1100 : 380) : 0;
  useEffect(() => {
    if (!anim || !anim.serverDone || now - anim.start < animDur) return;
    const r = pending.current;
    setAnim(null);
    if (!r || 'error' in r) {
      if (r && 'error' in r) setError(r.error);
      return;
    }
    if (r.kind === 'perfect') {
      play('capture');
      say(r.steadied ? 'Перфектно! Кулата се успокои' : 'Перфектно!', 'good');
    } else if (r.kind === 'ok') play('turn');
    else if (r.kind === 'fall') {
      play('hit');
      setShake((s) => s + 1);
      say('Етажът падна! −1 ❤', 'bad');
    } else say('Кулата се срути!', 'bad');
    if (r.finish) {
      setSt(r.state);
      setQuestion(null);
      end(r.finish, 500);
    } else applyState(r.state, r.question);
  }, [anim, now, animDur, applyState, end]);

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
    const floorsShown = st.xs.length + (anim && anim.res.kind !== 'fall' ? 1 : 0);
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-[#0b0f1a]">
        <Scene wide st={st} now={now} dropStart={dropStart} anim={anim} shake={shake} best={best} onTap={drop} />
        {st.phase === 'intro' && <TowerIntro onBegin={begin} busy={busy} best={best} />}
        {toast && now - toast.at < 1400 && (
          <div className="pointer-events-none absolute inset-x-0 top-[44%] flex justify-center">
            <span className={cn('animate-pop rounded-2xl px-5 py-2.5 text-xl font-black text-white shadow-lg', toast.tone === 'good' ? 'bg-primary' : toast.tone === 'bad' ? 'bg-error' : 'bg-secondary')}>{toast.text}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-6 p-6">
          {/* вляво: резултат */}
          <aside className="pointer-events-auto w-60 shrink-0 space-y-4 text-white">
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
          </aside>

        </div>

        {/* пускане — малка подсказка горе, не пречи на клика */}
        {st.phase === 'drop' && !anim && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-1.5">
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
      <div className="relative overflow-hidden" style={{ width: 'min(100vw, calc(100dvh * 9 / 16))', height: 'min(100dvh, calc(100vw * 16 / 9))' }}>
        <Scene st={st} now={now} dropStart={dropStart} anim={anim} shake={shake} best={best} onTap={drop} />
        {st.phase === 'intro' && <TowerIntro onBegin={begin} busy={busy} best={best} />}

        {/* горна лента */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <button onClick={quit} className="pointer-events-auto rounded-full bg-black/45 p-2 text-white" aria-label="Край">
            <X className="size-5" />
          </button>
          <div className="text-center text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]">
            <p className="text-5xl font-black tabular-nums leading-none">{st.xs.length + (anim && anim.res.kind !== 'fall' ? 1 : 0)}</p>
            <p className="text-xs font-extrabold uppercase tracking-wider">етажа · рекорд {best}</p>
          </div>
          <div className="flex gap-0.5 rounded-full bg-black/45 px-2.5 py-1.5">
            {Array.from({ length: TOWER.LIVES }, (_, i) => (
              <Heart key={i} className={cn('size-5', i < st.lives ? 'fill-[#ff4b4b] text-[#ff4b4b]' : 'text-white/40')} />
            ))}
          </div>
        </div>
        {st.streak > 0 && (
          <div className="pointer-events-none absolute left-3 top-16 rounded-full bg-accent/90 px-2.5 py-1 text-xs font-black text-ink-strong">⭐ {st.streak}/3 перфектни</div>
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

function Scene({ st, now, dropStart, anim, shake, best, onTap, wide = false }: { st: TowerState; now: number; dropStart: number; anim: Anim | null; shake: number; best: number; onTap: () => void; wide?: boolean }) {
  const vx = wide ? WIDE_X : 0;
  const vw = wide ? WIDE_W : VW;
  const style = TOWER_STYLE[st.theme];
  const base = BASE[st.theme];
  const n = st.xs.length;
  const sim = { xs: st.xs, lean: st.lean };
  // по време на пускане времето е замразено в момента на тапа
  const t = anim ? Math.min(TOWER.DROP_MS, anim.start - dropStart) : st.phase === 'drop' ? Math.min(TOWER.DROP_MS, now - dropStart) : now;
  const sway = swayX(t, sim);
  const size = (i: number) => floorSize(st.seed, i);
  const hang = size(n);
  const cam = Math.max(0, HANG_Y + hang.h + 210 - (base - towerHeight(st.seed, n)));
  const floorX = (i: number) => CX + st.xs[i] + (n ? (sway * (i + 1)) / n : 0) - size(i).w / 2;
  const floorY = (i: number) => base - towerHeight(st.seed, i + 1);

  // анимация на пускането (в координатите на света)
  let drop: React.ReactNode = null;
  let towerRot = 0;
  let towerFade = 1;
  if (anim) {
    const el = now - anim.start;
    const r = anim.res;
    const fromY = HANG_Y - cam;
    const toY = base - towerHeight(st.seed, n + 1);
    const k = Math.min(1, el / 340);
    const ease = k * k;
    const hw = hang.w;
    let x = CX + r.craneX - hw / 2 + ((r.kind === 'fall' ? r.craneX : r.landX + (n ? sway : 0)) - r.craneX) * ease;
    let y = fromY + (toY - fromY) * ease;
    let rot = 0;
    let op = 1;
    if (r.kind === 'fall' && el > 340) {
      const f = Math.min(1, (el - 340) / 760);
      const dir = Math.sign(r.dx) || 1;
      x += dir * 140 * f;
      y += 520 * f * f;
      rot = dir * 85 * f;
      op = 1 - f * 0.6;
    }
    if (r.kind === 'collapse' && el > 340) {
      const f = Math.min(1, (el - 340) / 1300);
      towerRot = (Math.sign(r.next.lean) || 1) * 78 * f * f;
      towerFade = 1 - f * 0.5;
    }
    drop = (
      <g opacity={op} transform={`rotate(${rot} ${x + hw / 2} ${y + hang.h / 2})`}>
        <Floor style={style} x={x} y={y} w={hw} h={hang.h} i={n} />
        {r.kind !== 'fall' && el >= 340 && <Dust x={x + hw / 2} y={y + hang.h} />}
      </g>
    );
  }
  const hanging = st.phase === 'drop' && !anim;
  const cx = craneX(t, n, st.seed);

  return (
    <svg viewBox={`${vx} 0 ${vw} ${VH}`} preserveAspectRatio={wide ? 'xMidYMax slice' : 'xMidYMid meet'} className="absolute inset-0 h-full w-full touch-none select-none" onPointerDown={onTap} role="img" aria-label="Кулата">
      <defs>
        <linearGradient id="tw-sky" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={(wide ? SKY_WIDE : SKY)[st.theme]} />
          <stop offset=".35" stopColor={st.theme === 'library' ? '#1f1a40' : '#2c4f8f'} />
          <stop offset=".7" stopColor="#141a3c" />
          <stop offset="1" stopColor="#05060f" />
        </linearGradient>
        <filter id="tw-sh">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodOpacity=".35" />
        </filter>
      </defs>
      <g style={{ transform: `translateY(${cam}px)`, transition: 'transform .6s ease-out' }}>
        {/* небето продължава нагоре */}
        <rect x={vx} y="-9000" width={vw} height="9004" fill="url(#tw-sky)" />
        {STARS.map((s, i) => (
          <circle key={i} cx={vx + (s.x / VW) * vw} cy={s.y} r={s.s} fill="#fff" opacity=".8" />
        ))}
        <image href={wide ? `/tower/wide-${st.theme}.webp` : `/tower/${st.theme}.webp`} x={vx} y="0" width={vw} height={VH} preserveAspectRatio="none" />
        {/* основата */}
        <rect x={CX - TOWER_BASE_W / 2} y={base} width={TOWER_BASE_W} height="13" rx="4" fill="#8d8173" stroke="#4a4036" strokeWidth="2" />
        {/* линия на рекорда */}
        {best > 0 && (
          <g opacity=".85">
            <line x1={CX - 210} x2={CX + 210} y1={base - best * FH} y2={base - best * FH} stroke="#ffd84a" strokeWidth="2.5" strokeDasharray="10 8" />
            <rect x={CX + 122} y={base - best * FH - 26} width="88" height="22" rx="11" fill="#ffd84a" />
            <text x={CX + 166} y={base - best * FH - 10} textAnchor="middle" fontSize="12" fontWeight="900" fill="#3a2a00">
              Рекорд {best}
            </text>
          </g>
        )}
        {/* кулата */}
        <g key={shake} className={shake ? 'tower-shake' : ''} style={{ transformOrigin: `${CX}px ${base}px` }}>
          <g transform={`rotate(${towerRot} ${CX} ${base})`} opacity={towerFade} filter="url(#tw-sh)">
            {st.xs.map((_, i) => (
              <Floor key={i} style={style} x={floorX(i)} y={floorY(i)} w={size(i).w} h={size(i).h} i={i} ground={i === 0} />
            ))}
            {n > 0 && !(anim && anim.res.kind !== 'fall') && <Roof style={style} x={floorX(n - 1)} y={floorY(n - 1)} w={size(n - 1).w} />}
          </g>
        </g>
        {drop}
      </g>

      {/* кранът — на екрана, не в света */}
      <line x1={vx} y1="114" x2={vx + vw} y2="114" stroke="#2b2b2b" strokeWidth="6" />
      <line x1={vx} y1="124" x2={vx + vw} y2="124" stroke="#2b2b2b" strokeWidth="2" strokeDasharray="8 6" />
      <g transform={`translate(${CX + (hanging ? cx : anim ? anim.res.craneX : cx)} 0)`}>
        <rect x="-22" y="104" width="44" height="22" rx="4" fill="#f5b800" stroke="#2b2b2b" strokeWidth="2.5" />
        <line x1="0" y1="126" x2="0" y2={hanging ? HANG_Y - 14 : 150} stroke="#2b2b2b" strokeWidth="2.5" />
        {hanging && (
          <g>
            <path d={`M0 ${HANG_Y - 14} L${-hang.w / 2 + 10} ${HANG_Y} M0 ${HANG_Y - 14} L${hang.w / 2 - 10} ${HANG_Y}`} stroke="#2b2b2b" strokeWidth="2" fill="none" />
            <g filter="url(#tw-sh)">
              <Floor style={style} x={-hang.w / 2} y={HANG_Y} w={hang.w} h={hang.h} i={n} ground={n === 0} />
            </g>
            <line x1="0" y1={HANG_Y + hang.h + 6} x2="0" y2={HANG_Y + hang.h + 70} stroke="#fff" strokeWidth="2" strokeDasharray="4 6" opacity=".7" />
          </g>
        )}
      </g>
    </svg>
  );
}

function Dust({ x, y }: { x: number; y: number }) {
  return (
    <g className="climb-dust">
      <ellipse cx={x - 50} cy={y - 2} rx="16" ry="7" fill="#d7c6a2" />
      <ellipse cx={x + 50} cy={y - 2} rx="16" ry="7" fill="#d7c6a2" />
    </g>
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
  return (
    <div className="mx-auto max-w-lg space-y-5">
      {finish?.record && <Confetti />}
      <div className="card3d overflow-hidden rounded-3xl bg-surface">
        <div className="relative h-40 bg-cover bg-bottom" style={{ backgroundImage: 'url(/tower/town.webp)' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <p className="absolute bottom-2 left-5 text-3xl font-black text-ink-strong">🏛️ Кула на Словото</p>
        </div>
        <div className="p-5 pt-2 text-center">
          {screen === 'over' && finish ? (
            <>
              <p className="text-sm font-extrabold uppercase text-muted">{finish.record ? 'Нов рекорд!' : 'Кулата ти'}</p>
              <p className="text-7xl font-black tabular-nums text-secondary">{finish.floors}</p>
              <p className="font-bold text-muted">етажа</p>
              <div className="mt-3 flex justify-center gap-2">
                <Badge tone="yellow">
                  <Trophy className="mr-1 inline size-4" />
                  Рекорд: {finish.best}
                </Badge>
                {finish.xpEarned > 0 && <Badge tone="green">+{finish.xpEarned} XP</Badge>}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold uppercase text-muted">Твоят рекорд</p>
              <p className="text-7xl font-black tabular-nums text-secondary">{best}</p>
              <p className="font-bold text-muted">етажа · този месец: {mb}</p>
              <p className="mt-3 text-sm text-muted">Отговори вярно, за да получиш етаж, после го пусни точно върху кулата. 3 сърца за цялата игра — губиш сърце при грешка, изтекло време или паднал етаж. Колкото по-криво строиш, толкова повече се люлее кулата!</p>
            </>
          )}
          <Button block size="lg" className="mt-5" onClick={onStart} disabled={busy}>
            {busy ? '…' : screen === 'over' ? 'Още една кула' : 'Строй!'}
          </Button>
          {isGuest && <p className="mt-2 text-xs text-muted">Като гост можеш да играеш, но не влизаш в класацията.</p>}
          {error && <p className="mt-2 text-sm font-bold text-error">{error}</p>}
        </div>
      </div>

      {screen === 'over' && review && review.length > 0 && (
        <div className="card3d rounded-2xl bg-surface p-5">
          <h2 className="mb-3 text-lg font-extrabold text-ink-strong">Разбор на въпросите</h2>
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

      <div className="card3d rounded-2xl bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-ink-strong">
          <Trophy className="size-5 text-accent" /> Най-високите кули този месец
        </h2>
        {top.length ? (
          <ol className="space-y-2">
            {top.map((r, i) => (
              <li key={r.userId} className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5', r.userId === meId && 'bg-secondary/10')}>
                <span className="w-6 text-center font-black text-muted">{i + 1}</span>
                <Avatar name={r.name} avatar={r.avatar as never} seed={r.userId} size={32} />
                <span className="flex-1 truncate font-bold">{r.name}</span>
                <span className="font-black tabular-nums text-secondary">🏛️ {r.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Още никой не е строил този месец. Бъди първият!</p>
        )}
        <ButtonLink href="/leaderboard?tab=tower" variant="ghost" block className="mt-3">
          Цялата класация
        </ButtonLink>
      </div>
      <Link href="/" className="block text-center text-sm font-bold text-muted">
        Към началото
      </Link>
    </div>
  );
}

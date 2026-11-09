'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUp, Bot, Check, Copy, Gem, Lock, LogOut, MessageCircle, Shield, Target, Users, Zap } from 'lucide-react';
import {
  CLIMB,
  CLIMB_CHAT,
  aimMarker,
  ruleText,
  weaponById,
  type AnyAnswer,
  type ClimbState,
  type UnlockRule,
} from '@belmaster/shared';
import { Alert, Badge, Button, Input, ProgressBar } from '@/components/ui';
import { AnswerInput, hasAnswer, LETTERS } from '@/components/quiz/inputs';
import { ContextBox } from '@/components/quiz/ContextBox';
import { Confetti, SoundToggle } from '@/components/game/BattleExtras';
import { cn } from '@/lib/cn';
import { play } from '@/lib/sound';
import { notifyProgress } from '@/components/unlocks/UnlockCelebration';
import { buyWeaponAction, selectWeaponAction } from '@/app/(app)/climb/actions';
import { ClimbScene } from './ClimbScene';
import { ClimbDemo } from './ClimbDemo';
import { useClimb, useLeft, type ClimbSocket } from './useClimb';

export interface WeaponView {
  id: string;
  name: string;
  emoji: string;
  rule: UnlockRule | null;
  open: boolean;
}

export function ClimbGame({ weapons, selected, diamonds, isGuest }: { weapons: WeaponView[]; selected: string; diamonds: number; isGuest: boolean }) {
  const { socket, connected, state, offset, quick, error, clearError, chat } = useClimb();
  const params = useSearchParams();
  const joined = useRef(false);

  // покана по линк: /climb?code=ABC123
  useEffect(() => {
    const code = params.get('code');
    if (socket && connected && code && !joined.current && !state) {
      joined.current = true;
      socket.emit('climb:join', { code });
    }
  }, [socket, connected, params, state]);

  return (
    <div>
      {error && (
        <div className="mb-4" onClick={clearError}>
          <Alert>{error}</Alert>
        </div>
      )}
      {!socket || !connected ? (
        <p className="py-10 text-center font-bold text-muted">Свързване…</p>
      ) : !state ? (
        <Hub socket={socket} quick={quick} weapons={weapons} selected={selected} diamonds={diamonds} isGuest={isGuest} />
      ) : state.phase === 'lobby' ? (
        <Lobby socket={socket} state={state} />
      ) : (
        <Match socket={socket} state={state} offset={offset} chat={chat} />
      )}
    </div>
  );
}

// ───────────── начало ─────────────
function Hub({ socket, quick, weapons, selected, diamonds, isGuest }: { socket: ClimbSocket; quick: { searching: boolean; offerBot: boolean }; weapons: WeaponView[]; selected: string; diamonds: number; isGuest: boolean }) {
  const [code, setCode] = useState('');
  return (
    <div className="space-y-6">
      <div className="relative grid gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1cb0f6] to-[#58cc02] p-6 text-white md:p-8 lg:grid-cols-[1fr_380px] lg:items-center">
        <div>
        <p className="text-sm font-extrabold uppercase tracking-wide text-white/80">Игра за двама</p>
        <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">⛰️ Към върха</h1>
        <p className="mt-2 max-w-xl text-white/90">
          Отговори пръв вярно и избери: качи се едно стъпало или хвърли по стъпалото на другия. Пръв до 10-ото стъпало печели!
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => socket.emit('climb:quick')} disabled={quick.searching} className="btn3d inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-extrabold uppercase text-secondary [--btn-shadow:rgba(0,0,0,.2)]">
            <Zap className="size-5" /> {quick.searching ? 'Търсим противник…' : 'Бърза игра'}
          </button>
          <button onClick={() => socket.emit('climb:bot')} className="btn3d inline-flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-3 font-extrabold uppercase text-white [--btn-shadow:rgba(0,0,0,.2)]">
            <Bot className="size-5" /> Срещу бот
          </button>
          <button onClick={() => socket.emit('climb:create')} className="btn3d inline-flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-3 font-extrabold uppercase text-white [--btn-shadow:rgba(0,0,0,.2)]">
            <Users className="size-5" /> С приятел
          </button>
        </div>
        {quick.searching && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold">
            <span>Търсим противник от твоя клас…</span>
            {quick.offerBot && (
              <button onClick={() => socket.emit('climb:bot')} className="rounded-xl bg-white px-3 py-1 font-extrabold text-secondary">
                Играй с бота
              </button>
            )}
            <button onClick={() => socket.emit('climb:quick_leave')} className="underline">
              Откажи
            </button>
          </div>
        )}
        </div>
        <div className="overflow-hidden rounded-2xl border-4 border-white/30 shadow-xl" aria-label="Как изглежда играта">
          <ClimbDemo />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card3d rounded-2xl bg-surface p-5">
          <h2 className="mb-3 text-lg font-black">Влез с код</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) socket.emit('climb:join', { code });
            }}
          >
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="КОД" className="font-mono tracking-[0.3em]" />
            <Button type="submit" variant="secondary">
              Влез
            </Button>
          </form>
          <h2 className="mb-2 mt-6 text-lg font-black">Правила</h2>
          <ul className="space-y-1.5 text-sm">
            <li>❓ Двамата отговаряте на един въпрос. <b>Само най-бързият верен</b> избира.</li>
            <li>⬆️ <b>Качи се</b> — +1 стъпало.</li>
            <li>🎯 <b>Хвърли</b> — натисни, когато маркерът е в зеленото. Уцелиш ли, другият пада стъпало. Не уцелиш ли — пада твоето.</li>
            <li>🃏 <b>Жокери</b> — 50/50 и +5 секунди, по веднъж за игра.</li>
            <li>⛳ Ако другият е на земята, няма какво да целиш — направо се качваш.</li>
            <li>🛡️ <b>Щит</b> — веднъж за игра. Пази стъпалото, на което си, и другият не го вижда: ако те цели, ударът се връща към него. Щом смениш стъпалото, щитът изчезва.</li>
            <li>🧗 Колкото по-високо си, толкова по-тясна е зелената зона.</li>
            <li>🏁 Пръв до 10 стъпала, или по-високият след {CLIMB.MAX_QUESTIONS} въпроса.</li>
          </ul>
        </div>
        <WeaponPicker weapons={weapons} selected={selected} diamonds={diamonds} isGuest={isGuest} />
      </div>
    </div>
  );
}

function WeaponPicker({ weapons, selected, diamonds, isGuest }: { weapons: WeaponView[]; selected: string; diamonds: number; isGuest: boolean }) {
  const [cur, setCur] = useState(selected);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="card3d rounded-2xl bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black">Оръжие</h2>
        <span className="flex items-center gap-1 text-sm font-black text-secondary">
          <Gem className="size-4" /> {diamonds}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted">Всички удрят еднакво — разликата е само във вида. Отключват се с нива, а ракетата — с диаманти.</p>
      <div className="grid grid-cols-4 gap-2">
        {weapons.map((w) => {
          const shop = !w.open && w.rule?.kind === 'shop';
          return (
            <button
              key={w.id}
              disabled={pending || (!w.open && !shop)}
              title={w.open ? w.name : `${w.name} — ${ruleText(w.rule!)}`}
              onClick={() =>
                start(async () => {
                  setErr(null);
                  if (shop) {
                    if (isGuest) return setErr('Само за регистрирани.');
                    if (!window.confirm(`Да купя ли „${w.name}“ за ${ruleText(w.rule!)}?`)) return;
                    const r = await buyWeaponAction(w.id);
                    if (!r.ok) return setErr(r.error ?? 'Грешка.');
                  } else {
                    const r = await selectWeaponAction(w.id);
                    if (!r.ok) return setErr(r.error ?? 'Грешка.');
                  }
                  setCur(w.id);
                  router.refresh();
                })
              }
              className={cn(
                'card3d relative flex flex-col items-center rounded-xl bg-surface p-2 text-center',
                cur === w.id && 'border-secondary! bg-secondary/10',
                !w.open && !shop && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className={cn('text-3xl', !w.open && 'grayscale')}>{w.emoji}</span>
              <span className="mt-1 text-[11px] font-extrabold leading-tight">{w.name}</span>
              {!w.open && (
                <span className={cn('mt-1 inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-black', shop ? 'bg-secondary text-white' : 'bg-ink-strong/80 text-bg')}>
                  {!shop && <Lock className="size-2.5" />}
                  {ruleText(w.rule!)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-error">{err}</p>}
    </div>
  );
}

// ───────────── стая ─────────────
function Lobby({ socket, state }: { socket: ClimbSocket; state: ClimbState }) {
  const [copied, setCopied] = useState(false);
  const me = state.players.find((p) => p.uid === state.you);
  const host = state.hostUid === state.you;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/climb?code=${state.code}` : '';
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="card3d rounded-3xl bg-surface p-6 text-center">
        <p className="text-sm font-extrabold uppercase text-muted">⛰️ Към върха · код на стаята</p>
        <p className="mt-1 font-mono text-4xl font-black tracking-[0.3em] text-ink-strong">{state.code}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? 'Копирано' : 'Копирай линка за приятел'}
        </Button>
      </div>
      <div className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
        {[0, 1].map((i) => {
          const p = state.players[i];
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="size-3 rounded-full" style={{ background: p?.color ?? '#ccc' }} />
              <span className="flex-1 font-extrabold">{p ? `${p.name}${p.uid === state.you ? ' (ти)' : ''}` : 'Чакаме противник…'}</span>
              {p && <Badge tone={p.ready ? 'green' : 'gray'}>{p.ready ? 'Готов' : 'Не е готов'}</Badge>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {host ? (
          <Button onClick={() => socket.emit('climb:start')} disabled={state.players.length < 2}>
            Започни
          </Button>
        ) : (
          <Button onClick={() => socket.emit('climb:ready', { ready: !me?.ready })} variant={me?.ready ? 'outline' : 'primary'}>
            {me?.ready ? 'Не съм готов' : 'Готов съм'}
          </Button>
        )}
        <Button variant="ghost" onClick={() => socket.emit('climb:leave')}>
          Излез
        </Button>
      </div>
    </div>
  );
}

// ───────────── игра ─────────────
function Match({ socket, state, offset, chat }: { socket: ClimbSocket; state: ClimbState; offset: number; chat: { uid: string; key: string; at: number }[] }) {
  const [chatOpen, setChatOpen] = useState(false);
  const me = state.players.find((p) => p.uid === state.you)!;
  const other = state.players.find((p) => p.uid !== state.you);
  const left = useLeft(state.phase === 'question' && state.question ? state.question.myDeadline : state.deadline, offset);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const desktop = useDesktop();
  const canShield = !me.shieldUsed && me.height > 0 && (['question', 'reveal', 'choose'].includes(state.phase) || state.actorUid === me.uid);

  useEffect(() => {
    if (state.phase === 'finished') notifyProgress(4500);
  }, [state.phase]);

  return (
    <div className="phone-landscape:fixed phone-landscape:inset-0 phone-landscape:z-40 phone-landscape:flex phone-landscape:flex-col phone-landscape:bg-bg phone-landscape:px-2 phone-landscape:py-1">
      {state.phase === 'finished' && state.winnerUid === state.you && <Confetti />}
      <div className="mb-3 flex items-center justify-between gap-2 phone-landscape:mb-1">
        <span className="font-extrabold text-ink-strong phone-landscape:text-sm">
          ⛰️ Към върха · въпрос {Math.max(1, state.questionNo)}/{state.maxQuestions}
        </span>
        <div className="relative flex items-center gap-3">
          {state.phase !== 'lobby' ? (
            <button onClick={() => setChatOpen((o) => !o)} className="inline-flex items-center gap-1 text-sm font-extrabold text-muted hover:text-ink" aria-label="Бързи съобщения">
              <MessageCircle className="size-4" /> Чат
            </button>
          ) : null}
          {chatOpen && (
            <div className="absolute right-0 top-8 z-50 grid w-64 grid-cols-2 gap-1.5 rounded-2xl border-2 border-line bg-surface p-2 shadow-xl">
              {CLIMB_CHAT.map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    socket.emit('climb:chat', { key: m.key });
                    setChatOpen(false);
                  }}
                  className="rounded-xl bg-surface-2 px-2 py-1.5 text-left text-sm font-bold hover:bg-line"
                >
                  {m.text}
                </button>
              ))}
            </div>
          )}
          <SoundToggle />
          {state.phase !== 'finished' ? (
            <button onClick={() => setConfirmLeave(true)} className="inline-flex items-center gap-1 text-sm font-extrabold text-muted hover:text-error">
              <LogOut className="size-4" /> Напусни
            </button>
          ) : null}
        </div>
      </div>

      {desktop ? (
        <DesktopLayout socket={socket} state={state} offset={offset} chat={chat} left={left} me={me} other={other} canShield={canShield} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] phone-landscape:min-h-0 phone-landscape:flex-1 phone-landscape:grid-cols-[1.1fr_1fr] phone-landscape:gap-2">
        <div className="card3d overflow-hidden rounded-2xl bg-surface phone-landscape:min-h-0">
          <ClimbScene state={state} chat={chat} />
          {other && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-muted phone-landscape:hidden">
              <span>
                {me.name}: {me.correct}/{me.answered} верни
              </span>
              <span>
                {other.name}: {other.correct}/{other.answered} верни {!other.connected && !other.isBot && '· ⚠ връзката прекъсна'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3 phone-landscape:min-h-0 phone-landscape:overflow-y-auto">
          {state.phase !== 'finished' && (
            <div className="flex items-center gap-2">
              {state.deadline && <ProgressBar value={state.phase === 'question' && state.question ? (left / state.question.timeMs) * 100 : Math.min(100, left / 120)} color={left < 5000 ? 'bg-error' : 'bg-secondary'} />}
              <span className="w-10 shrink-0 text-right font-mono text-sm font-black tabular-nums">{Math.ceil(left / 1000)}</span>
            </div>
          )}
          {state.phase === 'intro' && <ClimbIntro state={state} offset={offset} />}
          {state.phase === 'question' && state.question && <QuestionPanel key={state.question.id} socket={socket} state={state} />}
          {state.phase === 'reveal' && state.reveal && <RevealPanel state={state} />}
          {state.phase === 'choose' && <ChoosePanel socket={socket} state={state} />}
          {state.phase === 'aim' && state.aim && <AimPanel socket={socket} state={state} offset={offset} />}
          {state.phase === 'resolve' && <p className="rounded-2xl bg-surface-2 p-4 text-center font-extrabold">{state.log[state.log.length - 1]}</p>}
          {state.phase === 'finished' && <FinishedPanel socket={socket} state={state} />}

          {state.phase !== 'finished' && (
            <ShieldBox armed={me.shieldArmed} used={me.shieldUsed} can={canShield} onShield={() => socket.emit('climb:shield')} />
          )}
          {state.log.length > 0 && state.phase !== 'finished' && (
            <ul className="space-y-0.5 text-xs text-muted phone-landscape:hidden">
              {state.log.slice(-3).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      )}
      {confirmLeave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmLeave(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black">Да напуснеш ли?</p>
            <p className="mt-1 text-sm text-muted">Напускането е загуба.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmLeave(false)}>
                Остани
              </Button>
              <Button variant="danger" onClick={() => socket.emit('climb:leave')}>
                Напусни
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Компютър (широк екран с мишка): сцената е голяма, а въпросът изскача върху нея. */
function useDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const on = () => setD(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
}

function DesktopLayout({
  socket,
  state,
  offset,
  chat,
  left,
  me,
  other,
  canShield,
}: {
  socket: ClimbSocket;
  state: ClimbState;
  offset: number;
  chat: { uid: string; key: string; at: number }[];
  left: number;
  me: ClimbState['players'][number];
  other: ClimbState['players'][number] | undefined;
  canShield: boolean;
}) {
  const q = state.question;
  const answered = state.phase === 'question' && !!q && q.answered.includes(state.you);
  const last = state.log[state.log.length - 1];
  // какво се показва върху сцената
  const modal = state.phase === 'question' && !!q && !answered;
  // на финала първо се вижда как победителят стъпва на върха, после идва панелът
  const [showEnd, setShowEnd] = useState(false);
  useEffect(() => {
    if (state.phase !== 'finished') return setShowEnd(false);
    const t = setTimeout(() => setShowEnd(true), 1600);
    return () => clearTimeout(t);
  }, [state.phase]);
  const bottom = state.phase === 'choose' || state.phase === 'aim';
  const banner =
    state.phase === 'question' && answered
      ? `Изпратено — чакаме ${other?.name ?? 'другия'}…`
      : state.phase === 'resolve'
        ? last
        : null;
  return (
    <div data-wide className="mx-auto w-full space-y-3" style={{ maxWidth: 'calc((100dvh - 250px) * 1280 / 840)' }}>
      {state.phase !== 'finished' && state.deadline && (
        <div className="flex items-center gap-2">
          <ProgressBar value={state.phase === 'question' && q ? (left / q.timeMs) * 100 : Math.min(100, left / 120)} color={left < 5000 ? 'bg-error' : 'bg-secondary'} />
          <span className="w-10 shrink-0 text-right font-mono text-sm font-black tabular-nums">{Math.ceil(left / 1000)}</span>
        </div>
      )}
      <div className="card3d relative overflow-hidden rounded-2xl bg-surface">
        <ClimbScene state={state} chat={chat} />
        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-extrabold text-white backdrop-blur">{banner}</span>
          </div>
        )}
        {state.phase === 'reveal' && state.reveal && (
          <div className="absolute inset-x-0 top-3 flex justify-center px-4">
            <div className="w-full max-w-md">
              <RevealPanel state={state} />
            </div>
          </div>
        )}
        {state.phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 p-5">
            <div className="w-full max-w-xl">
              <ClimbIntro state={state} offset={offset} />
            </div>
          </div>
        )}
        {modal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-5 backdrop-blur-[2px]">
            <div className={cn('max-h-full w-full overflow-y-auto rounded-2xl animate-rise', state.phase === 'finished' ? 'max-w-sm' : q?.context ? 'max-w-4xl' : 'max-w-2xl')}>
              {state.phase === 'question' && q && <QuestionPanel key={q.id} socket={socket} state={state} wide />}
            </div>
          </div>
        )}
        {state.phase === 'finished' && showEnd && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
            <div className="w-full max-w-sm animate-rise">
              <FinishedPanel socket={socket} state={state} />
            </div>
          </div>
        )}
        {bottom && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
            <div className="w-full max-w-md animate-rise">
              {state.phase === 'choose' && <ChoosePanel socket={socket} state={state} />}
              {state.phase === 'aim' && state.aim && <AimPanel socket={socket} state={state} offset={offset} />}
            </div>
          </div>
        )}
      </div>
      {state.phase !== 'finished' && (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <ShieldBox armed={me.shieldArmed} used={me.shieldUsed} can={canShield} onShield={() => socket.emit('climb:shield')} />
          {other && (
            <span className="text-right text-xs font-bold text-muted">
              {me.name}: {me.correct}/{me.answered} верни · {other.name}: {other.correct}/{other.answered} верни
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Подготовка преди първия въпрос: противникът, оръжието, кратки правила, обратно броене. */
function ClimbIntro({ state, offset }: { state: ClimbState; offset: number }) {
  const left = useLeft(state.deadline, offset);
  const sec = Math.max(0, Math.ceil(left / 1000));
  const me = state.players.find((p) => p.uid === state.you);
  const other = state.players.find((p) => p.uid !== state.you);
  return (
    <div className="card3d animate-rise rounded-3xl bg-surface p-6 text-center phone-landscape:p-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Към върха</p>
      <p className="mt-1 text-2xl font-black text-ink-strong phone-landscape:text-lg">
        {me?.name} <span className="text-muted">срещу</span> {other?.name}
      </p>
      <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-ink phone-landscape:mt-2 phone-landscape:text-xs">
        <li>❓ Двамата отговаряте на един въпрос — <b>най-бързият верен избира</b>.</li>
        <li>⬆️ <b>Качи се</b> с едно стъпало или 🎯 <b>хвърли</b> {me ? weaponById(me.weapon).emoji : ''} по стъпалото на другия (натисни в зеленото).</li>
        <li>🛡️ <b>Щит</b> — веднъж за игра, скрит, пази само текущото стъпало: ако те целят, ударът се връща. Жокери: 50/50 и +5 с.</li>
        <li>🏁 Пръв до {CLIMB.STEPS}-ото стъпало печели.</li>
      </ul>
      <div className="mt-5 flex items-center justify-center gap-3 phone-landscape:mt-2">
        <span className="text-sm font-extrabold text-muted">Първият въпрос след</span>
        <span key={sec} className="flex size-14 animate-pop items-center justify-center rounded-full bg-secondary text-3xl font-black text-white phone-landscape:size-10 phone-landscape:text-xl">{sec}</span>
      </div>
    </div>
  );
}

function ShieldBox({ armed, used, can, onShield }: { armed: boolean; used: boolean; can: boolean; onShield: () => void }) {
  if (armed)
    return (
      <div className="flex items-center gap-2 rounded-2xl border-2 border-secondary bg-secondary/10 px-4 py-2.5 text-sm font-extrabold text-secondary-dark">
        <Shield className="size-5" /> Щитът пази това стъпало — ако те целят, ударът се връща. Изчезва, щом смениш стъпалото.
      </div>
    );
  if (used) return <p className="text-xs font-bold text-muted">🛡️ Щитът е използван.</p>;
  return (
    <button
      disabled={!can}
      onClick={() => {
        if (window.confirm('Щитът е само веднъж за игра и пази само това стъпало — другият не го вижда. Да го вдигна ли?')) onShield();
      }}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-secondary px-4 py-2.5 text-sm font-extrabold text-secondary disabled:opacity-40"
    >
      <Shield className="size-5" /> Вдигни щит (1 път за игра)
    </button>
  );
}

function QuestionPanel({ socket, state, wide = false }: { socket: ClimbSocket; state: ClimbState; wide?: boolean }) {
  const q = state.question!;
  const [ans, setAns] = useState<AnyAnswer>({});
  const sent = q.answered.includes(state.you);
  const other = state.players.find((p) => p.uid !== state.you);
  const me = state.players.find((p) => p.uid === state.you)!;
  const removed = new Set(q.removed);
  const submit = () => {
    if (sent || !hasAnswer(q as never, ans)) return;
    socket.emit('climb:answer', { questionId: q.id, ...ans });
  };
  return (
    <div className="card3d rounded-2xl bg-surface p-4">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge tone="blue">{q.topicLabel}</Badge>
        {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
        {other && q.answered.includes(other.uid) && <Badge tone="red">{other.name} отговори</Badge>}
      </div>
      <div className={cn(wide && q.context && q.type !== 'FILL_BLANKS' && 'grid grid-cols-2 gap-5')}>
        <div>
          <h2 className={cn('whitespace-pre-line font-extrabold leading-snug phone-landscape:text-base', wide ? 'text-xl' : 'text-lg')}>{q.prompt}</h2>
          {q.context && q.type !== 'FILL_BLANKS' && <ContextBox text={q.context} compact />}
        </div>
        <div className="mt-3">
          <AnswerInput q={q as never} value={ans} onChange={(a) => setAns((p) => ({ ...p, ...a }))} disabled={sent} compact onSubmit={submit} removed={removed} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={sent || !me.jokers.fifty || q.type !== 'SINGLE_CHOICE' || q.options.length < 3}
          onClick={() => socket.emit('climb:joker', { kind: 'fifty' })}
          title="Маха два грешни отговора (веднъж за игра)"
          className="rounded-xl border-2 border-purple px-3 text-sm font-black text-purple-dark disabled:opacity-35"
        >
          50/50
        </button>
        <button
          disabled={sent || !me.jokers.time}
          onClick={() => socket.emit('climb:joker', { kind: 'time' })}
          title="+5 секунди за теб (веднъж за игра)"
          className="whitespace-nowrap rounded-xl border-2 border-accent-dark px-3 text-sm font-black text-accent-dark disabled:opacity-35"
        >
          +5 с
        </button>
        <Button block disabled={sent || !hasAnswer(q as never, ans)} onClick={submit}>
          {sent ? 'Изпратено — чакаме…' : 'Изпрати'}
        </Button>
      </div>
    </div>
  );
}

function RevealPanel({ state }: { state: ClimbState }) {
  const r = state.reveal!;
  const actor = state.players.find((p) => p.uid === r.actorUid);
  const mine = r.results.find((x) => x.uid === state.you);
  // другият е на земята — няма избор, направо стъпало
  const autoClimb = !!actor && state.players.find((p) => p.uid !== actor.uid)?.height === 0;
  useEffect(() => play(mine?.correct ? 'correct' : 'wrong'), [mine?.correct]);
  return (
    <div className="card3d rounded-2xl bg-surface p-4">
      <p className={cn('text-lg font-black', mine?.correct ? 'text-primary-dark' : 'text-error')}>{mine?.correct ? 'Вярно!' : 'Грешно'}</p>
      {r.correctIndex != null && <p className="text-sm font-bold">Верният отговор: {LETTERS[r.correctIndex]}</p>}
      {r.correctText && <p className="text-sm font-bold">Верният отговор: {r.correctText}</p>}
      <p className="mt-2 rounded-xl bg-surface-2 p-2 text-center font-extrabold">
        {actor ? (autoClimb ? (actor.uid === state.you ? '⚡ Ти си най-бърз — качваш се стъпало!' : `⚡ ${actor.name} е по-бърз и се качва.`) : actor.uid === state.you ? '⚡ Ти си най-бърз — ти избираш!' : `⚡ ${actor.name} е по-бърз и избира.`) : 'Никой не позна — следващ въпрос.'}
      </p>
    </div>
  );
}

function ChoosePanel({ socket, state }: { socket: ClimbSocket; state: ClimbState }) {
  const mine = state.actorUid === state.you;
  const me = state.players.find((p) => p.uid === state.you)!;
  const actor = state.players.find((p) => p.uid === state.actorUid);
  const other = state.players.find((p) => p.uid !== state.you)!;
  if (!mine)
    return (
      <div className="card3d rounded-2xl bg-surface p-4 text-center">
        <p className="text-lg font-black">{actor?.name} избира…</p>
        <p className="mt-1 text-sm text-muted">Ще се качи ли, или ще те цели? Ако мислиш, че ще хвърля — вдигни щита сега.</p>
      </div>
    );
  return (
    <div className="card3d rounded-2xl bg-surface p-4">
      <p className="mb-3 text-center text-lg font-black">Какво избираш?</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => socket.emit('climb:choose', { action: 'climb' })} className="btn3d flex flex-col items-center gap-1 rounded-2xl bg-primary p-4 font-extrabold text-white [--btn-shadow:var(--color-primary-dark)]">
          <ArrowUp className="size-8" /> Качи се
          <span className="text-xs font-bold text-white/85">+1 стъпало</span>
        </button>
        <button
          onClick={() => socket.emit('climb:choose', { action: 'throw' })}
          disabled={other.height === 0}
          className="btn3d flex flex-col items-center gap-1 rounded-2xl bg-error p-4 font-extrabold text-white [--btn-shadow:var(--color-error-dark)] disabled:opacity-50"
        >
          <Target className="size-8" /> Хвърли {weaponById(me.weapon).emoji}
          <span className="text-xs font-bold text-white/85">{other.height === 0 ? 'той е на земята' : 'свали го стъпало'}</span>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Не уцелиш ли — пада твоето стъпало.</p>
    </div>
  );
}

function AimPanel({ socket, state, offset }: { socket: ClimbSocket; state: ClimbState; offset: number }) {
  const aim = state.aim!;
  const mine = aim.actorUid === state.you;
  const actor = state.players.find((p) => p.uid === aim.actorUid);
  const [pos, setPos] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [pressed, setPressed] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = Date.now() + offset - aim.startedAt;
      setWaiting(el < 0);
      if (pressed == null) setPos(el < 0 ? 0 : aimMarker(el, aim.periodMs));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aim, offset, pressed]);
  const fire = () => {
    if (!mine || pressed != null) return;
    const el = Date.now() + offset - aim.startedAt;
    if (el < 0) return;
    setPressed(aimMarker(el, aim.periodMs));
    socket.emit('climb:aim', { elapsed: el });
  };
  useEffect(() => {
    if (!mine) return;
    const on = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        fire();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  const shown = pressed ?? pos;
  return (
    <div className="card3d rounded-2xl bg-surface p-4" onPointerDown={mine ? fire : undefined}>
      <p className="mb-3 text-center text-lg font-black">{mine ? (waiting ? 'Приготви се…' : 'Натисни в зеленото!') : `${actor?.name} се прицелва…`}</p>
      <div className="relative h-10 overflow-hidden rounded-full bg-error/80">
        <div className="absolute inset-y-0 bg-primary" style={{ left: `${(aim.zoneCenter - aim.zoneWidth / 2) * 100}%`, width: `${aim.zoneWidth * 100}%` }} />
        <div className="absolute inset-y-[-4px] w-1.5 -translate-x-1/2 rounded bg-ink-strong shadow" style={{ left: `${shown * 100}%` }} />
      </div>
      {mine && (
        <button onClick={fire} disabled={pressed != null || waiting} className="btn3d mt-3 w-full rounded-2xl bg-error py-4 text-lg font-black uppercase text-white [--btn-shadow:var(--color-error-dark)]">
          🎯 Хвърли!
        </button>
      )}
      {mine && <p className="mt-2 text-center text-xs text-muted">Или натисни интервал / докосни лентата.</p>}
    </div>
  );
}

function FinishedPanel({ socket, state }: { socket: ClimbSocket; state: ClimbState }) {
  const won = state.winnerUid === state.you;
  const winner = state.players.find((p) => p.uid === state.winnerUid);
  const delta = state.ratingDelta?.[state.you];
  useEffect(() => play(won ? 'win' : 'lose'), [won]);
  return (
    <div className="card3d rounded-2xl bg-surface p-5 text-center">
      <p className="text-4xl">{won ? '🏆' : state.draw ? '🤝' : '⛰️'}</p>
      <p className="mt-1 text-2xl font-black">{won ? 'Ти стигна до върха!' : state.draw ? 'Равенство!' : `${winner?.name ?? 'Другият'} стигна до върха`}</p>
      {delta != null && (
        <p className={cn('mt-1 font-black', delta >= 0 ? 'text-primary-dark' : 'text-error')}>
          Рейтинг {delta >= 0 ? '+' : ''}
          {delta}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <Button onClick={() => socket.emit('climb:rematch')}>{state.vsBot ? 'Нова игра с бота' : 'Реванш'}</Button>
        {state.matchId && (
          <Link href={`/match/${state.matchId}`} className="font-extrabold text-secondary">
            Разбор на въпросите
          </Link>
        )}
        <Button variant="ghost" onClick={() => socket.emit('climb:leave')}>
          Към началото
        </Button>
      </div>
    </div>
  );
}

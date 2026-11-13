'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_MESSAGES, MAPS, MODE_LABELS, RULES, type AnyAnswer, type GameMode, type GameState, type PublicPlayer } from '@belmaster/shared';
import { Bot, Castle, Check, Clock, Copy, Crown, LogOut, MessageCircle, Swords, Timer, Users, WifiOff, X } from 'lucide-react';
import { Avatar, Badge, Button, ButtonLink, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useGame } from './GameSocketProvider';
import { BattleStage as MapBoard } from './BattleStage';
import { BattlePanel, BattleSounds, Confetti, SoundToggle, useMapBubbles } from './BattleExtras';
import { useCountdown } from './useCountdown';
import { notifyProgress } from '@/components/unlocks/UnlockCelebration';
import { attackOptions, landOwner, pickOptions, territoryCount } from './logic';
import { AnswerInput, hasAnswer, type InputQuestion } from '@/components/quiz/inputs';
import { ContextBox } from '@/components/quiz/ContextBox';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export interface InvitableFriend {
  id: string;
  name: string;
  color: string;
  avatar?: unknown;
}

export function GameRoom({ code, me, friends }: { code: string; me: string; friends: InvitableFriend[] }) {
  const { socket, connected, state, lastError, clearError } = useGame();
  const router = useRouter();
  const joined = useRef(false);

  useEffect(() => {
    if (!socket || !connected) return;
    if (state?.code === code) {
      joined.current = true;
      return;
    }
    if (joined.current) {
      // прехвърлени в друга стая (реванш)
      if (state) router.replace(`/play/${state.code}`);
      return;
    }
    joined.current = true;
    socket.emit('lobby:join', { code });
  }, [socket, connected, state, code, router]);

  if (!connected || !state || state.code !== code) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        {lastError ? (
          <>
            <p className="text-xl font-black">{lastError}</p>
            <ButtonLink href="/play" onClick={clearError}>
              Към битките
            </ButtonLink>
          </>
        ) : (
          <>
            <span className="size-12 animate-spin rounded-full border-4 border-line border-t-secondary" />
            <p className="font-bold text-muted">Свързване със стаята {code}…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {lastError && (
        <div className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-error px-4 py-3 font-bold text-white shadow-lg">
          {lastError}
          <button onClick={clearError} aria-label="Затвори">
            <X className="size-4" />
          </button>
        </div>
      )}
      <BattleSounds state={state} me={me} />
      {state.phase === 'lobby' ? <Lobby state={state} me={me} friends={friends} /> : state.phase === 'finished' ? <Finished state={state} me={me} /> : <Battle state={state} me={me} />}
    </>
  );
}

// ───────────────────────── Лоби ─────────────────────────

function Lobby({ state, me, friends }: { state: GameState; me: string; friends: InvitableFriend[] }) {
  const { socket } = useGame();
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const router = useRouter();
  const isHost = state.hostUid === me;
  const mine = state.players.find((p) => p.uid === me);
  const allReady = state.players.length >= 2 && state.players.every((p) => p.ready);
  const map = MAPS[state.mapId ?? 'island'];
  const link = typeof window !== 'undefined' ? `${window.location.origin}/play/${state.code}` : '';
  const inRoom = new Set(state.players.map((p) => p.uid));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase text-muted">Код на стаята</p>
            <p className="font-mono text-4xl font-black tracking-[0.25em] text-secondary">{state.code}</p>
          </div>
          <Button
            variant="outline"
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Копирано' : 'Копирай линк'}
          </Button>
        </div>

        <div className="card3d overflow-hidden rounded-3xl bg-surface p-2">
          <MapBoard map={map} state={state} selectable={[]} />
        </div>
        <p className="mt-2 text-center text-sm text-muted">
          {map.name} · {map.regions.length} области · {state.players.length <= 2 ? 'малка карта за 1 на 1' : 'голяма карта за 3–4 играчи'}
        </p>
      </section>

      <aside className="space-y-4">
        <div className="card3d rounded-2xl bg-surface p-4">
          <p className="mb-3 font-extrabold">Режим</p>
          <div className="grid gap-2">
            {(Object.keys(MODE_LABELS) as GameMode[]).map((m) => (
              <button
                key={m}
                disabled={!isHost}
                onClick={() => socket?.emit('lobby:mode', { mode: m })}
                className={cn('rounded-xl border-2 p-3 text-left', state.mode === m ? 'border-secondary bg-secondary/10' : 'border-line', !isHost && 'cursor-default')}
              >
                <span className="block font-extrabold text-ink-strong">{MODE_LABELS[m].name}</span>
                <span className="block text-xs text-muted">{MODE_LABELS[m].description}</span>
              </button>
            ))}
          </div>
          {!isHost && <p className="mt-2 text-xs text-muted">Само домакинът избира режима.</p>}
        </div>

        <div className="card3d rounded-2xl bg-surface p-4">
          <p className="mb-3 font-extrabold">
            Играчи ({state.players.length}/{RULES.MAX_PLAYERS})
          </p>
          <ul className="space-y-2">
            {state.players.map((p) => (
              <li key={p.uid} className="flex items-center gap-3">
                <Avatar name={p.name} color={p.color} avatar={p.avatar} seed={p.uid} size={36} />
                <span className="min-w-0 flex-1 truncate font-bold">
                  {p.name} {p.uid === state.hostUid && <Crown className="inline size-4 text-[#e5a400]" />} {p.isGuest && <Badge>гост</Badge>}
                </span>
                {!p.connected ? <WifiOff className="size-4 text-muted" /> : p.ready ? <Badge tone="green">ГОТОВ</Badge> : <Badge>ЧАКА</Badge>}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2">
            <Button variant={mine?.ready ? 'outline' : 'accent'} block onClick={() => socket?.emit('lobby:ready', { ready: !mine?.ready })}>
              {mine?.ready ? 'Не съм готов' : 'Готов съм!'}
            </Button>
            {isHost && (
              <Button block disabled={!allReady} onClick={() => socket?.emit('lobby:start')} icon={<Swords className="size-5" />}>
                Започни битката
              </Button>
            )}
            {isHost && !allReady && <p className="text-center text-xs text-muted">Нужни са поне 2 играчи и всички да са готови.</p>}
          </div>
        </div>

        {friends.length > 0 && (
          <div className="card3d rounded-2xl bg-surface p-4">
            <p className="mb-3 font-extrabold">Покани приятел</p>
            <ul className="space-y-2">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  <Avatar name={f.name} avatar={f.avatar} seed={f.id} size={30} />
                  <span className="flex-1 truncate font-bold">{f.name}</span>
                  {inRoom.has(f.id) ? (
                    <Badge tone="green">в стаята</Badge>
                  ) : invited.has(f.id) ? (
                    <Badge tone="blue">поканен</Badge>
                  ) : (
                    <button
                      onClick={() => {
                        socket?.emit('invite:send', { toUid: f.id, code: state.code });
                        setInvited((s) => new Set(s).add(f.id));
                      }}
                      className="rounded-xl bg-secondary/10 px-3 py-1.5 text-sm font-extrabold text-secondary hover:bg-secondary/20"
                    >
                      Покани
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ChatBar state={state} />

        <button
          onClick={() => {
            socket?.emit('lobby:leave');
            router.push('/play');
          }}
          className="inline-flex w-full items-center justify-center gap-2 py-2 font-extrabold uppercase text-muted hover:text-error"
        >
          <LogOut className="size-4" /> Напусни
        </button>
      </aside>
    </div>
  );
}

// ───────────────────────── Битка ─────────────────────────

function Battle({ state, me }: { state: GameState; me: string }) {
  const { socket } = useGame();
  const router = useRouter();
  const map = MAPS[state.mapId!];
  const meP = state.players.find((p) => p.uid === me);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const bubbles = useMapBubbles(state, map);
  const attackColor = state.battle ? state.players.find((p) => p.uid === state.battle!.attackerUid)?.color : undefined;

  const selectable = useMemo(() => {
    if (state.phase === 'expansion_pick' && state.pick?.uid === me) return pickOptions(state, map, me);
    if (state.phase === 'battle_choose' && state.turnUid === me) return attackOptions(state, map, me);
    return [];
  }, [state, map, me]);

  const onSelect = (id: string) => {
    if (state.phase === 'expansion_pick') socket?.emit('game:pick', { regionId: id });
    else if (state.phase === 'battle_choose') socket?.emit('game:attack', { regionId: id });
  };

  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
  }, [hint]);

  const onBlocked = (id: string) => {
    const reg = state.regions[id];
    const expansion = state.phase.startsWith('expansion');
    if (expansion) {
      if (reg?.owner && reg.owner !== me) setHint('Сега е разпределяне — взимат се само свободни (сиви) области. Атаките започват след това.');
      else if (state.phase === 'expansion_pick' && state.pick?.uid === me) setHint('Избери от мигащите области — свободни и съседни на твоите.');
      else setHint('Изчакай своя ред да избереш област.');
      return;
    }
    if (reg?.owner === me) return setHint('Тази област е твоя.');
    if (state.phase !== 'battle_choose' || state.turnUid !== me) return setHint('Изчакай своя ход, за да атакуваш.');
    setHint('Можеш да атакуваш само области, съседни на твоите (мигащите).');
  };

  const stage = state.phase === 'intro' ? 'Подготовка' : state.phase.startsWith('expansion') ? 'Разпределяне на земите' : `Кръг ${Math.min(state.round, state.maxRounds)} от ${state.maxRounds}`;
  const overlay = useOverlayLayout();

  const header = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 phone-landscape:mb-1 phone-landscape:flex-nowrap">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone="purple" className="phone-landscape:hidden">{MODE_LABELS[state.mode].name}</Badge>
        <span className="truncate font-extrabold text-ink-strong phone-landscape:text-sm">{stage}</span>
      </div>
      <div className="flex items-center gap-3">
        <SoundToggle />
        <FullscreenButton />
        <button onClick={() => setConfirmLeave(true)} className="inline-flex items-center gap-1 text-sm font-extrabold text-muted hover:text-error">
          <LogOut className="size-4" /> Напусни
        </button>
      </div>
    </div>
  );
  const leaveDialog = confirmLeave && (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmLeave(false)}>
      <div className="card3d w-full max-w-sm animate-pop rounded-3xl bg-surface p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-xl font-black">Да напуснеш битката?</p>
        <p className="mt-1 text-muted">Областите ти стават неутрални и губиш битката.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
            Остани
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              socket?.emit('lobby:leave');
              router.push('/play');
            }}
          >
            Напусни
          </Button>
        </div>
      </div>
    </div>
  );

  // компютър и хоризонтален телефон: голяма карта, въпросът изскача върху нея
  if (overlay) {
    return (
      <div data-wide className="mx-auto -mt-2 w-full lg:max-w-[calc((100dvh-340px)*1.5625)] phone-landscape:fixed phone-landscape:inset-0 phone-landscape:z-40 phone-landscape:m-0 phone-landscape:flex phone-landscape:max-w-none phone-landscape:flex-col phone-landscape:bg-bg phone-landscape:px-[max(0.5rem,env(safe-area-inset-left))] phone-landscape:py-1">
        <RotateOverlay />
        {header}
        <PlayersBar state={state} map={map} me={me} />
        <StatusStrip state={state} me={me} meP={meP} />
        <div className="card3d relative mt-2 flex items-center justify-center overflow-hidden rounded-3xl bg-surface p-1.5 phone-landscape:mt-1 phone-landscape:min-h-0 phone-landscape:flex-1 phone-landscape:rounded-2xl phone-landscape:p-0.5">
          <MapBoard
            map={map}
            state={state}
            selectable={selectable}
            onSelect={onSelect}
            onBlocked={onBlocked}
            highlight={state.battle?.regionId ?? null}
            attackColor={attackColor}
            bubbles={bubbles}
            className="phone-landscape:h-full phone-landscape:max-h-full phone-landscape:w-auto phone-landscape:max-w-full"
          />
          <MapOverlays state={state} me={me} meP={meP} />
          {hint && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 animate-pop rounded-xl bg-ink-strong/90 px-3 py-2 text-center text-sm font-bold text-bg">{hint}</div>
          )}
          <div className="absolute bottom-1.5 left-1.5 hidden max-w-[15rem] phone-landscape:block [&>div]:p-2">
            <ChatBar state={state} />
          </div>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_340px] phone-landscape:hidden">
          <BattlePanel state={state} map={map} me={me} />
          <div className="space-y-3">
            <ChatBar state={state} />
            <details className="card3d rounded-2xl bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-extrabold">Дневник на битката</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-muted">
                {[...state.log].reverse().map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
        {leaveDialog}
      </div>
    );
  }

  return (
    <div className="-mt-2 phone-landscape:fixed phone-landscape:inset-0 phone-landscape:z-40 phone-landscape:m-0 phone-landscape:flex phone-landscape:flex-col phone-landscape:bg-bg phone-landscape:px-[max(0.5rem,env(safe-area-inset-left))] phone-landscape:py-1.5">
      <RotateOverlay />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 phone-landscape:mb-1 phone-landscape:flex-nowrap">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone="purple" className="phone-landscape:hidden">{MODE_LABELS[state.mode].name}</Badge>
          <span className="truncate font-extrabold text-ink-strong phone-landscape:text-sm">{stage}</span>
        </div>
        <div className="flex items-center gap-3">
          <SoundToggle />
          <FullscreenButton />
          <button onClick={() => setConfirmLeave(true)} className="inline-flex items-center gap-1 text-sm font-extrabold text-muted hover:text-error">
            <LogOut className="size-4" /> Напусни
          </button>
        </div>
      </div>

      <PlayersBar state={state} map={map} me={me} />

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_400px] phone-landscape:mt-1.5 phone-landscape:min-h-0 phone-landscape:flex-1 phone-landscape:grid-cols-[minmax(0,1fr)_minmax(250px,42%)] phone-landscape:gap-2">
        <div className="space-y-3 self-start lg:sticky lg:top-20 phone-landscape:h-full phone-landscape:space-y-0">
        <div className="card3d relative overflow-hidden rounded-3xl bg-surface p-1.5 phone-landscape:flex phone-landscape:h-full phone-landscape:items-center phone-landscape:justify-center phone-landscape:rounded-2xl phone-landscape:p-1">
          <MapBoard
            map={map}
            state={state}
            selectable={selectable}
            onSelect={onSelect}
            onBlocked={onBlocked}
            highlight={state.battle?.regionId ?? null}
            attackColor={attackColor}
            bubbles={bubbles}
            className="phone-landscape:h-full phone-landscape:max-h-full phone-landscape:w-auto phone-landscape:max-w-full"
          />
          {hint && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 animate-pop rounded-xl bg-ink-strong/90 px-3 py-2 text-center text-sm font-bold text-bg">{hint}</div>
          )}
        </div>
        <BattlePanel state={state} map={map} me={me} />
        </div>
        <div className="space-y-3 phone-landscape:h-full phone-landscape:space-y-2 phone-landscape:overflow-y-auto phone-landscape:overscroll-contain phone-landscape:pb-2">
          <ActionPanel state={state} me={me} meP={meP} />
          <ChatBar state={state} />
          <details className="card3d rounded-2xl bg-surface p-3 text-sm">
            <summary className="cursor-pointer font-extrabold">Дневник на битката</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-muted">
              {[...state.log].reverse().map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmLeave(false)}>
          <div className="card3d w-full max-w-sm animate-pop rounded-3xl bg-surface p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xl font-black">Да напуснеш битката?</p>
            <p className="mt-1 text-muted">Областите ти стават неутрални и губиш битката.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
                Остани
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  socket?.emit('lobby:leave');
                  router.push('/play');
                }}
              >
                Напусни
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Вертикален телефон по време на битка → молба да се завърти. */
function RotateOverlay() {
  return (
    <div className="fixed inset-0 z-[60] hidden flex-col items-center justify-center gap-5 bg-bg p-8 text-center phone-portrait:flex">
      <div className="relative size-28">
        <div className="absolute inset-0 m-auto h-24 w-14 animate-spin-phone rounded-2xl border-4 border-secondary bg-secondary/10">
          <span className="absolute bottom-1.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-secondary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black">Завърти телефона</p>
        <p className="mt-1 text-muted">Битката се играе хоризонтално, за да виждаш цялата карта.</p>
      </div>
      <FullscreenButton big />
    </div>
  );
}

/** Цял екран + заключване хоризонтално (Android/Chrome). На iPhone бутонът не се показва. */
type FsDoc = Document & { webkitFullscreenElement?: Element; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

function FullscreenButton({ big }: { big?: boolean }) {
  const [mode, setMode] = useState<'none' | 'api' | 'ios'>('none');
  const [active, setActive] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const d = document as FsDoc;
    const el = document.documentElement as FsEl;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!touch || standalone) setMode('none');
    else if (typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function') setMode('api');
    else if (/iPhone|iPod|iPad|Macintosh/.test(navigator.userAgent)) setMode('ios');
    const onChange = () => setActive(!!(d.fullscreenElement || d.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);
  if (mode === 'none' || (active && !big)) return null;
  const go = async () => {
    if (mode === 'ios') return setHelp(true);
    try {
      const d = document as FsDoc;
      const el = document.documentElement as FsEl;
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        if (typeof el.requestFullscreen === 'function') await el.requestFullscreen({ navigationUI: 'hide' });
        else await el.webkitRequestFullscreen?.();
      }
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o?.lock?.('landscape');
    } catch {
      /* браузърът не позволява — остава ръчното завъртане */
    }
  };
  return (
    <>
      {big ? (
        <Button variant="secondary" onClick={go}>
          Цял екран
        </Button>
      ) : (
        <button onClick={go} className="hidden text-sm font-extrabold text-secondary phone-landscape:inline">
          Цял екран
        </button>
      )}
      {help && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={() => setHelp(false)}>
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-4 text-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-black">Как да скриеш лентата на Safari</p>
            <p className="mt-2">
              <b>Бързо:</b> натисни <b>„aA“</b> вляво от адреса горе → <b>„Скрий лентата с инструменти“</b>. Връща се с докосване горе.
            </p>
            <p className="mt-2">
              <b>Като приложение:</b> бутон <b>Сподели</b> → <b>„Добави към началния екран“</b>. Отваряш БЕЛ Мастър от иконата — без лентите на браузъра.
            </p>
            <p className="mt-2 text-xs text-muted">На iPhone Apple не позволява на сайтовете сами да влизат в цял екран.</p>
            <Button block className="mt-3" onClick={() => setHelp(false)}>
              Разбрах
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function PlayersBar({ state, map, me }: { state: GameState; map: (typeof MAPS)[string]; me: string }) {
  const lands = map.lands.map((l) => ({ ...l, owner: landOwner(state, map, l.id) }));
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 phone-landscape:gap-1.5 phone-landscape:pb-0">
      {state.players.map((p) => {
        const count = territoryCount(state, p.uid);
        const hp = p.capital ? state.regions[p.capital]?.hp ?? 0 : 0;
        const isTurn = state.turnUid === p.uid || state.pick?.uid === p.uid;
        const ownedLands = lands.filter((l) => l.owner === p.uid).length;
        return (
          <div
            key={p.uid}
            className={cn(
              'card3d flex min-w-40 shrink-0 items-center gap-2.5 rounded-2xl bg-surface px-3 py-2 phone-landscape:min-w-0 phone-landscape:gap-1.5 phone-landscape:rounded-xl phone-landscape:px-2 phone-landscape:py-0.5',
              isTurn && 'border-secondary! bg-secondary/10',
              (p.eliminated || p.left) && 'opacity-40',
            )}
          >
            <Avatar name={p.name} color={p.color} avatar={p.avatar} seed={p.uid} frame={p.frame} size={34} className="phone-landscape:hidden" />
            <span className="hidden size-3 shrink-0 rounded-full phone-landscape:block" style={{ background: p.color }} />
            <div className="min-w-0 phone-landscape:flex phone-landscape:items-center phone-landscape:gap-2">
              <p className="flex items-center gap-1 truncate text-sm font-extrabold text-ink-strong">
                {p.isBot && <Bot className="size-3.5" />}
                {p.name}
                {p.uid === me && <span className="text-muted">(ти)</span>}
              </p>
              <p className="flex items-center gap-2 text-xs font-bold text-muted">
                <span>{count} обл.</span>
                {p.capital && hp > 0 && (
                  <span className="flex items-center gap-0.5 text-error">
                    <Castle className="size-3" />
                    {'♥'.repeat(hp)}
                  </span>
                )}
                {ownedLands > 0 && <span className="text-[#b88600]">★{ownedLands}</span>}
              </p>
              {!p.connected && !p.left && !p.isBot && <Reconnect until={p.reconnectUntil} />}
              {p.left && <p className="text-xs font-bold text-error">напусна</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Reconnect({ until }: { until: number | null }) {
  const left = useCountdown(until);
  return (
    <p className="flex items-center gap-1 text-xs font-bold text-orange">
      <WifiOff className="size-3" /> връщане {Math.ceil(left / 1000)} с
    </p>
  );
}

/** Компютър (мишка, широк екран) или хоризонтален телефон → картата е голяма, панелите изскачат върху нея. */
function useOverlayLayout() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const qs = ['(min-width: 1024px) and (pointer: fine)', '(orientation: landscape) and (pointer: coarse) and (max-height: 540px)'].map((q) => window.matchMedia(q));
    const upd = () => setOn(qs.some((m) => m.matches));
    upd();
    qs.forEach((m) => m.addEventListener('change', upd));
    return () => qs.forEach((m) => m.removeEventListener('change', upd));
  }, []);
  return on;
}

function TopBanner({ children, interactive = false }: { children: React.ReactNode; interactive?: boolean }) {
  return (
    <div className={cn('absolute inset-x-0 top-2 z-10 flex justify-center px-3', !interactive && 'pointer-events-none')}>
      <div className="card3d w-full max-w-md animate-rise rounded-2xl bg-surface/95 p-3 backdrop-blur phone-landscape:max-w-xs phone-landscape:p-2 phone-landscape:text-xs phone-landscape:[&_p]:text-xs">{children}</div>
    </div>
  );
}

/** Какво се вижда върху картата според фазата. */
function MapOverlays({ state, me, meP }: { state: GameState; me: string; meP?: PublicPlayer }) {
  const map = MAPS[state.mapId!];
  const regionName = (id: string) => {
    const reg = state.regions[id];
    return state.mode === 'WORKS' && reg?.workTitle ? `„${reg.workTitle}“` : map.regions.find((r) => r.id === id)?.name ?? id;
  };
  const q = state.question;
  const reveal = state.reveal;
  const qPhase = ['expansion_question', 'battle_question', 'expansion_reveal', 'battle_reveal'].includes(state.phase);

  if (state.phase === 'intro')
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px] phone-landscape:p-1.5">
        <IntroCard state={state} me={me} />
      </div>
    );

  if (qPhase && q) {
    const participant = q.participants.includes(me);
    const answered = state.answeredUids.includes(me);
    const header =
      state.battle && state.phase.startsWith('battle')
        ? `${name(state, state.battle.attackerUid)} ⚔ ${state.battle.defenderUid ? name(state, state.battle.defenderUid) : 'неутрална'} · ${regionName(state.battle.regionId)}`
        : 'Всички отговарят — най-бързите верни избират земя';
    if (reveal)
      return (
        <div className="absolute inset-x-0 top-2 z-10 flex max-h-[calc(100%-1rem)] justify-center px-3">
          <div className="card3d w-full max-w-md animate-rise overflow-y-auto rounded-2xl bg-surface/95 p-3 backdrop-blur phone-landscape:p-2">
            <p className="text-xs font-extrabold uppercase text-muted">{header}</p>
            <RevealBox state={state} me={me} className="mt-2" />
          </div>
        </div>
      );
    if (participant && !answered)
      return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] phone-landscape:p-1.5">
          <div className={cn('max-h-full w-full overflow-y-auto rounded-2xl', q.context ? 'max-w-3xl' : 'max-w-2xl')}>
            <QuestionPanel state={state} me={me} meP={meP} regionName={regionName} />
          </div>
        </div>
      );
    return null;
  }

  return null;
}

/** Тънка лента над картата: чий е ходът и какво да се прави — не закрива полетата. */
function StatusStrip({ state, me, meP }: { state: GameState; me: string; meP?: PublicPlayer }) {
  const q = state.question;
  let text: string | null = null;
  let sub: string | null = null;
  let deadline: number | null = null;
  let total = 1;
  let mine = false;
  if (meP && (meP.eliminated || meP.left) && !q) {
    text = 'Ти си елиминиран 😔 Можеш да гледаш до края.';
  } else if (q && !state.reveal) {
    const participant = q.participants.includes(me);
    const answered = state.answeredUids.includes(me);
    if (!participant || answered) {
      const done = state.answeredUids.filter((u) => q.participants.includes(u)).length;
      text = participant ? 'Отговорът е изпратен — изчакване…' : 'Гледаш този въпрос…';
      sub = q.participants.length > 1 ? `Отговорили: ${done}/${q.participants.length}` : null;
      deadline = q.deadline;
      total = q.timeMs;
    }
  } else if (state.phase === 'expansion_pick' && state.pick) {
    mine = state.pick.uid === me;
    text = mine ? 'Избери свободна област на картата!' : `${name(state, state.pick.uid)} избира област…`;
    sub = mine ? 'Мигащите са свободни и съседни на твоите. Ако не избереш — получаваш случайна.' : null;
    deadline = state.deadline;
    total = RULES.EXPANSION_PICK_MS;
  } else if (state.phase === 'battle_choose') {
    mine = state.turnUid === me;
    text = mine ? `Твой ход! Избери съседна област за атака.${state.attacksLeft > 1 ? ` (★ ${state.attacksLeft} атаки)` : ''}` : `${name(state, state.turnUid)} избира атака…`;
    sub = mine ? 'Мигащите можеш да нападнеш. Печелиш, ако отговориш вярно и по-бързо от защитника.' : null;
    deadline = state.deadline;
    total = RULES.ATTACK_CHOOSE_MS;
  }
  return (
    <div className="mt-2 flex min-h-12 items-center phone-landscape:mt-1 phone-landscape:min-h-8">
      {text && (
        <div className={cn('card3d flex w-full animate-rise items-center gap-3 rounded-2xl px-3 py-2 phone-landscape:rounded-xl phone-landscape:px-2 phone-landscape:py-1', mine ? 'border-secondary! bg-secondary/10' : 'bg-surface')}>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-black phone-landscape:text-xs', mine && 'text-secondary-dark')}>{text}</p>
            {sub && <p className="truncate text-xs text-muted phone-landscape:hidden">{sub}</p>}
          </div>
          {deadline && (
            <div className="w-40 shrink-0 phone-landscape:w-28">
              <TimerBar deadline={deadline} total={total} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Подготовка преди първия въпрос: кой с кого е, къде са столиците, кратки правила, обратно броене. */
function IntroCard({ state, me }: { state: GameState; me: string }) {
  const left = useCountdown(state.deadline);
  const sec = Math.ceil(left / 1000);
  const meP = state.players.find((p) => p.uid === me);
  const works = state.mode === 'WORKS';
  return (
    <div className="card3d w-full max-w-xl animate-rise rounded-3xl bg-surface p-6 text-center phone-landscape:max-h-full phone-landscape:overflow-y-auto phone-landscape:p-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{MODE_LABELS[state.mode].name}</p>
      <p className="mt-1 text-2xl font-black text-ink-strong phone-landscape:text-lg">Пригответе се!</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 phone-landscape:hidden">
        {state.players.map((p) => (
          <span key={p.uid} className="flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-extrabold" style={{ borderColor: p.color }}>
            <span className="size-3 rounded-full" style={{ background: p.color }} />
            {p.name}
            {p.uid === me && <span className="text-muted">(ти)</span>}
          </span>
        ))}
      </div>
      {meP && (
        <p className="mt-3 text-sm font-bold phone-landscape:mt-1 phone-landscape:text-xs">
          Ти си <span style={{ color: meP.color }}>■ този цвят</span> — столицата ти (🏰) вече е на картата.
        </p>
      )}
      <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-ink phone-landscape:mt-2 phone-landscape:text-xs">
        <li>1️⃣ <b>Разпределяне:</b> всички отговарят на един въпрос — най-бързите верни избират свободна земя.</li>
        <li>2️⃣ <b>Битка:</b> по ред нападаш съседна област. Печелиш, ако отговориш вярно и по-бързо от защитника.</li>
        <li>3️⃣ <b>Столица:</b> пада след 3 загубени битки — и всичките ѝ области стават твои.</li>
        {works && <li>📚 Всяко поле е произведение — при атака въпросът е за неговата творба.</li>}
      </ul>
      <div className="mt-5 flex items-center justify-center gap-3 phone-landscape:mt-2">
        <span className="text-sm font-extrabold text-muted">Първият въпрос след</span>
        <span key={sec} className="flex size-14 animate-pop items-center justify-center rounded-full bg-secondary text-3xl font-black text-white phone-landscape:size-10 phone-landscape:text-xl">{sec}</span>
      </div>
    </div>
  );
}

function TimerBar({ deadline, total }: { deadline: number | null; total: number }) {
  const left = useCountdown(deadline);
  const pct = Math.min(100, (left / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <Clock className={cn('size-4', left < 5000 ? 'text-error' : 'text-secondary')} />
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full transition-[width] duration-200', left < 5000 ? 'bg-error' : 'bg-secondary')} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-black tabular-nums">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function name(state: GameState, uid: string | null | undefined) {
  return state.players.find((p) => p.uid === uid)?.name ?? '—';
}

function ActionPanel({ state, me, meP, bare = false }: { state: GameState; me: string; meP?: PublicPlayer; bare?: boolean }) {
  const Box = bare ? BareBox : Panel;
  const map = MAPS[state.mapId!];
  const regionName = (id: string) => {
    const reg = state.regions[id];
    return state.mode === 'WORKS' && reg?.workTitle ? `„${reg.workTitle}“` : map.regions.find((r) => r.id === id)?.name ?? id;
  };

  if (meP && (meP.eliminated || meP.left) && !state.question) {
    return (
      <Box>
        <p className="text-lg font-black">Ти си елиминиран 😔</p>
        <p className="text-muted">Можеш да гледаш до края на битката.</p>
      </Box>
    );
  }

  if (state.phase === 'intro') return <IntroCard state={state} me={me} />;

  if (state.phase === 'expansion_question' || state.phase === 'battle_question' || state.phase === 'expansion_reveal' || state.phase === 'battle_reveal') {
    return <QuestionPanel state={state} me={me} meP={meP} regionName={regionName} />;
  }

  if (state.phase === 'expansion_pick' && state.pick) {
    const mine = state.pick.uid === me;
    return (
      <Box>
        <TimerBar deadline={state.deadline} total={RULES.EXPANSION_PICK_MS} />
        <p className="mt-3 text-lg font-black">{mine ? 'Избери свободна област на картата!' : `${name(state, state.pick.uid)} избира област…`}</p>
        {mine && <p className="text-sm text-muted">Мигащите области са свободни и съседни на твоите. Ако не избереш — получаваш случайна.</p>}
        <p className="mt-2 text-xs font-bold text-muted">Първо се разпределят свободните земи. Атаките по чужди области започват след това.</p>
        {state.pick.queue.length > 1 && <p className="mt-2 text-sm text-muted">След това: {state.pick.queue.slice(1).map((u) => name(state, u)).join(', ')}</p>}
      </Box>
    );
  }

  if (state.phase === 'battle_choose') {
    const mine = state.turnUid === me;
    return (
      <Box>
        <TimerBar deadline={state.deadline} total={RULES.ATTACK_CHOOSE_MS} />
        <p className="mt-3 text-lg font-black">{mine ? 'Твой ход! Избери съседна област за атака.' : `${name(state, state.turnUid)} избира атака…`}</p>
        {mine && state.attacksLeft > 1 && <Badge tone="yellow" className="mt-2">★ Бонус за земя: {state.attacksLeft} атаки този ход</Badge>}
        {mine && <p className="mt-1 text-sm text-muted">Мигащите области можеш да нападнеш. Печелиш, ако отговориш вярно и по-бързо от защитника. Столица (🏰) пада след 3 победи — и взимаш всичките му области.</p>}
      </Box>
    );
  }

  return null;
}

function QuestionPanel({ state, me, meP, regionName }: { state: GameState; me: string; meP?: PublicPlayer; regionName: (id: string) => string }) {
  const { socket, fifty, hint } = useGame();
  const q = state.question!;
  const reveal = state.reveal;
  const participant = q.participants.includes(me);
  const answered = state.answeredUids.includes(me);
  const [answer, setAnswer] = useState<AnyAnswer | undefined>(undefined);
  const removed = fifty?.questionId === q.id ? new Set(fifty.removed) : new Set<number>();

  useEffect(() => {
    setAnswer(undefined);
  }, [q.id]);

  const send = (payload: AnyAnswer) => {
    if (!participant || answered || reveal) return;
    socket?.emit('game:answer', { questionId: q.id, ...payload });
  };
  const instant = q.type === 'SINGLE_CHOICE';
  const iq: InputQuestion = { id: q.id, type: q.type, options: q.options, answerCount: q.answerCount, matching: q.matching, blanks: q.blanks, tokens: q.tokens, hint: hint?.questionId === q.id ? hint.index : null };

  const myResult = reveal?.results.find((r) => r.uid === me);
  const header =
    state.battle && state.phase.startsWith('battle')
      ? `${name(state, state.battle.attackerUid)} ⚔ ${state.battle.defenderUid ? name(state, state.battle.defenderUid) : 'неутрална'} · ${regionName(state.battle.regionId)}`
      : 'Всички отговарят — най-бързите верни избират земя';

  return (
    <Panel className={cn(reveal && (reveal.winnerUid === me ? 'border-primary!' : myResult && !myResult.correct ? 'border-error!' : ''))}>
      <p className="mb-2 text-xs font-extrabold uppercase text-muted">{header}</p>
      {!reveal && <TimerBar deadline={q.deadline} total={q.timeMs} />}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="blue">{q.topicLabel}</Badge>
        {q.workTitle && <Badge tone="yellow">{q.workTitle}</Badge>}
      </div>
      <p className="mt-2 whitespace-pre-line text-lg font-extrabold leading-snug text-ink-strong phone-landscape:mt-1 phone-landscape:text-[15px]">{q.prompt}</p>
      {q.context && <ContextBox text={q.context} compact />}

      <div className="mt-3 phone-landscape:mt-2">
        <AnswerInput
          q={iq}
          value={answer}
          compact
          removed={removed}
          disabled={!participant || answered || !!reveal}
          autoFocus={participant && q.type === 'SHORT_ANSWER'}
          reveal={reveal ? { correctIndex: reveal.correctIndex, correctPairs: reveal.correctPairs, correctBlanks: reveal.correctBlanks, correctMarks: reveal.correctMarks } : null}
          onChange={(a) => {
            setAnswer(a);
            if (instant) send(a);
          }}
          onSubmit={() => answer && hasAnswer(iq, answer) && send(answer)}
        />
        {!instant && participant && !answered && !reveal && (
          <Button className="mt-3" block disabled={!hasAnswer(iq, answer)} onClick={() => answer && send(answer)}>
            Изпрати
          </Button>
        )}
      </div>

      {/* жокери */}
      {participant && !answered && !reveal && meP && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={!meP.jokers.fifty || q.type !== 'SINGLE_CHOICE' || q.options.length < 3}
            onClick={() => socket?.emit('game:joker', { kind: 'fifty' })}
            className="rounded-xl border-2 border-purple/50 bg-purple/10 px-3 py-1.5 text-sm font-extrabold text-purple-dark disabled:opacity-30"
          >
            50/50
          </button>
          <button
            disabled={!meP.jokers.time}
            onClick={() => socket?.emit('game:joker', { kind: 'time' })}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-secondary/50 bg-secondary/10 px-3 py-1.5 text-sm font-extrabold text-secondary disabled:opacity-30"
          >
            <Timer className="size-4" /> +5 с
          </button>
        </div>
      )}

      {!reveal && (
        <p className="mt-3 text-sm font-bold text-muted">
          {!participant ? 'Гледаш тази битка.' : answered ? 'Отговорът е изпратен. Изчакване…' : ''}
          {q.participants.length > 1 && (
            <span className="ml-1">
              Отговорили: {state.answeredUids.filter((u) => q.participants.includes(u)).length}/{q.participants.length}
            </span>
          )}
        </p>
      )}

      {reveal && <RevealBox state={state} me={me} />}
    </Panel>
  );
}


/** Резултатът след въпроса — кой позна, верният отговор, времената. */
function RevealBox({ state, me, className }: { state: GameState; me: string; className?: string }) {
  const q = state.question!;
  const reveal = state.reveal!;
  const myResult = reveal.results.find((r) => r.uid === me);
  return (
        <div className={cn('mt-4 animate-rise rounded-xl bg-surface-2 p-3', className)}>
          {myResult && (
            <p className={cn('mb-2 rounded-lg px-3 py-2 text-sm font-black text-white', myResult.correct ? 'bg-primary' : myResult.score > 0 ? 'bg-orange' : 'bg-error')}>
              {myResult.correct
                ? `✔ Отговори вярно за ${((myResult.timeMs ?? 0) / 1000).toFixed(2)} с`
                : myResult.score > 0
                  ? `◐ Частично вярно: ${Math.round(myResult.score * 100)}% за ${((myResult.timeMs ?? 0) / 1000).toFixed(2)} с`
                  : myResult.timeMs == null
                  ? '✘ Не отговори навреме'
                  : `✘ Грешен отговор${myResult.index != null ? ` (${LETTERS[myResult.index]})` : myResult.text ? ` („${myResult.text}“)` : ''}`}
            </p>
          )}
          <p className="font-black text-ink-strong">{reveal.message}</p>
          {reveal.correctIndex != null && q.options[reveal.correctIndex] && (
            <p className="mt-1 text-sm font-bold text-primary-dark">
              Верен отговор: {LETTERS[reveal.correctIndex]}) {q.options[reveal.correctIndex]}
            </p>
          )}
          {reveal.correctText && <p className="mt-1 text-sm font-bold text-primary-dark">Верен отговор: {reveal.correctText}</p>}
          {reveal.explanation && <p className="mt-1 text-sm text-muted">{reveal.explanation}</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {reveal.results.map((r) => (
              <li key={r.uid} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  {r.correct ? <Check className="size-4 text-primary" /> : r.score > 0 ? <Check className="size-4 text-orange" /> : <X className="size-4 text-error" />}
                  {name(state, r.uid)}
                </span>
                <span className="tabular-nums text-muted">
                  {r.score > 0 && r.score < 1 ? `${Math.round(r.score * 100)}% · ` : ''}
                  {r.timeMs != null ? `${(r.timeMs / 1000).toFixed(2)} с` : 'без отговор'}
                </span>
              </li>
            ))}
          </ul>
        </div>
  );
}

function BareBox({ children }: { children: React.ReactNode; className?: string }) {
  return <div>{children}</div>;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('card3d animate-rise rounded-2xl bg-surface p-4 phone-landscape:p-2.5', className)}>{children}</div>;
}

function ChatBar({ state }: { state: GameState }) {
  const { socket, chat } = useGame();
  const [open, setOpen] = useState(false);
  const recent = chat.filter((c) => Date.now() - c.at < 60_000).slice(-4);
  void state;
  return (
    <div className="card3d rounded-2xl bg-surface p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 text-sm font-extrabold text-ink">
          <MessageCircle className="size-4" /> Чат
        </button>
      </div>
      {recent.length > 0 && (
        <ul className="mt-2 space-y-1">
          {recent.map((c, i) => (
            <li key={`${c.at}-${i}`} className="animate-rise text-sm">
              <span className="font-extrabold" style={{ color: c.color }}>
                {c.name}:
              </span>{' '}
              {CHAT_MESSAGES.find((m) => m.key === c.key)?.text}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CHAT_MESSAGES.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                socket?.emit('chat:send', { key: m.key });
                setOpen(false);
              }}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-bold hover:bg-line"
            >
              {m.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Край ─────────────────────────

function Finished({ state, me }: { state: GameState; me: string }) {
  const { socket } = useGame();
  const router = useRouter();
  const standings = state.standings ?? [];
  const winner = standings[0];
  const mine = standings.find((s) => s.uid === me);
  const map = MAPS[state.mapId!];
  // XP се записва на игровия сървър — проверяваме за ново ниво малко след края
  useEffect(() => notifyProgress(4500), []);

  return (
    <div className="mx-auto max-w-3xl">
      {standings[0]?.uid === me && <Confetti />}
      <div className="animate-pop text-center">
        <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-accent text-[#4b3b00] shadow-[0_6px_0_var(--color-accent-dark)]">
          <Crown className="size-12" />
        </div>
        <h1 className="text-3xl font-black">{winner?.uid === me ? 'Победа! 🎉' : `${winner?.name ?? '—'} печели!`}</h1>
        <p className="mt-1 text-muted">{mine ? `Ти си ${mine.place}. място с ${mine.territories} области.` : ''}</p>
      </div>

      <ol className="card3d mt-6 divide-y-2 divide-line rounded-2xl bg-surface">
        {standings.map((s) => (
          <li key={s.uid} className={cn('flex items-center gap-3 px-4 py-3', s.uid === me && 'bg-secondary/10')}>
            <span className="w-6 text-center text-lg font-black text-muted">{s.place}</span>
            <Avatar name={s.name} color={s.color} avatar={state.players.find((x) => x.uid === s.uid)?.avatar} seed={s.uid} size={38} />
            <span className="flex-1 font-extrabold text-ink-strong">
              {s.name} {s.isBot && <Badge>бот</Badge>}
            </span>
            <span className="text-sm text-muted">
              {s.territories} обл. · {s.correct}/{s.answered}
            </span>
            {s.ratingDelta != null && (
              <span className={cn('w-12 text-right font-black', s.ratingDelta >= 0 ? 'text-primary' : 'text-error')}>
                {s.ratingDelta >= 0 ? '+' : ''}
                {s.ratingDelta}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="card3d mt-4 overflow-hidden rounded-3xl bg-surface p-1.5">
        <MapBoard map={map} state={state} selectable={[]} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button
          onClick={() => {
            if (state.rematchCode) router.push(`/play/${state.rematchCode}`);
            else socket?.emit('rematch:request');
          }}
          icon={<Swords className="size-5" />}
        >
          {state.rematchCode ? 'Влез в реванша' : 'Реванш'}
        </Button>
        {state.matchId ? (
          <ButtonLink href={`/match/${state.matchId}`} variant="secondary">
            Разбор
          </ButtonLink>
        ) : (
          <Button variant="secondary" disabled>
            Записване…
          </Button>
        )}
        <Button
          variant="outline"
          icon={<Users className="size-5" />}
          onClick={() => {
            socket?.emit('lobby:leave');
            router.push('/play');
          }}
        >
          Към битките
        </Button>
      </div>
      <a href="/tests/mistakes" className="mt-4 flex items-center justify-between rounded-2xl border-2 border-line bg-surface px-4 py-3 font-extrabold text-ink hover:bg-surface-2">
        <span>🔁 Упражни грешките си от битките и тестовете</span>
        <span className="text-secondary">→</span>
      </a>
      <ChatBarFinished state={state} />
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/leaderboard" className="font-bold text-secondary">
          Виж класацията
        </Link>
      </p>
    </div>
  );
}

function ChatBarFinished({ state }: { state: GameState }) {
  return (
    <div className="mt-4">
      <ChatBar state={state} />
    </div>
  );
}

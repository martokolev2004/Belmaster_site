'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHAT_MESSAGES, RULES, type GameMap, type GameState } from '@belmaster/shared';
import { Castle, Swords, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { play, setSoundEnabled, soundEnabled } from '@/lib/sound';
import { useGame } from './GameSocketProvider';
import { landOwner, territoryCount } from './logic';
import type { MapBubble } from './MapBoard';

/** Звуци при промени в състоянието на битката. */
export function useBattleSounds(state: GameState, me: string) {
  const prev = useRef<GameState | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p || p.code !== state.code) return;
    // моят резултат след въпрос
    if (state.reveal && !p.reveal) {
      const mine = state.reveal.results.find((r) => r.uid === me);
      if (mine) play(mine.correct ? 'correct' : mine.score > 0 ? 'correct' : 'wrong');
    }
    // завладяни / загубени области, удар по столица
    let gained = false;
    let lost = false;
    let hit = false;
    for (const [id, r] of Object.entries(state.regions)) {
      const o = p.regions[id];
      if (!o) continue;
      if (o.owner !== r.owner) {
        if (r.owner === me) gained = true;
        else if (o.owner === me) lost = true;
      }
      if (r.capital && r.hp < o.hp) hit = true;
    }
    if (hit) play('hit');
    else if (gained) play('capture');
    else if (lost) play('lost');
    // мой ход
    const myTurn = (s: GameState) => (s.phase === 'battle_choose' && s.turnUid === me) || (s.phase === 'expansion_pick' && s.pick?.uid === me);
    if (myTurn(state) && !myTurn(p)) play('turn');
    // край
    if (state.phase === 'finished' && p.phase !== 'finished') play(state.standings?.[0]?.uid === me ? 'win' : 'lose');
  }, [state, me]);
}

/** Емоджита от чата — изскачат над столицата (или първата област) на играча. */
export function useMapBubbles(state: GameState, map: GameMap): MapBubble[] {
  const { chat } = useGame();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    const recent = chat.filter((c) => now - c.at < 2600).slice(-4);
    return recent.map((c, i) => {
      const p = state.players.find((x) => x.uid === c.uid);
      const regionId = p?.capital && state.regions[p.capital]?.owner === c.uid ? p.capital : Object.entries(state.regions).find(([, r]) => r.owner === c.uid)?.[0];
      const reg = map.regions.find((r) => r.id === regionId);
      const [x, y] = reg ? reg.center : [map.width / 2, map.height / 2];
      const msg = CHAT_MESSAGES.find((m) => m.key === c.key)?.text ?? '';
      // за картата: само емоджито, ако има (по-кратко)
      const emoji = msg.match(/\p{Extended_Pictographic}/u)?.[0];
      return { id: `${c.at}-${i}`, x, y: y - i * 6, text: emoji ?? msg, color: c.color };
    });
  }, [chat, now, state, map]);
}

export function BattleSounds({ state, me }: { state: GameState; me: string }) {
  useBattleSounds(state, me);
  return null;
}

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundEnabled()), []);
  return (
    <button
      onClick={() => {
        setSoundEnabled(!on);
        setOn(!on);
        if (!on) play('turn');
      }}
      className="inline-flex items-center gap-1 text-sm font-extrabold text-muted hover:text-ink"
      aria-label={on ? 'Изключи звука' : 'Включи звука'}
      title={on ? 'Изключи звука' : 'Включи звука'}
    >
      {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  );
}

/** Таблица на живо под картата (на телефон хоризонтално е скрита — там няма място). */
export function BattlePanel({ state, map, me }: { state: GameState; map: GameMap; me: string }) {
  const lands = map.lands.map((l) => ({ ...l, owner: landOwner(state, map, l.id), size: map.regions.filter((r) => r.land === l.id).length }));
  const rows = [...state.players]
    .map((p) => ({ p, count: territoryCount(state, p.uid), hp: p.capital ? state.regions[p.capital]?.hp ?? 0 : 0, lands: lands.filter((l) => l.owner === p.uid) }))
    .sort((a, b) => Number(a.p.eliminated || a.p.left) - Number(b.p.eliminated || b.p.left) || b.count - a.count);
  const total = map.regions.length;
  const expansion = state.phase.startsWith('expansion');
  const free = Object.values(state.regions).filter((r) => !r.owner).length;
  const roundPct = expansion ? ((total - free) / total) * 100 : (Math.min(state.round, state.maxRounds) / state.maxRounds) * 100;

  return (
    <div className="card3d rounded-2xl bg-surface p-4 phone-landscape:hidden">
      <div className="mb-3 flex items-center justify-between text-sm font-extrabold">
        <span>{expansion ? `Разпределени ${total - free} от ${total} области` : `Кръг ${Math.min(state.round, state.maxRounds)} от ${state.maxRounds}`}</span>
        {!expansion && <span className="text-muted">остават {Math.max(0, state.maxRounds - state.round)}</span>}
      </div>
      <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-secondary transition-[width] duration-700" style={{ width: `${roundPct}%` }} />
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs font-extrabold uppercase text-muted">
          <tr>
            <th className="pb-2">Играч</th>
            <th className="pb-2 text-center">Области</th>
            <th className="pb-2 text-center">Столица</th>
            <th className="pb-2">Земи</th>
            <th className="pb-2 text-right">Верни</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, count, hp, lands: owned }) => {
            const turn = state.turnUid === p.uid || state.pick?.uid === p.uid;
            const out = p.eliminated || p.left;
            return (
              <tr key={p.uid} className={cn('border-t-2 border-line', out && 'opacity-40', turn && 'bg-secondary/8')}>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <Avatar name={p.name} color={p.color} avatar={p.avatar} seed={p.uid} frame={p.frame} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold text-ink-strong">
                        {p.name}
                        {p.uid === me && <span className="font-bold text-muted"> (ти)</span>}
                      </span>
                      <span className="block text-xs font-bold text-muted">
                        {turn ? (
                          <span className="inline-flex items-center gap-1 text-secondary">
                            <Swords className="size-3" /> на ход
                          </span>
                        ) : out ? (
                          p.left ? 'напусна' : 'елиминиран'
                        ) : !p.connected ? (
                          <span className="inline-flex items-center gap-1 text-orange">
                            <WifiOff className="size-3" /> изпадна
                          </span>
                        ) : (
                          ' '
                        )}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="py-2 text-center">
                  <span className="font-black text-ink-strong">{count}</span>
                  <span className="block text-[10px] font-bold text-muted">{Math.round((count / total) * 100)}%</span>
                </td>
                <td className="py-2 text-center">
                  {p.capital && hp > 0 ? (
                    <span className="inline-flex items-center gap-0.5 font-black text-error">
                      <Castle className="size-3.5" />
                      {'♥'.repeat(hp)}
                      <span className="text-line">{'♥'.repeat(RULES.CAPITAL_HP - hp)}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-muted">паднала</span>
                  )}
                </td>
                <td className="py-2">
                  {owned.length ? (
                    <span className="flex flex-wrap gap-1">
                      {owned.map((l) => (
                        <span key={l.id} className="rounded-full bg-accent/25 px-2 py-0.5 text-[11px] font-extrabold text-[#8a6500]" title="Цяла земя: 2 атаки на ход">
                          ★ {l.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="py-2 text-right font-bold tabular-nums">
                  {p.correct}/{p.answered}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 border-t-2 border-line pt-3">
        <p className="mb-2 text-xs font-extrabold uppercase text-muted">Земи — цяла земя дава 2 атаки на ход</p>
        <div className="flex flex-wrap gap-2">
          {lands.map((l) => {
            const owner = state.players.find((p) => p.uid === l.owner);
            const inLand = map.regions.filter((r) => r.land === l.id);
            return (
              <span key={l.id} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line px-2 py-1 text-xs font-bold">
                <span className="flex gap-0.5">
                  {inLand.map((r) => {
                    const o = state.players.find((p) => p.uid === state.regions[r.id]?.owner);
                    return <span key={r.id} className="size-2.5 rounded-sm" style={{ background: o?.color ?? 'var(--line)' }} />;
                  })}
                </span>
                {l.name}
                {owner && <span style={{ color: owner.color }}>★</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Конфети при победа. */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.4 + Math.random() * 1.8,
        dx: `${(Math.random() - 0.5) * 30}vw`,
        color: ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'][i % 6],
        w: 6 + Math.random() * 6,
      })),
    [],
  );
  // направо в <body> — иначе родител с transform/blur ограничава „fixed“ и конфетите не се виждат
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            background: p.color,
            animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in both`,
            ['--dx' as string]: p.dx,
          }}
        />
      ))}
    </div>,
    host,
  );
}

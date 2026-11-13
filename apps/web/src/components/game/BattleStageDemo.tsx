'use client';

/** ТЕСТ: новата карта за „Битка“ — играчите завладяват сами (и с клик), без въпроси и без сървър. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAPS, PLAYER_COLORS, type GameState } from '@belmaster/shared';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { BattleStage } from './BattleStage';

const LIST = [
  { id: 'island', label: 'Островът', n: 2 },
  { id: 'river-s', label: 'Реката', n: 2 },
  { id: 'lake-s', label: 'Езерото', n: 2 },
  { id: 'continent', label: 'Континентът', n: 4 },
];
const NAMES = ['Ти', 'Ива', 'Боян', 'Мира'];
type Regions = GameState['regions'];

export function BattleStageDemo() {
  const [mapId, setMapId] = useState('island');
  const item = LIST.find((m) => m.id === mapId)!;
  const map = MAPS[mapId];
  const players = useMemo(() => Array.from({ length: item.n }, (_, i) => ({ uid: `p${i}`, name: NAMES[i], color: PLAYER_COLORS[i], avatar: null })) as unknown as GameState['players'], [item.n]);
  const fresh = useCallback((): Regions => {
    const caps = map.capitals[String(item.n)] ?? [];
    return Object.fromEntries(map.regions.map((r) => [r.id, { owner: caps.includes(r.id) ? `p${caps.indexOf(r.id)}` : null, capital: caps.includes(r.id), hp: 3 }])) as unknown as Regions;
  }, [map, item.n]);
  const [regions, setRegions] = useState<Regions>(fresh);
  const [turn, setTurn] = useState(0);
  const [aim, setAim] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const live = useRef({ regions, turn });
  live.current = { regions, turn };

  useEffect(() => {
    setRegions(fresh());
    setTurn(0);
    setAim(null);
  }, [fresh]);

  const targets = useCallback(
    (uid: string, regs: Regions) => {
      const out = new Set<string>();
      for (const r of map.regions) if (regs[r.id]?.owner === uid) for (const n of r.neighbors) if (regs[n] && regs[n].owner !== uid) out.add(n);
      return [...out];
    },
    [map],
  );

  const strike = useCallback(
    (rid: string) => {
      const uid = `p${live.current.turn}`;
      setAim(rid);
      setTimeout(() => {
        setRegions((regs) => {
          const r = regs[rid];
          if (!r) return regs;
          const next = r.capital && r.owner && r.hp > 1 ? { ...r, hp: r.hp - 1 } : { ...r, owner: uid, capital: false, hp: 3 };
          return { ...regs, [rid]: next };
        });
        setAim(null);
        setTurn((t) => (t + 1) % item.n);
      }, 1100);
    },
    [item.n],
  );

  // сама игра: всеки ход — една случайна съседна област
  useEffect(() => {
    if (!auto || aim) return;
    const t = setTimeout(() => {
      const { regions: regs, turn: tn } = live.current;
      const list = targets(`p${tn}`, regs);
      if (new Set(Object.values(regs).map((r) => r.owner)).size === 1) return setRegions(fresh());
      if (!list.length) return setTurn((x) => (x + 1) % item.n);
      // първо свободните, после чуждите
      const free = list.filter((id) => !regs[id].owner);
      const pool = free.length && Math.random() < 0.75 ? free : list;
      strike(pool[Math.floor(Math.random() * pool.length)]);
    }, 900);
    return () => clearTimeout(t);
  }, [auto, aim, turn, regions, targets, strike, fresh, item.n]);

  const state = { players, regions, mode: 'CLASSIC' } as unknown as Pick<GameState, 'players' | 'regions' | 'mode'>;
  const mine = !auto && !aim ? targets(`p${turn}`, regions) : [];

  return (
    <div className="bsd">
      <p className="ln-eyebrow">Тест</p>
      <h1 className="ln-display nx-h1">
        Битка — <span className="ln-grad">нов вид</span>
      </h1>
      <p className="nx-sub">Само картата, без въпроси. Играчите завладяват сами; спри „Авто“ и кликай по светещите области, за да играеш на ръка.</p>
      <div className="bsd-bar">
        {LIST.map((m) => (
          <button key={m.id} onClick={() => setMapId(m.id)} className={`ln-btn ln-btn-sm ${m.id === mapId ? 'ln-btn-primary' : 'ln-btn-ghost'}`}>
            {m.label}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={() => setAuto((a) => !a)} className="ln-btn ln-btn-sm ln-btn-ghost">
          {auto ? 'Спри авто' : 'Авто'}
        </button>
        <button onClick={() => setRegions(fresh())} className="ln-btn ln-btn-sm ln-btn-ghost">
          Отначало
        </button>
      </div>
      <div className="bsd-players">
        {players.map((p, i) => (
          <div key={p.uid} className="bsd-player" data-turn={i === turn} style={{ '--c': p.color } as React.CSSProperties}>
            <UserAvatar avatar={p.avatar} name={p.uid} size={32} />
            {p.name}
            <b className="ln-display">{Object.values(regions).filter((r) => r.owner === p.uid).length}</b>
          </div>
        ))}
      </div>
      <BattleStage map={map} state={state} selectable={mine} onSelect={strike} highlight={aim} attackColor={players[turn]?.color} />
    </div>
  );
}

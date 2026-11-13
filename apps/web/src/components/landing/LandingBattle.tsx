'use client';

/** Жива карта на „Битка“ за началната страница — играчите завладяват сами, без въпроси и без сървър. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONTINENT_MAP, PLAYER_COLORS, type GameState } from '@belmaster/shared';
import { BattleStage } from '@/components/game/BattleStage';

type Regions = GameState['regions'];
const N = 4;
const map = CONTINENT_MAP;

/** preset: колко хода да са изиграни предварително (за снимка) */
export function LandingBattle({ preset = 0, still = false }: { preset?: number; still?: boolean }) {
  const players = useMemo(() => Array.from({ length: N }, (_, i) => ({ uid: `p${i}`, name: '', color: PLAYER_COLORS[i], avatar: null })) as unknown as GameState['players'], []);
  const targets = (uid: string, regs: Regions) => {
    const out = new Set<string>();
    for (const r of map.regions) if (regs[r.id]?.owner === uid) for (const n of r.neighbors) if (regs[n] && regs[n].owner !== uid) out.add(n);
    return [...out];
  };
  const fresh = useCallback((): Regions => {
    const caps = map.capitals[String(N)] ?? [];
    const regs = Object.fromEntries(map.regions.map((r) => [r.id, { owner: caps.includes(r.id) ? `p${caps.indexOf(r.id)}` : null, capital: caps.includes(r.id), hp: 3 }])) as unknown as Regions;
    // няколко хода предварително, за да не започва от празна карта
    for (let k = 0; k < preset; k++) {
      const uid = `p${k % N}`;
      const free = targets(uid, regs).filter((id) => !regs[id].owner);
      if (free.length) regs[free[(k * 7) % free.length]] = { ...regs[free[(k * 7) % free.length]], owner: uid };
    }
    return regs;
  }, [preset]);
  const [regions, setRegions] = useState<Regions>(fresh);
  const [turn, setTurn] = useState(0);
  const [aim, setAim] = useState<string | null>(null);
  const live = useRef({ regions, turn });
  live.current = { regions, turn };
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  // играе само докато се вижда
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (seen.current = e.isIntersecting), { threshold: 0.2 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || aim) return;
    const t = setTimeout(() => {
      if (!seen.current) return setTurn((x) => x); // чака
      const { regions: regs, turn: tn } = live.current;
      const uid = `p${tn}`;
      if (new Set(Object.values(regs).map((r) => r.owner)).size === 1 || Object.values(regs).filter((r) => !r.owner).length === 0 && Math.random() < 0.06) return setRegions(fresh());
      const list = targets(uid, regs);
      if (!list.length) return setTurn((x) => (x + 1) % N);
      const free = list.filter((id) => !regs[id].owner);
      const rid = (free.length && Math.random() < 0.8 ? free : list)[Math.floor(Math.random() * (free.length && Math.random() < 0.8 ? free.length : list.length))] ?? list[0];
      setAim(rid);
      setTimeout(() => {
        setRegions((rs) => {
          const r = rs[rid];
          if (!r) return rs;
          return { ...rs, [rid]: r.capital && r.owner && r.hp > 1 ? { ...r, hp: r.hp - 1 } : { ...r, owner: uid, capital: false, hp: 3 } };
        });
        setAim(null);
        setTurn((x) => (x + 1) % N);
      }, 1100);
    }, 1000);
    return () => clearTimeout(t);
  }, [aim, turn, regions, fresh, still]);

  // докато не се вижда, проверяваме пак след малко
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => seen.current && setTurn((x) => x), 1500);
    return () => clearInterval(t);
  }, [still]);

  const state = { players, regions, mode: 'CLASSIC' } as unknown as Pick<GameState, 'players' | 'regions' | 'mode'>;
  return (
    <div ref={root}>
      <BattleStage map={map} state={state} selectable={[]} highlight={aim} attackColor={players[turn]?.color} />
    </div>
  );
}

import type { GameMap, GameState } from '@belmaster/shared';

export function pickOptions(state: GameState, map: GameMap, uid: string): string[] {
  const free = map.regions.filter((r) => !state.regions[r.id]?.owner);
  const adj = free.filter((r) => r.neighbors.some((n) => state.regions[n]?.owner === uid));
  return (adj.length ? adj : free).map((r) => r.id);
}

export function attackOptions(state: GameState, map: GameMap, uid: string): string[] {
  return map.regions
    .filter((r) => state.regions[r.id]?.owner !== uid && r.neighbors.some((n) => state.regions[n]?.owner === uid))
    .map((r) => r.id);
}

export function territoryCount(state: GameState, uid: string): number {
  return Object.values(state.regions).filter((r) => r.owner === uid).length;
}

export function landOwner(state: GameState, map: GameMap, landId: string): string | null {
  const regs = map.regions.filter((r) => r.land === landId);
  const owner = state.regions[regs[0]?.id]?.owner ?? null;
  return owner && regs.every((r) => state.regions[r.id]?.owner === owner) ? owner : null;
}

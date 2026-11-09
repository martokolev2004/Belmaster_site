import { CONTINENT_MAP, ISLAND_MAP, LAKE_MAP, LAKE_SMALL_MAP, RIVER_MAP, RIVER_SMALL_MAP } from './maps.generated';

export interface MapLand {
  id: string;
  name: string;
  color: string;
}

export interface MapRegion {
  id: string;
  name: string;
  /** втори ред под името (напр. автор) */
  sub?: string;
  land: string;
  path: string;
  center: [number, number];
  neighbors: string[];
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  outline: string;
  lands: MapLand[];
  regions: MapRegion[];
  /** брой играчи -> id-та на стартовите столици */
  capitals: Record<string, string[]>;
}

export const MAPS: Record<string, GameMap> = {
  [CONTINENT_MAP.id]: CONTINENT_MAP,
  [ISLAND_MAP.id]: ISLAND_MAP,
  [LAKE_MAP.id]: LAKE_MAP,
  [LAKE_SMALL_MAP.id]: LAKE_SMALL_MAP,
  [RIVER_MAP.id]: RIVER_MAP,
  [RIVER_SMALL_MAP.id]: RIVER_SMALL_MAP,
};

/** Картите по размер: 1 на 1 — малките, 3–4 играчи — големите */
export const SMALL_MAPS = [ISLAND_MAP, LAKE_SMALL_MAP, RIVER_SMALL_MAP];
export const LARGE_MAPS = [CONTINENT_MAP, LAKE_MAP, RIVER_MAP];

/** Случайна карта за броя играчи (1 на 1 → малка, 3–4 → голяма). */
export function mapForPlayers(count: number): GameMap {
  const list = count <= 2 ? SMALL_MAPS : LARGE_MAPS;
  return list[Math.floor(Math.random() * list.length)];
}

/** За лобито (преди старта) — винаги една и съща. */
export function previewMapForPlayers(count: number): GameMap {
  return count <= 2 ? ISLAND_MAP : CONTINENT_MAP;
}

export { CONTINENT_MAP, ISLAND_MAP, LAKE_MAP, LAKE_SMALL_MAP, RIVER_MAP, RIVER_SMALL_MAP };

import { CONTINENT_MAP, ISLAND_MAP } from './maps.generated';

export interface MapLand {
  id: string;
  name: string;
  color: string;
}

export interface MapRegion {
  id: string;
  name: string;
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
};

/** 1 на 1 → малката карта; 3–4 играчи → голямата карта с 20 области */
export function mapForPlayers(count: number): GameMap {
  return count <= 2 ? ISLAND_MAP : CONTINENT_MAP;
}

export { CONTINENT_MAP, ISLAND_MAP };

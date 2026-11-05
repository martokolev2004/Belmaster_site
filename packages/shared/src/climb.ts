// „Към върха“ — игра за двама: изкачване по кула, хвърляне по стъпалото на другия, щит.
import type { AvatarConfig, FrameTier, UnlockRule } from './avatar';
import type { QType } from './questions';

export const CLIMB = {
  STEPS: 10,
  MAX_QUESTIONS: 35,
  CHOOSE_MS: 12_000,
  AIM_MS: 6_000,
  /** колко трае пълен ход на маркера наляво-надясно */
  AIM_PERIOD_MS: 1_400,
  /** анимацията след действие */
  RESOLVE_MS: 3_200,
  REVEAL_MS: 4_000,
  RECONNECT_MS: 30_000,
  /** ширина на зелената зона (дял от линията) — на земята и пред върха */
  ZONE_WIDE: 0.3,
  ZONE_NARROW: 0.09,
  QUICK_MATCH_BOT_OFFER_MS: 30_000,
} as const;

/** Колкото по-високо е хвърлящият, толкова по-тясна е зелената зона. */
export function aimZoneWidth(height: number): number {
  const t = Math.min(1, Math.max(0, height / (CLIMB.STEPS - 1)));
  return CLIMB.ZONE_WIDE + (CLIMB.ZONE_NARROW - CLIMB.ZONE_WIDE) * t;
}

/** Позиция на маркера (0..1) след `elapsed` ms — отива и се връща. */
export function aimMarker(elapsed: number, periodMs: number = CLIMB.AIM_PERIOD_MS): number {
  const ph = (((elapsed % periodMs) + periodMs) % periodMs) / periodMs;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}

export function aimHit(pos: number, zoneCenter: number, zoneWidth: number): boolean {
  return Math.abs(pos - zoneCenter) <= zoneWidth / 2;
}

// ───────────── Оръжия (еднаква сила, различен вид) ─────────────
export interface WeaponDef {
  id: string;
  name: string;
  emoji: string;
  rule: UnlockRule | null; // null = свободно
}

export const WEAPONS: WeaponDef[] = [
  { id: 'stone', name: 'Камък', emoji: '🪨', rule: null },
  { id: 'ball', name: 'Топка', emoji: '⚽', rule: { kind: 'level', n: 2 } },
  { id: 'brick', name: 'Тухла', emoji: '🧱', rule: { kind: 'level', n: 3 } },
  { id: 'book', name: 'Книга', emoji: '📕', rule: { kind: 'level', n: 4 } },
  { id: 'ink', name: 'Мастилница', emoji: '🫙', rule: { kind: 'level', n: 5 } },
  { id: 'snowball', name: 'Снежна топка', emoji: '❄️', rule: { kind: 'xp', n: 15000 } },
  { id: 'bomb', name: 'Бомба', emoji: '💣', rule: { kind: 'level', n: 7 } },
  { id: 'rocket', name: 'Ракета', emoji: '🚀', rule: { kind: 'shop', price: 40 } },
];
export const weaponKey = (id: string) => `weapon:${id}`;
export const weaponById = (id: string | null | undefined) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

// ───────────── Състояние ─────────────
export type ClimbPhase = 'lobby' | 'question' | 'reveal' | 'choose' | 'aim' | 'resolve' | 'finished';

export interface ClimbPlayer {
  uid: string;
  name: string;
  avatar: AvatarConfig | null;
  frame: FrameTier;
  weapon: string;
  color: string;
  isBot: boolean;
  isGuest: boolean;
  height: number;
  shieldUsed: boolean;
  /** само за теб: щитът е вдигнат (другият не го вижда) */
  shieldArmed: boolean;
  connected: boolean;
  left: boolean;
  correct: number;
  answered: number;
  ready: boolean;
}

export interface ClimbQuestion {
  id: string;
  type: QType;
  prompt: string;
  context: string | null;
  options: string[];
  answerCount: number;
  matching: { left: string[]; right: string[] } | null;
  blanks: { text: string; blanks: { label: string; options: string[] }[] } | null;
  tokens: string[] | null;
  timeMs: number;
  topicLabel: string;
  workTitle: string | null;
  startedAt: number;
  deadline: number;
  /** кой вече е отговорил (без самия отговор) */
  answered: string[];
}

export interface ClimbReveal {
  correctIndex: number | null;
  correctText: string | null;
  explanation: string | null;
  results: { uid: string; correct: boolean; timeMs: number | null }[];
  /** кой има право да избира (най-бързият верен) */
  actorUid: string | null;
}

export interface ClimbAim {
  actorUid: string;
  zoneCenter: number;
  zoneWidth: number;
  periodMs: number;
  startedAt: number;
  deadline: number;
}

export type ClimbOutcome =
  | { kind: 'climb'; actorUid: string }
  | { kind: 'hit'; actorUid: string; targetUid: string; weapon: string; pos: number; targetAtGround: boolean }
  | { kind: 'miss'; actorUid: string; targetUid: string; weapon: string; pos: number; actorAtGround: boolean }
  | { kind: 'reflect'; actorUid: string; targetUid: string; weapon: string; pos: number; actorAtGround: boolean }
  | { kind: 'shield_wasted'; actorUid: string; targetUid: string };

export interface ClimbState {
  code: string;
  grade: string;
  phase: ClimbPhase;
  you: string;
  hostUid: string;
  vsBot: boolean;
  isQuick: boolean;
  players: ClimbPlayer[];
  questionNo: number;
  maxQuestions: number;
  question: ClimbQuestion | null;
  reveal: ClimbReveal | null;
  /** в „choose“: кой избира */
  actorUid: string | null;
  aim: ClimbAim | null;
  /** последното действие (за анимацията) — id се сменя при всяко */
  outcome: (ClimbOutcome & { id: number; outcomes?: ClimbOutcome[] }) | null;
  deadline: number | null;
  winnerUid: string | null;
  draw: boolean;
  log: string[];
  matchId: string | null;
  ratingDelta: Record<string, number> | null;
  rematchCode: string | null;
  serverNow: number;
}

export interface ClimbClientToServer {
  'climb:create': () => void;
  'climb:join': (p: { code: string }) => void;
  'climb:leave': () => void;
  'climb:ready': (p: { ready: boolean }) => void;
  'climb:start': () => void;
  'climb:quick': () => void;
  'climb:quick_leave': () => void;
  'climb:bot': () => void;
  'climb:answer': (p: { questionId: string; index?: number | null; text?: string | null; texts?: (string | null)[] | null; pairs?: (number | null)[] | null; blanks?: (number | null)[] | null; marks?: { i: number; pos: 'before' | 'after'; mark: string }[] | null }) => void;
  'climb:choose': (p: { action: 'climb' | 'throw' }) => void;
  'climb:aim': (p: { elapsed: number }) => void;
  'climb:shield': () => void;
  'climb:rematch': () => void;
  'climb:chat': (p: { key: string }) => void;
}

export interface ClimbServerToClient {
  state: (s: ClimbState) => void;
  left: () => void;
  error: (p: { message: string }) => void;
  quick: (p: { searching: boolean; since: number | null; offerBot: boolean }) => void;
  chat: (p: { uid: string; key: string; at: number }) => void;
}

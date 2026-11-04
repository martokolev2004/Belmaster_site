import type { GradeCode } from './grades';

// ───────────── Правила ─────────────
export const RULES = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  QUESTION_MS: 20_000,
  JOKER_TIME_BONUS_MS: 5_000,
  EXPANSION_PICK_MS: 10_000,
  ATTACK_CHOOSE_MS: 15_000,
  REVEAL_MS: 4_000,
  RECONNECT_MS: 30_000,
  MAX_ROUNDS: 12,
  CAPITAL_HP: 3,
  /** таван на въпросите в разпределянето — после останалото се раздава автоматично */
  EXPANSION_MAX_QUESTIONS: 14,
  /** атаки на ход, ако притежаваш поне една цяла земя */
  LAND_BONUS_ATTACKS: 2,
  QUICK_MATCH_BOT_OFFER_MS: 30_000,
} as const;

export const PLAYER_COLORS = ['#ff4b4b', '#1cb0f6', '#ffc800', '#58cc02'] as const;

export type GameMode = 'CLASSIC' | 'WORKS';

export const MODE_LABELS: Record<GameMode, { name: string; description: string }> = {
  CLASSIC: { name: 'Класическа битка', description: 'Случайни въпроси по език и литература.' },
  WORKS: { name: 'Битка на произведенията', description: 'Всяко поле е творба — въпросът е за нея.' },
};

/** Готови фрази и емоджита за чата (без свободен текст). */
export const CHAT_MESSAGES: { key: string; text: string }[] = [
  { key: 'hi', text: '👋 Здравей!' },
  { key: 'gl', text: '🍀 Успех!' },
  { key: 'bravo', text: '👏 Браво!' },
  { key: 'wow', text: '😮 Уау!' },
  { key: 'oops', text: '😅 Ох!' },
  { key: 'think', text: '🤔 Труден въпрос…' },
  { key: 'fire', text: '🔥 В серия съм!' },
  { key: 'castle', text: '🏰 Пази си столицата!' },
  { key: 'gg', text: '🤝 Добра игра!' },
  { key: 'again', text: '🔁 Още една?' },
  { key: 'laugh', text: '😂' },
  { key: 'heart', text: '❤️' },
];

// ───────────── Състояние (изпраща се към клиентите) ─────────────
export type GamePhase =
  | 'lobby'
  | 'expansion_question'
  | 'expansion_reveal'
  | 'expansion_pick'
  | 'battle_choose'
  | 'battle_question'
  | 'battle_reveal'
  | 'finished';

export interface PublicPlayer {
  uid: string;
  name: string;
  color: string;
  isGuest: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  /** до кога (epoch ms) може да се върне, ако е изпаднал */
  reconnectUntil: number | null;
  eliminated: boolean;
  left: boolean;
  capital: string | null;
  jokers: { fifty: boolean; time: boolean };
  correct: number;
  answered: number;
}

export interface PublicRegion {
  owner: string | null;
  capital: boolean;
  hp: number;
  workId: string | null;
  workTitle: string | null;
}

export interface PublicQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER';
  prompt: string;
  context: string | null;
  options: string[];
  workTitle: string | null;
  topicLabel: string;
  participants: string[];
  startedAt: number;
  deadline: number;
}

export interface RevealResult {
  uid: string;
  correct: boolean;
  timeMs: number | null;
  index: number | null;
  text: string | null;
}

export interface PublicReveal {
  correctIndex: number | null;
  correctText: string | null;
  explanation: string | null;
  results: RevealResult[];
  message: string;
  winnerUid: string | null;
}

export interface Standing {
  uid: string;
  name: string;
  color: string;
  place: number;
  territories: number;
  correct: number;
  answered: number;
  ratingDelta: number | null;
  isBot: boolean;
}

export interface GameState {
  code: string;
  grade: GradeCode;
  mode: GameMode;
  mapId: string | null;
  hostUid: string;
  isQuick: boolean;
  vsBot: boolean;
  phase: GamePhase;
  players: PublicPlayer[];
  regions: Record<string, PublicRegion>;
  round: number;
  maxRounds: number;
  turnUid: string | null;
  attacksLeft: number;
  question: PublicQuestion | null;
  answeredUids: string[];
  reveal: PublicReveal | null;
  pick: { uid: string; queue: string[] } | null;
  battle: { attackerUid: string; defenderUid: string | null; regionId: string } | null;
  deadline: number | null;
  serverNow: number;
  log: string[];
  standings: Standing[] | null;
  matchId: string | null;
  rematchCode: string | null;
}

// ───────────── Събития ─────────────
export interface ClientToServer {
  'lobby:create': (p: { mode: GameMode }) => void;
  'lobby:join': (p: { code: string }) => void;
  'lobby:leave': () => void;
  'lobby:ready': (p: { ready: boolean }) => void;
  'lobby:mode': (p: { mode: GameMode }) => void;
  'lobby:start': () => void;
  'quick:join': (p: { mode: GameMode }) => void;
  'quick:leave': () => void;
  'bot:start': (p: { mode: GameMode }) => void;
  'game:answer': (p: { questionId: string; index?: number; text?: string }) => void;
  'game:pick': (p: { regionId: string }) => void;
  'game:attack': (p: { regionId: string }) => void;
  'game:joker': (p: { kind: 'fifty' | 'time' }) => void;
  'chat:send': (p: { key: string }) => void;
  'invite:send': (p: { toUid: string; code: string }) => void;
  'rematch:request': () => void;
  'presence:query': (p: { uids: string[] }) => void;
}

export interface ChatEvent {
  uid: string;
  name: string;
  color: string;
  key: string;
  at: number;
}

export interface InviteEvent {
  id: string;
  fromUid: string;
  fromName: string;
  code: string;
  mode: GameMode;
}

export interface ServerToClient {
  state: (s: GameState) => void;
  left: () => void;
  error: (p: { message: string }) => void;
  chat: (c: ChatEvent) => void;
  'joker:fifty': (p: { questionId: string; removed: number[] }) => void;
  'quick:status': (p: { searching: boolean; since: number | null; offerBot: boolean }) => void;
  invite: (i: InviteEvent) => void;
  presence: (p: { online: string[] }) => void;
}

/** Данните в токена, с който браузърът се свързва към игровия сървър. */
export interface GameTokenClaims {
  uid: string;
  name: string;
  grade: GradeCode;
  isGuest: boolean;
}

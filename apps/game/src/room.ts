import type { Grade } from '@belmaster/db';
import {
  CHAT_MESSAGES,
  PLAYER_COLORS,
  RULES,
  mapForPlayers,
  type GameMap,
  type GameMode,
  type GamePhase,
  type GameState,
  type PublicPlayer,
  type PublicRegion,
  type RevealResult,
  type Standing,
} from '@belmaster/shared';
import { QuestionPool, isCorrect, type PoolQuestion } from './questions.js';

export interface PlayerInternal {
  uid: string;
  name: string;
  color: string;
  isGuest: boolean;
  isBot: boolean;
  ready: boolean;
  sockets: Set<string>;
  connected: boolean;
  reconnectUntil: number | null;
  reconnectTimer: NodeJS.Timeout | null;
  eliminated: boolean;
  eliminatedAt: number | null;
  left: boolean;
  capital: string | null;
  jokers: { fifty: boolean; time: boolean };
  correct: number;
  answered: number;
  capturedCapital: boolean;
}

interface RegionInternal {
  owner: string | null;
  capital: boolean;
  hp: number;
  workId: string | null;
  workTitle: string | null;
}

interface ActiveQuestion {
  q: PoolQuestion;
  participants: string[];
  startedAt: number;
  deadlines: Map<string, number>;
  answers: Map<string, { index?: number; text?: string; at: number; correct: boolean }>;
}

export interface ReviewItem {
  prompt: string;
  type: PoolQuestion['type'];
  options: string[];
  correctIndex: number | null;
  correctText: string | null;
  explanation: string | null;
  workTitle: string | null;
  results: { uid: string; name: string; correct: boolean; timeMs: number | null; answer: string | null }[];
}

export interface RoomHooks {
  broadcast: (room: Room) => void;
  sendFifty: (uid: string, questionId: string, removed: number[]) => void;
  chat: (room: Room, uid: string, key: string) => void;
  onFinished: (room: Room) => Promise<void>;
  onEmpty: (room: Room) => void;
  onPlayerRemoved: (room: Room, uid: string) => void;
}

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export class Room {
  readonly code: string;
  readonly grade: Grade;
  mode: GameMode;
  hostUid: string;
  isQuick = false;
  vsBot = false;
  phase: GamePhase = 'lobby';
  players = new Map<string, PlayerInternal>();
  order: string[] = [];
  map: GameMap | null = null;
  regions = new Map<string, RegionInternal>();
  round = 0;
  turnIndex = 0;
  attacksLeft = 0;
  expansionQuestions = 0;
  question: ActiveQuestion | null = null;
  reveal: GameState['reveal'] = null;
  pickQueue: string[] = [];
  battle: GameState['battle'] = null;
  deadline: number | null = null;
  log: string[] = [];
  standings: Standing[] | null = null;
  matchId: string | null = null;
  rematchCode: string | null = null;
  review: ReviewItem[] = [];
  startedAt = 0;
  createdAt = Date.now();
  finishedAt: number | null = null;
  starting = false;
  private pool: QuestionPool | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastChat = new Map<string, number>();

  constructor(code: string, grade: Grade, mode: GameMode, hostUid: string, private hooks: RoomHooks) {
    this.code = code;
    this.grade = grade;
    this.mode = mode;
    this.hostUid = hostUid;
  }

  // ───────────────────────── Лоби ─────────────────────────

  addPlayer(p: { uid: string; name: string; isGuest: boolean; isBot?: boolean }, socketId?: string): string | null {
    const existing = this.players.get(p.uid);
    if (existing) {
      if (socketId) this.attachSocket(p.uid, socketId);
      return null;
    }
    if (this.phase !== 'lobby') return 'Битката вече е започнала.';
    if (this.players.size >= RULES.MAX_PLAYERS) return 'Стаята е пълна (най-много 4 играчи).';
    const used = new Set([...this.players.values()].map((x) => x.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? '#ce82ff';
    this.players.set(p.uid, {
      uid: p.uid,
      name: p.name,
      color,
      isGuest: p.isGuest,
      isBot: !!p.isBot,
      ready: !!p.isBot,
      sockets: new Set(socketId ? [socketId] : []),
      connected: true,
      reconnectUntil: null,
      reconnectTimer: null,
      eliminated: false,
      eliminatedAt: null,
      left: false,
      capital: null,
      jokers: { fifty: true, time: true },
      correct: 0,
      answered: 0,
      capturedCapital: false,
    });
    this.order.push(p.uid);
    this.pushLog(`${p.name} влезе в стаята.`);
    this.emit();
    return null;
  }

  attachSocket(uid: string, socketId: string) {
    const p = this.players.get(uid);
    if (!p || p.left) return;
    p.sockets.add(socketId);
    if (!p.connected) {
      p.connected = true;
      p.reconnectUntil = null;
      if (p.reconnectTimer) clearTimeout(p.reconnectTimer);
      p.reconnectTimer = null;
      this.pushLog(`${p.name} се върна.`);
    }
    this.emit();
  }

  detachSocket(uid: string, socketId: string) {
    const p = this.players.get(uid);
    if (!p) return;
    p.sockets.delete(socketId);
    if (p.sockets.size > 0 || p.isBot) return;
    p.connected = false;
    p.reconnectUntil = Date.now() + RULES.RECONNECT_MS;
    this.pushLog(`${p.name} изпадна — има 30 секунди да се върне.`);
    p.reconnectTimer = setTimeout(() => this.dropPlayer(uid, 'timeout'), RULES.RECONNECT_MS);
    this.emit();
    // ако чакаме само неговия отговор/избор — не бавим играта
    this.maybeResolveEarly();
  }

  setReady(uid: string, ready: boolean) {
    const p = this.players.get(uid);
    if (!p || this.phase !== 'lobby') return;
    p.ready = ready;
    this.emit();
  }

  setMode(uid: string, mode: GameMode) {
    if (uid !== this.hostUid || this.phase !== 'lobby') return;
    this.mode = mode;
    this.emit();
  }

  /** Играч напуска доброволно или времето му за връщане е изтекло. */
  dropPlayer(uid: string, reason: 'leave' | 'timeout') {
    const p = this.players.get(uid);
    if (!p) return;
    if (p.reconnectTimer) clearTimeout(p.reconnectTimer);
    p.reconnectTimer = null;

    if (this.phase === 'lobby' || this.phase === 'finished') {
      this.players.delete(uid);
      this.order = this.order.filter((x) => x !== uid);
      this.hooks.onPlayerRemoved(this, uid);
      if (this.phase === 'lobby') this.pushLog(`${p.name} излезе.`);
      if (![...this.players.values()].some((x) => !x.isBot)) {
        this.destroy();
        return;
      }
      if (this.hostUid === uid) this.hostUid = [...this.players.values()].find((x) => !x.isBot)!.uid;
      this.emit();
      return;
    }

    // по време на игра — предаване: областите стават неутрални
    const wasTurn = this.phase === 'battle_choose' && this.currentTurnUid() === uid;
    const wasPicking = this.phase === 'expansion_pick' && this.pickQueue[0] === uid;
    p.left = true;
    p.connected = false;
    p.reconnectUntil = null;
    p.sockets.clear();
    this.hooks.onPlayerRemoved(this, uid);
    this.eliminate(uid, reason === 'leave' ? `${p.name} напусна битката.` : `${p.name} не се върна навреме.`);
    for (const r of this.regions.values()) {
      if (r.owner === uid) {
        r.owner = null;
        r.capital = false;
        r.hp = 0;
      }
    }
    if (this.hostUid === uid) {
      const next = [...this.players.values()].find((x) => !x.isBot && !x.left);
      if (next) this.hostUid = next.uid;
    }
    if (this.checkGameOver()) return;
    // ако е бил на ход или участник във въпроса
    if (wasTurn) {
      this.endTurn();
      return;
    }
    if (wasPicking) {
      this.pickQueue.shift();
      this.nextPick();
      return;
    }
    this.maybeResolveEarly();
    this.emit();
  }

  // ───────────────────────── Старт ─────────────────────────

  canStart(): string | null {
    const humans = [...this.players.values()];
    if (humans.length < RULES.MIN_PLAYERS) return 'Нужни са поне 2 играчи.';
    if (!humans.every((p) => p.ready)) return 'Не всички са готови.';
    return null;
  }

  async start(byUid: string | null): Promise<string | null> {
    if (this.phase !== 'lobby' || this.starting) return null;
    if (byUid && byUid !== this.hostUid) return 'Само домакинът може да започне.';
    const err = this.canStart();
    if (err) return err;
    this.starting = true;
    try {
      const pool = await QuestionPool.load(this.grade);
      if (pool.size < 5) return 'Още няма достатъчно въпроси за твоя клас.';
      const map = mapForPlayers(this.players.size);
      const works = this.mode === 'WORKS' ? pool.worksWithQuestions() : [];
      if (this.mode === 'WORKS' && works.length === 0) return 'Още няма произведения с въпроси за „Битка на произведенията“.';

      this.pool = pool;
      this.map = map;
      this.regions.clear();
      const shuffledWorks = [...works].sort(() => Math.random() - 0.5);
      map.regions.forEach((r, i) => {
        const w = shuffledWorks.length ? shuffledWorks[i % shuffledWorks.length] : null;
        this.regions.set(r.id, { owner: null, capital: false, hp: 0, workId: w?.id ?? null, workTitle: w?.title ?? null });
      });

      // столици
      this.order = [...this.order].sort(() => Math.random() - 0.5);
      const capitals = map.capitals[String(this.order.length)] ?? map.capitals['2'];
      this.order.forEach((uid, i) => {
        const p = this.players.get(uid)!;
        const regionId = capitals[i];
        p.capital = regionId;
        const r = this.regions.get(regionId)!;
        r.owner = uid;
        r.capital = true;
        r.hp = RULES.CAPITAL_HP;
      });

      this.startedAt = Date.now();
      this.phase = 'expansion_question';
      this.pushLog('Битката започва! Първо — разпределяне на земите.');
      this.nextExpansionQuestion();
      return null;
    } finally {
      this.starting = false;
    }
  }

  // ───────────────────────── Разпределяне ─────────────────────────

  private freeRegions() {
    return [...this.regions.entries()].filter(([, r]) => r.owner === null).map(([id]) => id);
  }

  private nextExpansionQuestion() {
    const free = this.freeRegions();
    if (!free.length) return this.startBattle();
    if (this.expansionQuestions >= RULES.EXPANSION_MAX_QUESTIONS) {
      this.autoDistribute();
      return this.startBattle();
    }
    this.expansionQuestions++;
    const participants = this.alivePlayers().map((p) => p.uid);
    this.askQuestion(this.pool!.random(), participants, 'expansion_question');
  }

  private autoDistribute() {
    const alive = this.alivePlayers();
    let i = 0;
    let guard = 0;
    while (this.freeRegions().length && guard++ < 200) {
      const p = alive[i % alive.length];
      const options = this.pickOptions(p.uid);
      if (options.length) this.regions.get(options[Math.floor(Math.random() * options.length)])!.owner = p.uid;
      i++;
    }
    this.pushLog('Останалите земи бяха разпределени автоматично.');
  }

  /** Свободни области, които играчът може да вземе (съседни на негови, ако има такива). */
  pickOptions(uid: string): string[] {
    const free = this.freeRegions();
    const adjacent = free.filter((id) => this.map!.regions.find((r) => r.id === id)!.neighbors.some((n) => this.regions.get(n)?.owner === uid));
    return adjacent.length ? adjacent : free;
  }

  private nextPick() {
    while (this.pickQueue.length) {
      const uid = this.pickQueue[0];
      const p = this.players.get(uid);
      if (!p || p.eliminated || !this.freeRegions().length) {
        this.pickQueue.shift();
        continue;
      }
      this.phase = 'expansion_pick';
      this.deadline = Date.now() + (p.connected ? RULES.EXPANSION_PICK_MS : 1500);
      this.schedule(this.deadline - Date.now(), () => {
        const opts = this.pickOptions(uid);
        if (opts.length) this.applyPick(uid, opts[Math.floor(Math.random() * opts.length)], true);
      });
      if (p.isBot) this.botAfter(1200, () => {
        const opts = this.pickOptions(uid);
        if (opts.length) this.applyPick(uid, this.botChoosePick(uid, opts), false);
      });
      this.emit();
      return;
    }
    this.nextExpansionQuestion();
  }

  pick(uid: string, regionId: string) {
    if (this.phase !== 'expansion_pick' || this.pickQueue[0] !== uid) return;
    if (!this.pickOptions(uid).includes(regionId)) return;
    this.applyPick(uid, regionId, false);
  }

  private applyPick(uid: string, regionId: string, auto: boolean) {
    if (this.phase !== 'expansion_pick' || this.pickQueue[0] !== uid) return;
    const r = this.regions.get(regionId);
    if (!r || r.owner) return;
    r.owner = uid;
    const p = this.players.get(uid)!;
    this.pushLog(`${p.name} ${auto ? 'получи' : 'взе'} ${this.regionName(regionId)}.`);
    this.pickQueue.shift();
    this.nextPick();
  }

  // ───────────────────────── Битки ─────────────────────────

  private startBattle() {
    this.round = 1;
    this.turnIndex = 0;
    this.pushLog('Започват битките! 12 кръга.');
    this.beginTurn();
  }

  private turnOrder(): string[] {
    return this.order.filter((uid) => {
      const p = this.players.get(uid)!;
      return !p.eliminated && !p.left;
    });
  }

  currentTurnUid(): string | null {
    const order = this.turnOrder();
    if (!order.length) return null;
    return order[this.turnIndex % order.length] ?? null;
  }

  ownsFullLand(uid: string): boolean {
    if (!this.map) return false;
    return this.map.lands.some((land) => {
      const regs = this.map!.regions.filter((r) => r.land === land.id);
      return regs.length > 0 && regs.every((r) => this.regions.get(r.id)?.owner === uid);
    });
  }

  attackOptions(uid: string): string[] {
    if (!this.map) return [];
    return this.map.regions
      .filter((r) => this.regions.get(r.id)!.owner !== uid && r.neighbors.some((n) => this.regions.get(n)?.owner === uid))
      .map((r) => r.id);
  }

  private beginTurn() {
    if (this.checkGameOver()) return;
    const uid = this.currentTurnUid();
    if (!uid) return this.finish();
    this.attacksLeft = this.ownsFullLand(uid) ? RULES.LAND_BONUS_ATTACKS : 1;
    this.chooseAttack();
  }

  private chooseAttack() {
    const uid = this.currentTurnUid()!;
    const p = this.players.get(uid)!;
    const options = this.attackOptions(uid);
    if (!options.length || !p.connected) {
      if (!p.connected) this.pushLog(`${p.name} пропуска хода (няма връзка).`);
      return this.endTurn();
    }
    this.phase = 'battle_choose';
    this.battle = null;
    this.question = null;
    this.reveal = null;
    this.deadline = Date.now() + RULES.ATTACK_CHOOSE_MS;
    this.schedule(RULES.ATTACK_CHOOSE_MS, () => {
      const opts = this.attackOptions(uid);
      if (opts.length) this.applyAttack(uid, opts[Math.floor(Math.random() * opts.length)]);
      else this.endTurn();
    });
    if (p.isBot) this.botAfter(1800, () => {
      const opts = this.attackOptions(uid);
      if (opts.length) this.applyAttack(uid, this.botChooseAttack(uid, opts));
    });
    this.emit();
  }

  attack(uid: string, regionId: string) {
    if (this.phase !== 'battle_choose' || this.currentTurnUid() !== uid) return;
    if (!this.attackOptions(uid).includes(regionId)) return;
    this.applyAttack(uid, regionId);
  }

  private applyAttack(uid: string, regionId: string) {
    if (this.phase !== 'battle_choose' || this.currentTurnUid() !== uid) return;
    const r = this.regions.get(regionId)!;
    const defender = r.owner ? this.players.get(r.owner) ?? null : null;
    this.battle = { attackerUid: uid, defenderUid: defender?.uid ?? null, regionId };
    const attacker = this.players.get(uid)!;
    this.pushLog(`${attacker.name} напада ${this.regionName(regionId)}${defender ? ` (${defender.name})` : ''}.`);
    const q = this.mode === 'WORKS' ? this.pool!.forWork(r.workId) : this.pool!.random();
    const participants = defender && !defender.left ? [uid, defender.uid] : [uid];
    this.askQuestion(q, participants, 'battle_question');
  }

  private endTurn() {
    this.battle = null;
    const order = this.turnOrder();
    this.turnIndex++;
    if (this.turnIndex >= order.length) {
      this.turnIndex = 0;
      this.round++;
      if (this.round > RULES.MAX_ROUNDS) return this.finish();
      this.pushLog(`Кръг ${this.round} от ${RULES.MAX_ROUNDS}.`);
    }
    this.beginTurn();
  }

  // ───────────────────────── Въпроси ─────────────────────────

  private askQuestion(q: PoolQuestion, participants: string[], phase: 'expansion_question' | 'battle_question') {
    const now = Date.now();
    this.phase = phase;
    this.reveal = null;
    this.question = {
      q,
      participants,
      startedAt: now,
      deadlines: new Map(participants.map((uid) => [uid, now + RULES.QUESTION_MS])),
      answers: new Map(),
    };
    this.deadline = now + RULES.QUESTION_MS;
    this.schedule(RULES.QUESTION_MS + 150, () => this.resolveQuestion());
    for (const uid of participants) {
      const p = this.players.get(uid)!;
      if (p.isBot) this.botAnswer(uid);
    }
    this.emit();
    this.maybeResolveEarly();
  }

  answer(uid: string, questionId: string, a: { index?: number; text?: string }) {
    const aq = this.question;
    if (!aq || aq.q.id !== questionId || !aq.participants.includes(uid) || aq.answers.has(uid)) return;
    if (this.phase !== 'expansion_question' && this.phase !== 'battle_question') return;
    const now = Date.now();
    if (now > (aq.deadlines.get(uid) ?? 0) + 300) return;
    const text = typeof a.text === 'string' ? a.text.slice(0, 200) : undefined;
    const index = typeof a.index === 'number' ? a.index : undefined;
    aq.answers.set(uid, { index, text, at: now, correct: isCorrect(aq.q, { index, text }) });
    this.emit();
    this.maybeResolveEarly();
  }

  useJoker(uid: string, kind: 'fifty' | 'time') {
    const aq = this.question;
    const p = this.players.get(uid);
    if (!aq || !p || !aq.participants.includes(uid) || aq.answers.has(uid)) return;
    if (kind === 'fifty') {
      if (!p.jokers.fifty || aq.q.type !== 'SINGLE_CHOICE' || aq.q.options.length < 3) return;
      p.jokers.fifty = false;
      const wrong = aq.q.options.map((_, i) => i).filter((i) => i !== aq.q.correctIndex).sort(() => Math.random() - 0.5);
      const removed = wrong.slice(0, aq.q.options.length - 2);
      this.hooks.sendFifty(uid, aq.q.id, removed);
    } else {
      if (!p.jokers.time) return;
      p.jokers.time = false;
      const d = (aq.deadlines.get(uid) ?? Date.now()) + RULES.JOKER_TIME_BONUS_MS;
      aq.deadlines.set(uid, d);
      const maxDeadline = Math.max(...aq.deadlines.values());
      this.deadline = maxDeadline;
      this.schedule(maxDeadline - Date.now() + 150, () => this.resolveQuestion());
    }
    this.emit();
  }

  private maybeResolveEarly() {
    const aq = this.question;
    if (!aq || (this.phase !== 'expansion_question' && this.phase !== 'battle_question')) return;
    const waiting = aq.participants.filter((uid) => {
      const p = this.players.get(uid);
      return p && !p.left && p.connected && !aq.answers.has(uid);
    });
    if (waiting.length === 0) this.schedule(400, () => this.resolveQuestion());
  }

  private resolveQuestion() {
    const aq = this.question;
    if (!aq) return;
    if (this.phase !== 'expansion_question' && this.phase !== 'battle_question') return;
    const results: RevealResult[] = aq.participants.map((uid) => {
      const a = aq.answers.get(uid);
      const p = this.players.get(uid)!;
      p.answered++;
      if (a?.correct) p.correct++;
      return {
        uid,
        correct: !!a?.correct,
        timeMs: a ? a.at - aq.startedAt : null,
        index: a?.index ?? null,
        text: a?.text ?? null,
      };
    });
    this.review.push({
      prompt: aq.q.prompt,
      type: aq.q.type,
      options: aq.q.options,
      correctIndex: aq.q.correctIndex,
      correctText: aq.q.type === 'SHORT_ANSWER' ? aq.q.acceptedAnswers[0] ?? null : null,
      explanation: aq.q.explanation,
      workTitle: aq.q.workTitle,
      results: results.map((r) => ({
        uid: r.uid,
        name: this.players.get(r.uid)!.name,
        correct: r.correct,
        timeMs: r.correct ? r.timeMs : null,
        answer: r.index != null ? LETTERS[r.index] ?? null : r.text,
      })),
    });

    const correctSorted = results.filter((r) => r.correct).sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
    const base = {
      correctIndex: aq.q.correctIndex,
      correctText: aq.q.type === 'SHORT_ANSWER' ? aq.q.acceptedAnswers.join(' / ') : null,
      explanation: aq.q.explanation,
      results,
    };

    if (this.phase === 'expansion_question') {
      this.pickQueue = correctSorted.map((r) => r.uid);
      const msg = correctSorted.length
        ? `Избират: ${correctSorted.map((r) => this.players.get(r.uid)!.name).join(', ')}`
        : 'Никой не отговори вярно — никой не взима земя.';
      this.reveal = { ...base, message: msg, winnerUid: correctSorted[0]?.uid ?? null };
      this.phase = 'expansion_reveal';
      this.deadline = Date.now() + RULES.REVEAL_MS;
      this.schedule(RULES.REVEAL_MS, () => (this.pickQueue.length ? this.nextPick() : this.nextExpansionQuestion()));
      this.emit();
      return;
    }

    // битка
    const battle = this.battle!;
    const region = this.regions.get(battle.regionId)!;
    const attacker = this.players.get(battle.attackerUid)!;
    const defender = battle.defenderUid ? this.players.get(battle.defenderUid)! : null;
    const aRes = results.find((r) => r.uid === attacker.uid);
    const dRes = defender ? results.find((r) => r.uid === defender.uid) : undefined;
    const aOk = !!aRes?.correct;
    const dOk = !!dRes?.correct;
    let message: string;
    let winnerUid: string | null = null;
    let toEliminate: { uid: string; msg: string } | null = null;

    const attackerWins = aOk && (!dOk || (aRes!.timeMs ?? 0) < (dRes!.timeMs ?? 0));
    const defenderWins = !!defender && dOk && !attackerWins;

    if (attackerWins) {
      winnerUid = attacker.uid;
      if (region.capital && defender) {
        region.hp--;
        if (region.hp <= 0) {
          let taken = 0;
          for (const r of this.regions.values()) {
            if (r.owner === defender.uid) {
              r.owner = attacker.uid;
              taken++;
            }
          }
          region.capital = false;
          attacker.capturedCapital = true;
          message = `${attacker.name} превзе столицата на ${defender.name} и всичките му ${taken} области!`;
          toEliminate = { uid: defender.uid, msg: `${defender.name} е елиминиран.` };
        } else {
          message = `${attacker.name} удари столицата на ${defender.name}! Остават ${region.hp} ${region.hp === 1 ? 'живот' : 'живота'}.`;
        }
      } else {
        region.owner = attacker.uid;
        message = `${attacker.name} завладя ${this.regionName(battle.regionId)}!`;
        if (defender && ![...this.regions.values()].some((r) => r.owner === defender.uid)) {
          toEliminate = { uid: defender.uid, msg: `${defender.name} остана без области.` };
        }
      }
    } else if (defenderWins) {
      winnerUid = defender!.uid;
      message = `${defender!.name} удържа ${this.regionName(battle.regionId)}!`;
    } else {
      message = 'Никой не отговори вярно — нищо не се променя.';
    }
    this.pushLog(message);
    if (toEliminate) this.eliminate(toEliminate.uid, toEliminate.msg);
    this.reveal = { ...base, message, winnerUid };
    this.phase = 'battle_reveal';
    this.deadline = Date.now() + RULES.REVEAL_MS;
    this.schedule(RULES.REVEAL_MS, () => {
      if (this.checkGameOver()) return;
      this.attacksLeft--;
      const uid = this.currentTurnUid();
      if (this.attacksLeft > 0 && uid === attacker.uid && !attacker.eliminated && this.attackOptions(uid).length) this.chooseAttack();
      else this.endTurn();
    });
    this.emit();
  }

  // ───────────────────────── Край ─────────────────────────

  private eliminate(uid: string, message: string) {
    const p = this.players.get(uid);
    if (!p || p.eliminated) return;
    // запазваме кой е на ход, преди да махнем играча от реда
    const current = this.currentTurnUid();
    p.eliminated = true;
    p.eliminatedAt = Date.now();
    this.pushLog(message);
    if (current) {
      const order = this.turnOrder();
      const idx = order.indexOf(current);
      if (idx >= 0) this.turnIndex = idx;
      // ако е бил на ход: следващото endTurn() трябва да падне на играча след него
      else this.turnIndex = (this.turnIndex % (order.length + 1)) - 1;
    }
  }

  alivePlayers() {
    return this.order.map((uid) => this.players.get(uid)!).filter((p) => !p.eliminated && !p.left);
  }

  territories(uid: string) {
    let n = 0;
    for (const r of this.regions.values()) if (r.owner === uid) n++;
    return n;
  }

  private checkGameOver(): boolean {
    if (this.phase === 'finished') return true;
    const alive = this.alivePlayers();
    if (alive.length <= 1 || !alive.some((p) => !p.isBot)) {
      this.finish();
      return true;
    }
    return false;
  }

  private finish() {
    if (this.phase === 'finished') return;
    this.clearTimer();
    this.phase = 'finished';
    this.finishedAt = Date.now();
    this.question = null;
    this.battle = null;
    this.deadline = null;
    const all = this.order.map((uid) => this.players.get(uid)!);
    const sorted = [...all].sort((a, b) => {
      const aAlive = !a.eliminated && !a.left ? 1 : 0;
      const bAlive = !b.eliminated && !b.left ? 1 : 0;
      if (aAlive !== bAlive) return bAlive - aAlive;
      if (!aAlive) return (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0);
      const t = this.territories(b.uid) - this.territories(a.uid);
      if (t) return t;
      const hpA = a.capital ? this.regions.get(a.capital)?.hp ?? 0 : 0;
      const hpB = b.capital ? this.regions.get(b.capital)?.hp ?? 0 : 0;
      if (hpB !== hpA) return hpB - hpA;
      return b.correct - a.correct;
    });
    this.standings = sorted.map((p, i) => ({
      uid: p.uid,
      name: p.name,
      color: p.color,
      place: i + 1,
      territories: this.territories(p.uid),
      correct: p.correct,
      answered: p.answered,
      ratingDelta: null,
      isBot: p.isBot,
    }));
    this.pushLog(`Край! Победител: ${sorted[0]?.name ?? '—'}.`);
    this.emit();
    this.hooks
      .onFinished(this)
      .catch((e) => console.error('[room] persist failed', e))
      .finally(() => this.emit());
  }

  destroy() {
    this.clearTimer();
    for (const p of this.players.values()) if (p.reconnectTimer) clearTimeout(p.reconnectTimer);
    this.hooks.onEmpty(this);
  }

  // ───────────────────────── Чат ─────────────────────────

  chat(uid: string, key: string) {
    if (!this.players.has(uid) || !CHAT_MESSAGES.some((m) => m.key === key)) return;
    const now = Date.now();
    if (now - (this.lastChat.get(uid) ?? 0) < 1500) return;
    this.lastChat.set(uid, now);
    this.hooks.chat(this, uid, key);
  }

  // ───────────────────────── Бот ─────────────────────────

  private botAfter(ms: number, fn: () => void) {
    setTimeout(() => {
      if (this.phase !== 'finished') fn();
    }, ms);
  }

  private botAnswer(uid: string) {
    const aq = this.question!;
    const delay = 4000 + Math.random() * 10_000;
    this.botAfter(delay, () => {
      if (this.question !== aq) return;
      const right = Math.random() < 0.6;
      if (aq.q.type === 'SINGLE_CHOICE') {
        const wrong = aq.q.options.map((_, i) => i).filter((i) => i !== aq.q.correctIndex);
        const index = right ? aq.q.correctIndex! : wrong[Math.floor(Math.random() * wrong.length)];
        this.answer(uid, aq.q.id, { index });
      } else {
        this.answer(uid, aq.q.id, { text: right ? aq.q.acceptedAnswers[0] : '...' });
      }
    });
  }

  private botChoosePick(uid: string, options: string[]): string {
    // предпочита области, които допълват земя
    void uid;
    return options[Math.floor(Math.random() * options.length)];
  }

  private botChooseAttack(uid: string, options: string[]): string {
    void uid;
    const nonCapital = options.filter((id) => !this.regions.get(id)!.capital);
    const list = nonCapital.length && Math.random() < 0.7 ? nonCapital : options;
    return list[Math.floor(Math.random() * list.length)];
  }

  // ───────────────────────── Помощни ─────────────────────────

  private regionName(id: string) {
    const r = this.map?.regions.find((x) => x.id === id);
    const reg = this.regions.get(id);
    return this.mode === 'WORKS' && reg?.workTitle ? `„${reg.workTitle}“` : r?.name ?? id;
  }

  private pushLog(line: string) {
    this.log.push(line);
    if (this.log.length > 40) this.log.shift();
  }

  private schedule(ms: number, fn: () => void) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fn();
      } catch (e) {
        console.error('[room] timer error', e);
      }
    }, Math.max(0, ms));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit() {
    this.hooks.broadcast(this);
  }

  // ───────────────────────── Публично състояние ─────────────────────────

  toState(): GameState {
    const map = this.map ?? mapForPlayers(Math.max(2, this.players.size));
    const players: PublicPlayer[] = this.order.map((uid) => {
      const p = this.players.get(uid)!;
      return {
        uid: p.uid,
        name: p.name,
        color: p.color,
        isGuest: p.isGuest,
        isBot: p.isBot,
        ready: p.ready,
        connected: p.connected,
        reconnectUntil: p.reconnectUntil,
        eliminated: p.eliminated,
        left: p.left,
        capital: p.capital,
        jokers: { ...p.jokers },
        correct: p.correct,
        answered: p.answered,
      };
    });
    const regions: Record<string, PublicRegion> = {};
    for (const [id, r] of this.regions) regions[id] = { ...r };
    const aq = this.question;
    const showQuestion = aq && (this.phase === 'expansion_question' || this.phase === 'battle_question' || this.phase === 'expansion_reveal' || this.phase === 'battle_reveal');
    return {
      code: this.code,
      grade: this.grade,
      mode: this.mode,
      mapId: map.id,
      hostUid: this.hostUid,
      isQuick: this.isQuick,
      vsBot: this.vsBot,
      phase: this.phase,
      players,
      regions,
      round: this.round,
      maxRounds: RULES.MAX_ROUNDS,
      turnUid: this.phase.startsWith('battle') ? this.currentTurnUid() : null,
      attacksLeft: this.attacksLeft,
      question: showQuestion
        ? {
            id: aq.q.id,
            type: aq.q.type,
            prompt: aq.q.prompt,
            context: aq.q.context,
            options: aq.q.options,
            workTitle: aq.q.workTitle,
            topicLabel: aq.q.topicLabel,
            participants: aq.participants,
            startedAt: aq.startedAt,
            deadline: Math.max(...aq.deadlines.values()),
          }
        : null,
      answeredUids: aq ? [...aq.answers.keys()] : [],
      reveal: this.phase === 'expansion_reveal' || this.phase === 'battle_reveal' ? this.reveal : null,
      pick: this.phase === 'expansion_pick' && this.pickQueue.length ? { uid: this.pickQueue[0], queue: [...this.pickQueue] } : null,
      battle: this.battle,
      deadline: this.deadline,
      serverNow: Date.now(),
      log: [...this.log],
      standings: this.standings,
      matchId: this.matchId,
      rematchCode: this.rematchCode,
    };
  }
}

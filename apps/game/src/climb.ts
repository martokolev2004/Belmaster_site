// „Към върха“ — стая за двама на сървъра (всички правила се пазят тук).
import type { Namespace, Socket } from 'socket.io';
import { prisma, recordAnswers, type Grade } from '@belmaster/db';
import {
  CHAT_MESSAGES,
  CLIMB,
  XP_MATCH_PLAY,
  XP_MATCH_WIN,
  aimHit,
  aimMarker,
  aimZoneWidth,
  currentSeason,
  type AnyAnswer,
  type ClimbAim,
  type ClimbClientToServer,
  type ClimbOutcome,
  type ClimbPhase,
  type ClimbPlayer,
  type ClimbReveal,
  type ClimbServerToClient,
  type ClimbState,
  type GameTokenClaims,
  CLIMB_JOKER_TIME_MS,
} from '@belmaster/shared';
import { QuestionPool, botAnswer, correctText, grade, type PoolQuestion } from './questions.js';
import { eloDeltas } from './elo.js';
import { awardXp } from './persist.js';

type NS = Namespace<ClimbClientToServer, ClimbServerToClient, Record<string, never>, { user: GameTokenClaims }>;
type S = Socket<ClimbClientToServer, ClimbServerToClient, Record<string, never>, { user: GameTokenClaims }>;

const COLORS = ['#ff4b4b', '#1cb0f6'];
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

interface P extends Omit<ClimbPlayer, 'shieldArmed'> {
  removed: Map<string, number[]>;
  shieldArmed: boolean;
  sockets: Set<string>;
  dropTimer: NodeJS.Timeout | null;
}

interface Review {
  questionId: string;
  prompt: string;
  type: string;
  options: string[];
  correctIndex: number | null;
  correctText: string | null;
  explanation: string | null;
  workTitle: string | null;
  results: { uid: string; name: string; correct: boolean; score: number; timeMs: number | null; answer: string | null }[];
}

export class ClimbRoom {
  phase: ClimbPhase = 'lobby';
  players = new Map<string, P>();
  order: string[] = [];
  vsBot = false;
  isQuick = false;
  questionNo = 0;
  winnerUid: string | null = null;
  draw = false;
  matchId: string | null = null;
  ratingDelta: Record<string, number> | null = null;
  rematchCode: string | null = null;
  startedAt = 0;
  review: Review[] = [];
  log: string[] = [];

  private pool: QuestionPool | null = null;
  private q: { q: PoolQuestion; startedAt: number; deadline: number; deadlines: Map<string, number>; answers: Map<string, { a: AnyAnswer; at: number; correct: boolean; score: number }> } | null = null;
  private reveal: ClimbReveal | null = null;
  private actorUid: string | null = null;
  private aim: ClimbAim | null = null;
  private outcome: ClimbState['outcome'] = null;
  private outcomeId = 0;
  private deadline: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastChat = new Map<string, number>();

  constructor(
    public code: string,
    public grade: Grade,
    public hostUid: string,
    private hooks: { emit: (room: ClimbRoom) => void; onFinished: (room: ClimbRoom) => void; onEmpty: (room: ClimbRoom) => void; onRemoved: (room: ClimbRoom, uid: string) => void },
  ) {}

  // ───────────── играчи ─────────────
  addPlayer(u: { uid: string; name: string; isGuest: boolean; isBot?: boolean; avatar?: ClimbPlayer['avatar']; frame?: ClimbPlayer['frame']; weapon?: string }): string | null {
    if (this.players.has(u.uid)) {
      const p = this.players.get(u.uid)!;
      if (p.left) return 'Ти напусна тази игра.';
      return null;
    }
    if (this.phase !== 'lobby') return 'Играта вече е започнала.';
    if (this.players.size >= 2) return 'Стаята е пълна (играта е за двама).';
    this.players.set(u.uid, {
      uid: u.uid,
      name: u.name,
      avatar: u.avatar ?? null,
      frame: u.frame ?? 'none',
      weapon: u.weapon ?? 'stone',
      color: COLORS[this.players.size],
      isBot: !!u.isBot,
      isGuest: u.isGuest,
      height: 0,
      shieldUsed: false,
      shieldArmed: false,
      connected: !!u.isBot,
      left: false,
      correct: 0,
      answered: 0,
      ready: !!u.isBot,
      jokers: { fifty: true, time: true },
      removed: new Map(),
      sockets: new Set(),
      dropTimer: null,
    });
    this.order.push(u.uid);
    return null;
  }

  attach(uid: string, sid: string) {
    const p = this.players.get(uid);
    if (!p) return;
    p.sockets.add(sid);
    p.connected = true;
    if (p.dropTimer) {
      clearTimeout(p.dropTimer);
      p.dropTimer = null;
    }
    this.emit();
  }

  detach(uid: string, sid: string) {
    const p = this.players.get(uid);
    if (!p) return;
    p.sockets.delete(sid);
    if (p.sockets.size) return;
    p.connected = false;
    if (this.phase === 'lobby' || this.phase === 'finished') {
      if (this.phase === 'lobby') this.drop(uid);
      return this.emit();
    }
    p.dropTimer = setTimeout(() => this.drop(uid), CLIMB.RECONNECT_MS);
    this.emit();
  }

  drop(uid: string) {
    const p = this.players.get(uid);
    if (!p) return;
    if (this.phase === 'lobby') {
      this.players.delete(uid);
      this.order = this.order.filter((u) => u !== uid);
      this.hooks.onRemoved(this, uid);
      if (![...this.players.values()].some((x) => !x.isBot)) return this.destroy();
      if (this.hostUid === uid) this.hostUid = this.order.find((u) => !this.players.get(u)!.isBot) ?? this.hostUid;
      return this.emit();
    }
    if (this.phase === 'finished') {
      p.left = true;
      this.hooks.onRemoved(this, uid);
      return this.emit();
    }
    // по време на игра — напускането е загуба
    p.left = true;
    p.connected = false;
    this.hooks.onRemoved(this, uid);
    const other = this.other(uid);
    this.pushLog(`${p.name} напусна играта.`);
    this.finish(other?.uid ?? null, false);
  }

  setReady(uid: string, ready: boolean) {
    const p = this.players.get(uid);
    if (!p || this.phase !== 'lobby') return;
    p.ready = ready;
    this.emit();
  }

  other(uid: string): P | undefined {
    return [...this.players.values()].find((p) => p.uid !== uid);
  }

  // ───────────── ход на играта ─────────────
  async start(byUid: string | null): Promise<string | null> {
    if (this.phase !== 'lobby') return 'Играта вече е започнала.';
    if (byUid && byUid !== this.hostUid) return 'Само домакинът може да започне.';
    if (this.players.size !== 2) return 'Нужни са двама играчи.';
    if ([...this.players.values()].some((p) => !p.ready && !p.isBot && p.uid !== byUid)) return 'Другият играч още не е готов.';
    this.pool = await QuestionPool.load(this.grade);
    if (this.pool.size < 5) return 'Още няма достатъчно въпроси за този клас.';
    this.startedAt = Date.now();
    this.pushLog('Играта започна! Пръв до 10-ото стъпало печели.');
    this.nextQuestion();
    return null;
  }

  private nextQuestion() {
    if (this.questionNo >= CLIMB.MAX_QUESTIONS) return this.finishByHeight();
    this.questionNo++;
    const q = this.pool!.random();
    const now = Date.now();
    this.phase = 'question';
    this.q = { q, startedAt: now, deadline: now + q.timeMs, deadlines: new Map(this.order.map((u) => [u, now + q.timeMs])), answers: new Map() };
    this.reveal = null;
    this.actorUid = null;
    this.aim = null;
    this.deadline = now + q.timeMs;
    this.schedule(q.timeMs + 150, () => this.resolveQuestion());
    for (const p of this.players.values()) if (p.isBot) this.botAnswer(p.uid);
    this.emit();
  }

  answer(uid: string, questionId: string, a: AnyAnswer) {
    const aq = this.q;
    if (this.phase !== 'question' || !aq || aq.q.id !== questionId || aq.answers.has(uid) || !this.players.has(uid)) return;
    const now = Date.now();
    if (now > (aq.deadlines.get(uid) ?? aq.deadline) + 300) return;
    const clean: AnyAnswer = {
      index: typeof a.index === 'number' ? a.index : null,
      text: typeof a.text === 'string' ? a.text.slice(0, 2000) : null,
      texts: Array.isArray(a.texts) ? a.texts.slice(0, 5).map((t) => (typeof t === 'string' ? t.slice(0, 200) : null)) : null,
      pairs: Array.isArray(a.pairs) ? a.pairs.slice(0, 12).map((x) => (typeof x === 'number' ? x : null)) : null,
      blanks: Array.isArray(a.blanks) ? a.blanks.slice(0, 12).map((x) => (typeof x === 'number' ? x : null)) : null,
      marks: Array.isArray(a.marks)
        ? a.marks
            .slice(0, 60)
            .filter((m) => m && typeof m.i === 'number' && (m.pos === 'before' || m.pos === 'after') && typeof m.mark === 'string')
            .map((m) => ({ i: m.i, pos: m.pos, mark: m.mark.slice(0, 2) }))
        : null,
    };
    const r = grade(aq.q, clean);
    aq.answers.set(uid, { a: clean, at: now, correct: r.correct, score: r.score });
    this.emit();
    // и двамата отговорили, или първият вече е отговорил вярно — няма смисъл да чакаме
    const active = [...this.players.values()].filter((p) => !p.left);
    if (r.correct || active.every((p) => aq.answers.has(p.uid))) {
      // ако вторият още може да отговори, но първият е верен — той вече е най-бързият верен
      this.schedule(400, () => this.resolveQuestion());
    }
  }

  /** Жокери: 50/50 (маха два грешни отговора) и +5 секунди — по един за игра. */
  useJoker(uid: string, kind: 'fifty' | 'time') {
    const aq = this.q;
    const p = this.players.get(uid);
    if (this.phase !== 'question' || !aq || !p || aq.answers.has(uid)) return;
    if (kind === 'fifty') {
      if (!p.jokers.fifty || aq.q.type !== 'SINGLE_CHOICE' || aq.q.options.length < 3) return;
      p.jokers.fifty = false;
      const wrong = aq.q.options.map((_, i) => i).filter((i) => i !== aq.q.correctIndex).sort(() => Math.random() - 0.5);
      p.removed.set(aq.q.id, wrong.slice(0, aq.q.options.length - 2));
    } else {
      if (!p.jokers.time) return;
      p.jokers.time = false;
      aq.deadlines.set(uid, (aq.deadlines.get(uid) ?? aq.deadline) + CLIMB_JOKER_TIME_MS);
      aq.deadline = Math.max(...aq.deadlines.values());
      this.deadline = aq.deadline;
      this.schedule(aq.deadline - Date.now() + 150, () => this.resolveQuestion());
    }
    this.emit();
  }

  private resolveQuestion() {
    const aq = this.q;
    if (this.phase !== 'question' || !aq) return;
    const results = this.order.map((uid) => {
      const a = aq.answers.get(uid);
      const p = this.players.get(uid)!;
      p.answered++;
      if (a?.correct) p.correct++;
      return { uid, correct: !!a?.correct, score: a?.score ?? 0, timeMs: a ? a.at - aq.startedAt : null, a };
    });
    const winner = results.filter((r) => r.correct).sort((x, y) => (x.timeMs ?? 1e9) - (y.timeMs ?? 1e9))[0];
    this.review.push({
      questionId: aq.q.id,
      prompt: aq.q.prompt,
      type: aq.q.type,
      options: aq.q.options,
      correctIndex: aq.q.correctIndex,
      correctText: correctText(aq.q),
      explanation: aq.q.explanation,
      workTitle: aq.q.workTitle,
      results: results.map((r) => ({
        uid: r.uid,
        name: this.players.get(r.uid)!.name,
        correct: r.correct,
        score: r.score,
        timeMs: r.correct ? r.timeMs : null,
        answer: r.a?.a.index != null ? LETTERS[r.a.a.index] ?? null : r.a?.a.text ?? (r.a?.a.texts ? r.a.a.texts.filter(Boolean).join('; ') : null),
      })),
    });
    this.reveal = {
      correctIndex: aq.q.correctIndex,
      correctText: aq.q.type === 'SINGLE_CHOICE' ? null : correctText(aq.q),
      explanation: aq.q.explanation,
      results: results.map((r) => ({ uid: r.uid, correct: r.correct, timeMs: r.correct ? r.timeMs : null })),
      actorUid: winner?.uid ?? null,
    };
    this.phase = 'reveal';
    this.deadline = Date.now() + CLIMB.REVEAL_MS;
    if (winner) this.pushLog(`${this.players.get(winner.uid)!.name} отговори пръв вярно и избира.`);
    else this.pushLog('Никой не отговори вярно.');
    this.schedule(CLIMB.REVEAL_MS, () => (winner ? this.beginChoose(winner.uid) : this.nextQuestion()));
    this.emit();
  }

  private beginChoose(uid: string) {
    this.phase = 'choose';
    this.actorUid = uid;
    this.deadline = Date.now() + CLIMB.CHOOSE_MS;
    this.schedule(CLIMB.CHOOSE_MS, () => this.choose(uid, 'climb', true));
    const p = this.players.get(uid)!;
    if (p.isBot) this.botChoose(uid);
    else {
      const o = this.other(uid);
      if (o?.isBot) this.botMaybeShield(o.uid);
    }
    this.emit();
  }

  /** Щитът: веднъж за игра; важи до следващото решение на другия. */
  shield(uid: string) {
    const p = this.players.get(uid);
    if (!p || p.shieldUsed || this.phase === 'lobby' || this.phase === 'finished') return;
    // не може след като другият вече е избрал
    if ((this.phase === 'aim' || this.phase === 'resolve') && this.actorUid !== uid) return;
    if (this.phase === 'choose' && this.actorUid === uid) return;
    p.shieldUsed = true;
    p.shieldArmed = true;
    this.emit();
  }

  choose(uid: string, action: 'climb' | 'throw', auto = false) {
    if (this.phase !== 'choose' || this.actorUid !== uid) return;
    const target = this.other(uid)!;
    if (action === 'climb') {
      const outcomes: ClimbOutcome[] = [{ kind: 'climb', actorUid: uid }];
      if (target.shieldArmed) {
        target.shieldArmed = false;
        outcomes.push({ kind: 'shield_wasted', actorUid: uid, targetUid: target.uid });
      }
      const p = this.players.get(uid)!;
      p.height = Math.min(CLIMB.STEPS, p.height + 1);
      this.pushLog(`${p.name} ${auto ? '(времето изтече) ' : ''}се качи на стъпало ${p.height}.`);
      return this.resolveOutcome(outcomes);
    }
    // хвърляне — прицел
    const actor = this.players.get(uid)!;
    const width = aimZoneWidth(actor.height);
    const center = width / 2 + 0.05 + Math.random() * (0.9 - width);
    const now = Date.now();
    this.aim = { actorUid: uid, zoneCenter: center, zoneWidth: width, periodMs: CLIMB.AIM_PERIOD_MS, startedAt: now + 600, deadline: now + 600 + CLIMB.AIM_MS };
    this.phase = 'aim';
    this.deadline = this.aim.deadline;
    this.schedule(CLIMB.AIM_MS + 900, () => this.throwAt(uid, null));
    if (actor.isBot) this.botAim(uid);
    this.emit();
  }

  /** Натискане в прицела. elapsed = ms от началото на маркера (по часовника на клиента). */
  throwAt(uid: string, elapsed: number | null) {
    if (this.phase !== 'aim' || !this.aim || this.aim.actorUid !== uid) return;
    const aim = this.aim;
    const serverElapsed = Date.now() - aim.startedAt;
    let pos = -1;
    if (elapsed != null && Number.isFinite(elapsed)) {
      const e = Math.max(serverElapsed - 1500, Math.min(serverElapsed + 300, elapsed));
      if (e >= 0) pos = aimMarker(e, aim.periodMs);
    }
    const actor = this.players.get(uid)!;
    const target = this.other(uid)!;
    const hit = pos >= 0 && aimHit(pos, aim.zoneCenter, aim.zoneWidth);
    let out: ClimbOutcome;
    if (target.shieldArmed) {
      target.shieldArmed = false;
      out = { kind: 'reflect', actorUid: uid, targetUid: target.uid, weapon: actor.weapon, pos, actorAtGround: actor.height === 0 };
      actor.height = Math.max(0, actor.height - 1);
      this.pushLog(`🛡️ ${target.name} отби удара! ${actor.name} пада на стъпало ${actor.height}.`);
    } else if (hit) {
      out = { kind: 'hit', actorUid: uid, targetUid: target.uid, weapon: actor.weapon, pos, targetAtGround: target.height === 0 };
      target.height = Math.max(0, target.height - 1);
      this.pushLog(`🎯 ${actor.name} уцели! ${target.name} пада на стъпало ${target.height}.`);
    } else {
      out = { kind: 'miss', actorUid: uid, targetUid: target.uid, weapon: actor.weapon, pos, actorAtGround: actor.height === 0 };
      actor.height = Math.max(0, actor.height - 1);
      this.pushLog(`💥 ${actor.name} не уцели и падна на стъпало ${actor.height}.`);
    }
    this.resolveOutcome([out]);
  }

  private resolveOutcome(outcomes: ClimbOutcome[]) {
    this.phase = 'resolve';
    this.aim = null;
    this.outcomeId++;
    this.outcome = { ...outcomes[0], id: this.outcomeId, outcomes };
    this.deadline = Date.now() + CLIMB.RESOLVE_MS;
    this.emit();
    this.schedule(CLIMB.RESOLVE_MS, () => {
      const top = [...this.players.values()].find((p) => p.height >= CLIMB.STEPS);
      if (top) return this.finish(top.uid, false);
      this.nextQuestion();
    });
  }

  private finishByHeight() {
    const [a, b] = this.order.map((u) => this.players.get(u)!);
    if (a.height === b.height) {
      this.pushLog('35 въпроса изминаха — равенство!');
      return this.finish(null, true);
    }
    const w = a.height > b.height ? a : b;
    this.pushLog(`35 въпроса изминаха — ${w.name} е по-високо и печели.`);
    this.finish(w.uid, false);
  }

  private finish(winnerUid: string | null, draw: boolean) {
    if (this.phase === 'finished') return;
    this.clearTimer();
    this.phase = 'finished';
    this.winnerUid = winnerUid;
    this.draw = draw;
    this.deadline = null;
    this.q = null;
    this.aim = null;
    if (winnerUid) this.pushLog(`🏆 ${this.players.get(winnerUid)!.name} стигна до върха!`);
    this.emit();
    this.hooks.onFinished(this);
  }

  destroy() {
    this.clearTimer();
    for (const p of this.players.values()) if (p.dropTimer) clearTimeout(p.dropTimer);
    this.hooks.onEmpty(this);
  }

  chat(uid: string, key: string) {
    const now = Date.now();
    if (now - (this.lastChat.get(uid) ?? 0) < 1500) return false;
    this.lastChat.set(uid, now);
    return true;
  }

  // ───────────── бот ─────────────
  private botAnswer(uid: string) {
    const aq = this.q!;
    const delay = 3500 + Math.random() * Math.min(aq.q.timeMs - 6000, 14_000);
    setTimeout(() => {
      if (this.q !== aq || this.phase !== 'question') return;
      this.answer(uid, aq.q.id, botAnswer(aq.q, Math.random() < 0.6));
    }, delay);
  }

  private botChoose(uid: string) {
    setTimeout(() => {
      if (this.phase !== 'choose' || this.actorUid !== uid) return;
      const me = this.players.get(uid)!;
      const o = this.other(uid)!;
      // хвърля, ако другият е напред или близо до върха и не е на земята
      const throwIt = o.height > 0 && (o.height >= me.height || o.height >= CLIMB.STEPS - 3) && Math.random() < 0.75;
      this.choose(uid, throwIt ? 'throw' : 'climb');
    }, 1500 + Math.random() * 2000);
  }

  private botAim(uid: string) {
    const aim = this.aim!;
    // натиска в момент, когато маркерът е в зоната с ~55% шанс
    const good = Math.random() < 0.55;
    let t = 700 + Math.random() * 1500;
    for (let i = 0; i < 200; i++) {
      const inZone = aimHit(aimMarker(t, aim.periodMs), aim.zoneCenter, aim.zoneWidth);
      if (inZone === good) break;
      t += 37;
    }
    setTimeout(() => this.throwAt(uid, t), Math.max(0, aim.startedAt - Date.now()) + t);
  }

  private botMaybeShield(uid: string) {
    const me = this.players.get(uid)!;
    const o = this.other(uid)!;
    if (me.shieldUsed || me.height === 0) return;
    if (me.height >= o.height && Math.random() < 0.35) setTimeout(() => this.phase === 'choose' && this.shield(uid), 700 + Math.random() * 2000);
  }

  // ───────────── помощни ─────────────
  private pushLog(line: string) {
    this.log = [...this.log.slice(-14), line];
  }

  private schedule(ms: number, fn: () => void) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit() {
    this.hooks.emit(this);
  }

  toState(forUid: string): ClimbState {
    const aq = this.q;
    return {
      code: this.code,
      grade: this.grade,
      phase: this.phase,
      you: forUid,
      hostUid: this.hostUid,
      vsBot: this.vsBot,
      isQuick: this.isQuick,
      players: this.order.map((uid) => {
        const p = this.players.get(uid)!;
        return {
          uid: p.uid,
          name: p.name,
          avatar: p.avatar,
          frame: p.frame,
          weapon: p.weapon,
          color: p.color,
          isBot: p.isBot,
          isGuest: p.isGuest,
          height: p.height,
          shieldUsed: uid === forUid ? p.shieldUsed : false,
          shieldArmed: uid === forUid ? p.shieldArmed : false,
          connected: p.connected,
          left: p.left,
          correct: p.correct,
          answered: p.answered,
          ready: p.ready,
          jokers: uid === forUid ? p.jokers : { fifty: false, time: false },
        };
      }),
      questionNo: this.questionNo,
      maxQuestions: CLIMB.MAX_QUESTIONS,
      question:
        aq && this.phase === 'question'
          ? {
              id: aq.q.id,
              type: aq.q.type,
              prompt: aq.q.prompt,
              context: aq.q.context,
              options: aq.q.options,
              answerCount: aq.q.answerCount,
              matching: aq.q.matching ? { left: aq.q.matching.left, right: aq.q.matching.right } : null,
              blanks: aq.q.data?.blanks ? { text: aq.q.data.blanks.text, blanks: aq.q.data.blanks.blanks.map((b) => ({ label: b.label, options: b.options })) } : null,
              tokens: aq.q.data?.punctuation ? aq.q.data.punctuation.tokens : null,
              timeMs: aq.q.timeMs,
              topicLabel: aq.q.topicLabel,
              workTitle: aq.q.workTitle,
              startedAt: aq.startedAt,
              deadline: aq.deadline,
              answered: [...aq.answers.keys()],
              myDeadline: aq.deadlines.get(forUid) ?? aq.deadline,
              removed: this.players.get(forUid)?.removed.get(aq.q.id) ?? [],
            }
          : null,
      reveal: this.phase === 'reveal' ? this.reveal : null,
      actorUid: this.actorUid,
      aim: this.aim,
      outcome: this.outcome,
      deadline: this.deadline,
      winnerUid: this.winnerUid,
      draw: this.draw,
      log: this.log,
      matchId: this.matchId,
      ratingDelta: this.ratingDelta,
      rematchCode: this.rematchCode,
      serverNow: Date.now(),
    };
  }
}

// ───────────── запис в базата ─────────────
async function persistClimb(room: ClimbRoom) {
  const players = room.order.map((u) => room.players.get(u)!);
  const humans = players.filter((p) => !p.isBot);
  const registered = humans.filter((p) => !p.isGuest);
  const rated = !room.vsBot && registered.length === 2;
  const place = (p: P) => (room.draw ? 1 : p.uid === room.winnerUid ? 1 : 2);
  const deltas: Record<string, number> = {};
  if (rated) {
    const season = currentSeason();
    for (const s of [season, 'all']) {
      const rows = await Promise.all(
        registered.map((p) =>
          prisma.climbRating.upsert({ where: { userId_grade_season: { userId: p.uid, grade: room.grade, season: s } }, update: {}, create: { userId: p.uid, grade: room.grade, season: s } }),
        ),
      );
      const d = eloDeltas(registered.map((p, i) => ({ uid: p.uid, rating: rows[i].rating, place: place(p) })));
      for (const p of registered) {
        const delta = d.get(p.uid) ?? 0;
        if (s === season) deltas[p.uid] = delta;
        await prisma.climbRating.update({
          where: { userId_grade_season: { userId: p.uid, grade: room.grade, season: s } },
          data: { rating: { increment: delta }, games: { increment: 1 }, wins: { increment: place(p) === 1 && !room.draw ? 1 : 0 } },
        });
      }
    }
    room.ratingDelta = deltas;
  }
  const match = await prisma.match.create({
    data: {
      grade: room.grade,
      mode: 'CLIMB',
      mapId: 'climb',
      rated,
      vsBot: room.vsBot,
      rounds: room.questionNo,
      winnerUid: room.winnerUid && !room.players.get(room.winnerUid)?.isBot ? room.winnerUid : null,
      review: room.review as object[],
      startedAt: new Date(room.startedAt || Date.now()),
      players: {
        create: players.map((p) => ({
          userId: p.isBot ? null : p.uid,
          name: p.name,
          color: p.color,
          place: place(p),
          territories: p.height,
          correct: p.correct,
          answered: p.answered,
          ratingDelta: deltas[p.uid] ?? null,
          isBot: p.isBot,
          isGuest: p.isGuest,
        })),
      },
    },
  });
  room.matchId = match.id;
  for (const p of humans) {
    const items = room.review.flatMap((r) => r.results.filter((x) => x.uid === p.uid).map((x) => ({ questionId: r.questionId, score: x.score, correct: x.correct })));
    await recordAnswers(prisma, p.uid, items).catch((e) => console.error('[climb] answers', e));
    if (p.isGuest) continue;
    const xp = XP_MATCH_PLAY + (room.winnerUid === p.uid ? XP_MATCH_WIN : 0) + p.correct * 10;
    await awardXp(p.uid, xp, ['first_battle', ...(room.winnerUid === p.uid ? ['first_win'] : [])]).catch((e) => console.error('[climb] xp', e));
  }
}

// ───────────── свързване (namespace /climb) ─────────────
export function registerClimb(ns: NS, newCode: () => string) {
  const rooms = new Map<string, ClimbRoom>();
  const userRoom = new Map<string, string>();
  const userSockets = new Map<string, Set<string>>();
  let queue: { user: GameTokenClaims; since: number }[] = [];

  const hooks = {
    emit(room: ClimbRoom) {
      for (const p of room.players.values()) for (const sid of userSockets.get(p.uid) ?? []) ns.to(sid).emit('state', room.toState(p.uid));
    },
    onFinished(room: ClimbRoom) {
      persistClimb(room)
        .then(() => hooks.emit(room))
        .catch((e) => console.error('[climb] persist', e));
      setTimeout(() => rooms.get(room.code) === room && room.destroy(), 15 * 60_000);
    },
    onEmpty(room: ClimbRoom) {
      rooms.delete(room.code);
      for (const [u, c] of userRoom) if (c === room.code) userRoom.delete(u);
    },
    onRemoved(room: ClimbRoom, uid: string) {
      if (userRoom.get(uid) === room.code) userRoom.delete(uid);
      for (const sid of userSockets.get(uid) ?? []) ns.to(sid).emit('left');
    },
  };

  const create = (grade: Grade, host: string) => {
    let code = newCode();
    while (rooms.has(code)) code = newCode();
    const r = new ClimbRoom(code, grade, host, hooks);
    rooms.set(code, r);
    return r;
  };

  const enter = (room: ClimbRoom, user: GameTokenClaims): string | null => {
    const cur = userRoom.get(user.uid);
    if (cur && cur !== room.code) {
      const old = rooms.get(cur);
      if (old && old.phase !== 'lobby' && old.phase !== 'finished' && !old.players.get(user.uid)?.left) return `Вече си в игра (код ${cur}). Довърши я или я напусни.`;
      old?.drop(user.uid);
    }
    const err = room.addPlayer({ uid: user.uid, name: user.name, isGuest: user.isGuest, avatar: user.avatar ?? null, frame: user.frame ?? 'none', weapon: user.weapon });
    if (err) return err;
    userRoom.set(user.uid, room.code);
    for (const sid of userSockets.get(user.uid) ?? []) room.attach(user.uid, sid);
    hooks.emit(room);
    return null;
  };

  const startBot = async (user: GameTokenClaims, fail: (m: string) => void) => {
    const room = create(user.grade as Grade, user.uid);
    room.vsBot = true;
    const err = enter(room, user);
    if (err) {
      room.destroy();
      return fail(err);
    }
    const weapons = ['stone', 'ball', 'brick', 'book'];
    room.addPlayer({ uid: `bot:${room.code}`, name: 'Бот Перко', isGuest: false, isBot: true, weapon: weapons[Math.floor(Math.random() * weapons.length)] });
    room.setReady(user.uid, true);
    const e = await room.start(null);
    if (e) {
      fail(e);
      room.drop(user.uid);
    }
  };

  ns.on('connection', (socket: S) => {
    const user = socket.data.user;
    const set = userSockets.get(user.uid) ?? new Set();
    set.add(socket.id);
    userSockets.set(user.uid, set);
    const fail = (message: string) => socket.emit('error', { message });
    const my = () => {
      const c = userRoom.get(user.uid);
      return c ? rooms.get(c) ?? null : null;
    };
    const leaveQueue = () => (queue = queue.filter((q) => q.user.uid !== user.uid));

    const existing = my();
    if (existing && !existing.players.get(user.uid)?.left) existing.attach(user.uid, socket.id);

    socket.on('climb:create', () => {
      const room = create(user.grade as Grade, user.uid);
      const err = enter(room, user);
      if (err) {
        room.destroy();
        fail(err);
      }
    });
    socket.on('climb:join', ({ code }) => {
      const room = rooms.get(String(code ?? '').toUpperCase().trim());
      if (!room) return fail('Няма стая с този код.');
      if (room.grade !== user.grade) return fail('Тази игра е за друг клас.');
      const err = enter(room, user);
      if (err) fail(err);
    });
    socket.on('climb:leave', () => {
      leaveQueue();
      const room = my();
      if (room) room.drop(user.uid);
      socket.emit('left');
    });
    socket.on('climb:ready', ({ ready }) => my()?.setReady(user.uid, !!ready));
    socket.on('climb:start', async () => {
      const room = my();
      if (!room) return;
      const err = await room.start(user.uid);
      if (err) fail(err);
    });
    socket.on('climb:bot', async () => {
      leaveQueue();
      socket.emit('quick', { searching: false, since: null, offerBot: false });
      await startBot(user, fail);
    });
    socket.on('climb:quick', async () => {
      leaveQueue();
      const op = queue.find((q) => q.user.grade === user.grade && q.user.uid !== user.uid && userSockets.has(q.user.uid));
      if (op) {
        queue = queue.filter((q) => q !== op);
        const room = create(user.grade as Grade, op.user.uid);
        room.isQuick = true;
        const e1 = enter(room, op.user);
        const e2 = enter(room, user);
        if (e1 || e2) {
          room.destroy();
          return fail(e1 ?? e2!);
        }
        for (const uid of [op.user.uid, user.uid]) {
          room.setReady(uid, true);
          for (const sid of userSockets.get(uid) ?? []) ns.to(sid).emit('quick', { searching: false, since: null, offerBot: false });
        }
        setTimeout(() => void room.start(null).then((e) => e && hooks.emit(room)), 2000);
        return;
      }
      const since = Date.now();
      queue.push({ user, since });
      socket.emit('quick', { searching: true, since, offerBot: false });
      setTimeout(() => {
        if (queue.some((q) => q.user.uid === user.uid && q.since === since))
          for (const sid of userSockets.get(user.uid) ?? []) ns.to(sid).emit('quick', { searching: true, since, offerBot: true });
      }, CLIMB.QUICK_MATCH_BOT_OFFER_MS);
    });
    socket.on('climb:quick_leave', () => {
      leaveQueue();
      socket.emit('quick', { searching: false, since: null, offerBot: false });
    });
    socket.on('climb:answer', (p) => my()?.answer(user.uid, String(p.questionId), p as AnyAnswer));
    socket.on('climb:choose', ({ action }) => my()?.choose(user.uid, action === 'throw' ? 'throw' : 'climb'));
    socket.on('climb:aim', ({ elapsed }) => my()?.throwAt(user.uid, typeof elapsed === 'number' ? elapsed : null));
    socket.on('climb:shield', () => my()?.shield(user.uid));
    socket.on('climb:joker', ({ kind }) => my()?.useJoker(user.uid, kind === 'time' ? 'time' : 'fifty'));
    socket.on('climb:chat', ({ key }) => {
      const room = my();
      if (!room || !CHAT_MESSAGES.some((m) => m.key === key) || !room.chat(user.uid, key)) return;
      for (const p of room.players.values()) for (const sid of userSockets.get(p.uid) ?? []) ns.to(sid).emit('chat', { uid: user.uid, key, at: Date.now() });
    });
    socket.on('climb:rematch', async () => {
      const room = my();
      if (!room || room.phase !== 'finished') return;
      if (room.vsBot) return startBot(user, fail);
      if (room.rematchCode && rooms.has(room.rematchCode)) {
        const err = enter(rooms.get(room.rematchCode)!, user);
        if (err) fail(err);
        return;
      }
      const r = create(user.grade as Grade, user.uid);
      room.rematchCode = r.code;
      const err = enter(r, user);
      if (err) return fail(err);
      hooks.emit(room);
    });
    socket.on('disconnect', () => {
      const s = userSockets.get(user.uid);
      s?.delete(socket.id);
      if (s && !s.size) {
        userSockets.delete(user.uid);
        leaveQueue();
      }
      my()?.detach(user.uid, socket.id);
    });
  });

  return { rooms };
}

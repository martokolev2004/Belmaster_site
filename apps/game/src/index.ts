import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { jwtVerify } from 'jose';
import { prisma, type Grade } from '@belmaster/db';
import {
  CHAT_MESSAGES,
  RULES,
  isGrade,
  sanitizeAvatar,
  type ClientToServer,
  type GameMode,
  type GameTokenClaims,
  type ServerToClient,
  WEAPONS,
} from '@belmaster/shared';
import { Room, type RoomHooks } from './room.js';
import { areFriends, persistMatch } from './persist.js';
import { registerClimb } from './climb.js';
import { ADMIN_UIDS } from './admins.js';

const PORT = Number(process.env.GAME_PORT ?? process.env.PORT ?? 4000);
const SECRET = new TextEncoder().encode(process.env.GAME_JWT_SECRET ?? 'dev-secret');
const ORIGINS = (process.env.APP_URL ?? 'http://localhost:3000').split(',').map((s) => s.trim());

type S = Socket<ClientToServer, ServerToClient, Record<string, never>, { user: GameTokenClaims }>;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, online: userSockets.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServer, ServerToClient, Record<string, never>, { user: GameTokenClaims }>(httpServer, {
  cors: { origin: ORIGINS, credentials: true },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});

const rooms = new Map<string, Room>();
const userRoom = new Map<string, string>();
const userSockets = new Map<string, Set<string>>();
const quickQueue = new Map<string, { uid: string; name: string; isGuest: boolean; since: number; avatar: GameTokenClaims['avatar']; frame: GameTokenClaims['frame'] }[]>();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

const hooks: RoomHooks = {
  broadcast(room) {
    io.to(`room:${room.code}`).emit('state', room.toState());
    const aq = room.question;
    if (aq && aq.q.type === 'SINGLE_CHOICE' && aq.q.correctIndex != null) {
      for (const uid of room.players.keys())
        if (ADMIN_UIDS.has(uid)) for (const sid of userSockets.get(uid) ?? []) io.to(sid).emit('admin:hint', { questionId: aq.q.id, index: aq.q.correctIndex });
    }
  },
  sendFifty(uid, questionId, removed) {
    for (const sid of userSockets.get(uid) ?? []) io.to(sid).emit('joker:fifty', { questionId, removed });
  },
  chat(room, uid, key) {
    const p = room.players.get(uid)!;
    io.to(`room:${room.code}`).emit('chat', { uid, name: p.name, color: p.color, key, at: Date.now() });
  },
  async onFinished(room) {
    await persistMatch(room);
    // стаята остава 15 минути за резултатите и реванша
    setTimeout(() => {
      if (rooms.get(room.code) === room) room.destroy();
    }, 15 * 60_000);
  },
  onEmpty(room) {
    rooms.delete(room.code);
    for (const [uid, code] of userRoom) if (code === room.code) userRoom.delete(uid);
  },
  onPlayerRemoved(room, uid) {
    if (userRoom.get(uid) === room.code) userRoom.delete(uid);
    for (const sid of userSockets.get(uid) ?? []) {
      const s = io.sockets.sockets.get(sid);
      s?.leave(`room:${room.code}`);
      s?.emit('left');
    }
  },
};

function createRoom(grade: Grade, mode: GameMode, hostUid: string): Room {
  const room = new Room(newCode(), grade, mode, hostUid, hooks);
  rooms.set(room.code, room);
  return room;
}

/** Присъединява сокетите на потребителя към стаята. */
function enterRoom(room: Room, user: GameTokenClaims): string | null {
  const current = userRoom.get(user.uid);
  if (current && current !== room.code) {
    const old = rooms.get(current);
    if (old && old.phase !== 'lobby' && old.phase !== 'finished' && old.players.get(user.uid) && !old.players.get(user.uid)!.left) {
      return `Вече си в битка (код ${current}). Довърши я или я напусни.`;
    }
    old?.dropPlayer(user.uid, 'leave');
  }
  const err = room.addPlayer({ uid: user.uid, name: user.name, isGuest: user.isGuest, avatar: user.avatar ?? null, frame: user.frame ?? 'none' });
  if (err) return err;
  userRoom.set(user.uid, room.code);
  for (const sid of userSockets.get(user.uid) ?? []) {
    io.sockets.sockets.get(sid)?.join(`room:${room.code}`);
    room.attachSocket(user.uid, sid);
  }
  hooks.broadcast(room);
  return null;
}

function leaveQuick(uid: string) {
  for (const [key, list] of quickQueue) {
    const next = list.filter((e) => e.uid !== uid);
    if (next.length !== list.length) quickQueue.set(key, next);
  }
}

function emitOnline(socket: S, uids: string[]) {
  socket.emit('presence', { online: uids.filter((u) => userSockets.has(u)) });
}

/** Събития, които събират с други хора — забранени за деца без съгласие на родител. */
const PEER_EVENTS = new Set(['lobby:create', 'lobby:join', 'quick:join', 'invite:send', 'climb:create', 'climb:join', 'climb:quick']);

async function authenticate(
  socket: { handshake: { auth: Record<string, unknown> }; data: { user?: GameTokenClaims }; use: (fn: (ev: unknown[], next: (err?: Error) => void) => void) => void; emit: (ev: string, data: unknown) => void },
  next: (err?: Error) => void,
) {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') throw new Error('no token');
    const { payload } = await jwtVerify(token, SECRET);
    const claims = payload as unknown as GameTokenClaims;
    if (!claims.uid || !isGrade(claims.grade)) throw new Error('bad token');
    socket.data.user = {
      uid: claims.uid,
      name: String(claims.name).slice(0, 30),
      grade: claims.grade,
      isGuest: !!claims.isGuest,
      avatar: claims.avatar ? sanitizeAvatar(claims.avatar, null, claims.uid) : null,
      frame: ['none', 'bronze', 'silver', 'gold', 'legend'].includes(String(claims.frame)) ? claims.frame : 'none',
      weapon: WEAPONS.some((w) => w.id === claims.weapon) ? claims.weapon : 'stone',
    };
    if (claims.admin === true) ADMIN_UIDS.add(claims.uid);
    if (claims.restricted === true) {
      socket.use((ev, nxt) => {
        if (PEER_EVENTS.has(String(ev[0]))) {
          socket.emit('error', { message: 'Докато родител не потвърди профила ти, можеш да играеш само срещу бот.' });
          return;
        }
        nxt();
      });
    }
    next();
  } catch {
    next(new Error('unauthorized'));
  }
}

io.use(authenticate as never);
// „Към върха“ — отделна игра на собствен канал
const climbNs = io.of('/climb');
climbNs.use(authenticate as never);
registerClimb(climbNs as never, newCode);

io.on('connection', (socket: S) => {
  const user = socket.data.user;
  const set = userSockets.get(user.uid) ?? new Set();
  set.add(socket.id);
  userSockets.set(user.uid, set);

  const fail = (message: string) => socket.emit('error', { message });
  const myRoom = () => {
    const code = userRoom.get(user.uid);
    return code ? rooms.get(code) ?? null : null;
  };

  // връщане в текуща стая
  const existing = myRoom();
  if (existing && existing.players.has(user.uid) && !existing.players.get(user.uid)!.left) {
    socket.join(`room:${existing.code}`);
    existing.attachSocket(user.uid, socket.id);
    socket.emit('state', existing.toState());
  }

  socket.on('lobby:create', ({ mode }) => {
    const room = createRoom(user.grade, mode === 'WORKS' ? 'WORKS' : 'CLASSIC', user.uid);
    const err = enterRoom(room, user);
    if (err) {
      room.destroy();
      fail(err);
    }
  });

  socket.on('lobby:join', ({ code }) => {
    const room = rooms.get(String(code ?? '').toUpperCase().trim());
    if (!room) return fail('Няма стая с този код.');
    if (room.grade !== user.grade) return fail('Тази битка е за друг клас.');
    if (room.players.get(user.uid)?.left) return fail('Ти напусна тази битка.');
    const err = enterRoom(room, user);
    if (err) fail(err);
  });

  socket.on('lobby:leave', () => {
    leaveQuick(user.uid);
    const room = myRoom();
    if (room) room.dropPlayer(user.uid, 'leave');
    socket.emit('left');
  });

  socket.on('lobby:ready', ({ ready }) => myRoom()?.setReady(user.uid, !!ready));
  socket.on('lobby:mode', ({ mode }) => myRoom()?.setMode(user.uid, mode === 'WORKS' ? 'WORKS' : 'CLASSIC'));
  socket.on('lobby:start', async () => {
    const room = myRoom();
    if (!room) return;
    const err = await room.start(user.uid);
    if (err) fail(err);
  });

  socket.on('quick:join', async ({ mode }) => {
    const m: GameMode = mode === 'WORKS' ? 'WORKS' : 'CLASSIC';
    const key = `${user.grade}:${m}`;
    leaveQuick(user.uid);
    const list = quickQueue.get(key) ?? [];
    const opponent = list.find((e) => e.uid !== user.uid && userSockets.has(e.uid));
    if (opponent) {
      quickQueue.set(key, list.filter((e) => e.uid !== opponent.uid));
      const room = createRoom(user.grade, m, opponent.uid);
      room.isQuick = true;
      const opClaims: GameTokenClaims = { uid: opponent.uid, name: opponent.name, grade: user.grade, isGuest: opponent.isGuest, avatar: opponent.avatar, frame: opponent.frame };
      const e1 = enterRoom(room, opClaims);
      const e2 = enterRoom(room, user);
      if (e1 || e2) {
        room.destroy();
        return fail(e1 ?? e2!);
      }
      for (const uid of [opponent.uid, user.uid]) {
        room.setReady(uid, true);
        for (const sid of userSockets.get(uid) ?? []) io.to(sid).emit('quick:status', { searching: false, since: null, offerBot: false });
      }
      setTimeout(async () => {
        const err = await room.start(null);
        if (err) io.to(`room:${room.code}`).emit('error', { message: err });
      }, 2500);
      return;
    }
    const since = Date.now();
    list.push({ uid: user.uid, name: user.name, isGuest: user.isGuest, since, avatar: user.avatar, frame: user.frame });
    quickQueue.set(key, list);
    socket.emit('quick:status', { searching: true, since, offerBot: false });
    setTimeout(() => {
      if ((quickQueue.get(key) ?? []).some((e) => e.uid === user.uid && e.since === since)) {
        for (const sid of userSockets.get(user.uid) ?? []) io.to(sid).emit('quick:status', { searching: true, since, offerBot: true });
      }
    }, RULES.QUICK_MATCH_BOT_OFFER_MS);
  });

  socket.on('quick:leave', () => {
    leaveQuick(user.uid);
    socket.emit('quick:status', { searching: false, since: null, offerBot: false });
  });

  socket.on('bot:start', async ({ mode }) => {
    leaveQuick(user.uid);
    socket.emit('quick:status', { searching: false, since: null, offerBot: false });
    const room = createRoom(user.grade, mode === 'WORKS' ? 'WORKS' : 'CLASSIC', user.uid);
    room.vsBot = true;
    const err = enterRoom(room, user);
    if (err) {
      room.destroy();
      return fail(err);
    }
    room.addPlayer({ uid: `bot:${room.code}`, name: 'Бот Перко', isGuest: false, isBot: true });
    room.setReady(user.uid, true);
    const startErr = await room.start(null);
    if (startErr) {
      fail(startErr);
      room.dropPlayer(user.uid, 'leave');
    }
  });

  socket.on('game:answer', ({ questionId, index, text }) => myRoom()?.answer(user.uid, String(questionId), { index, text }));
  socket.on('game:pick', ({ regionId }) => myRoom()?.pick(user.uid, String(regionId)));
  socket.on('game:attack', ({ regionId }) => myRoom()?.attack(user.uid, String(regionId)));
  socket.on('game:joker', ({ kind }) => myRoom()?.useJoker(user.uid, kind === 'time' ? 'time' : 'fifty'));
  socket.on('chat:send', ({ key }) => {
    if (CHAT_MESSAGES.some((m) => m.key === key)) myRoom()?.chat(user.uid, key);
  });

  socket.on('invite:send', async ({ toUid, code }) => {
    const room = rooms.get(String(code));
    if (!room || room.phase !== 'lobby' || !room.players.has(user.uid)) return fail('Поканата не може да се изпрати.');
    if (!(await areFriends(user.uid, String(toUid)))) return fail('Можеш да каниш само приятели.');
    const invite = await prisma.gameInvite.create({
      data: { fromId: user.uid, toId: String(toUid), lobbyCode: room.code, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    for (const sid of userSockets.get(String(toUid)) ?? []) {
      io.to(sid).emit('invite', { id: invite.id, fromUid: user.uid, fromName: user.name, code: room.code, mode: room.mode });
    }
  });

  socket.on('rematch:request', () => {
    const room = myRoom();
    if (!room || room.phase !== 'finished') return;
    if (room.rematchCode && rooms.has(room.rematchCode)) {
      const r = rooms.get(room.rematchCode)!;
      const err = enterRoom(r, user);
      if (err) fail(err);
      return;
    }
    if (room.vsBot) {
      // реванш срещу бота — веднага нова игра
      const r = createRoom(user.grade, room.mode, user.uid);
      r.vsBot = true;
      room.rematchCode = r.code;
      enterRoom(r, user);
      r.addPlayer({ uid: `bot:${r.code}`, name: 'Бот Перко', isGuest: false, isBot: true });
      r.setReady(user.uid, true);
      void r.start(null).then((e) => e && fail(e));
      return;
    }
    const r = createRoom(user.grade, room.mode, user.uid);
    room.rematchCode = r.code;
    const err = enterRoom(r, user);
    if (err) return fail(err);
    hooks.broadcast(room);
  });

  socket.on('presence:query', ({ uids }) => {
    if (Array.isArray(uids)) emitOnline(socket, uids.slice(0, 200).map(String));
  });

  socket.on('disconnect', () => {
    const s = userSockets.get(user.uid);
    s?.delete(socket.id);
    if (s && s.size === 0) {
      userSockets.delete(user.uid);
      leaveQuick(user.uid);
    }
    const room = myRoom();
    room?.detachSocket(user.uid, socket.id);
  });
  // чакащи покани от последните 10 минути — след като всички команди вече се слушат
  void (async () => {
    try {
      const invites = await prisma.gameInvite.findMany({
        where: { toId: user.uid, expiresAt: { gt: new Date() } },
        include: { from: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      for (const inv of invites) {
        const room = rooms.get(inv.lobbyCode);
        if (room && room.phase === 'lobby' && !room.players.has(user.uid)) {
          socket.emit('invite', { id: inv.id, fromUid: inv.fromId, fromName: inv.from.displayName, code: inv.lobbyCode, mode: room.mode });
        }
      }
    } catch (e) {
      console.error('[invites]', e);
    }
  })();
});

httpServer.listen(PORT, () => {
  console.log(`[game] БЕЛ Мастер игрови сървър на порт ${PORT} (CORS: ${ORIGINS.join(', ')})`);
});

process.on('unhandledRejection', (e) => console.error('[game] unhandled', e));

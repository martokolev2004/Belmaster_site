import { addLeagueXp, prisma, recordAnswers, syncAchievements, type Grade } from '@belmaster/db';
import { XP_MATCH_PLAY, XP_MATCH_WIN, currentSeason, nextLevel, sofiaDay } from '@belmaster/shared';
import { eloDeltas } from './elo.js';
import type { Room } from './room.js';

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function awardXp(userId: string, xp: number, codes: string[]) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const today = sofiaDay();
  let streak = user.streak;
  if (user.lastActiveDay !== today) streak = user.lastActiveDay === previousDay(today) ? user.streak + 1 : 1;
  const newXp = user.xp + xp;
  const level = nextLevel(user.level, newXp);
  await prisma.user.update({
    where: { id: userId },
    data: { xp: newXp, level, streak, bestStreak: Math.max(user.bestStreak, streak), lastActiveDay: today },
  });
  // броячите (победи, игри, нива…) се проверяват сами; codes са специални събития
  await addLeagueXp(prisma, userId, xp).catch((e) => console.error('[league]', e));
  await syncAchievements(prisma, userId, codes);
}

/** Записва битката, рейтинга, XP и постиженията. */
export async function persistMatch(room: Room) {
  const standings = room.standings;
  if (!standings) return;
  const grade = room.grade as Grade;
  const humans = standings.filter((s) => !s.isBot);
  const registered = humans.filter((s) => !room.players.get(s.uid)?.isGuest);
  const rated = !room.vsBot && registered.length >= 2;

  // рейтинг — за всички времена и за текущия сезон
  const deltas = new Map<string, number>();
  if (rated) {
    const season = currentSeason();
    for (const s of [season, 'all']) {
      const rows = await Promise.all(
        registered.map((p) =>
          prisma.playerRating.upsert({
            where: { userId_grade_season: { userId: p.uid, grade, season: s } },
            update: {},
            create: { userId: p.uid, grade, season: s },
          }),
        ),
      );
      const d = eloDeltas(registered.map((p, i) => ({ uid: p.uid, rating: rows[i].rating, place: p.place })));
      for (const p of registered) {
        const delta = d.get(p.uid) ?? 0;
        if (s === season) deltas.set(p.uid, delta);
        await prisma.playerRating.update({
          where: { userId_grade_season: { userId: p.uid, grade, season: s } },
          data: { rating: { increment: delta }, games: { increment: 1 }, wins: { increment: p.place === 1 ? 1 : 0 } },
        });
      }
    }
  }
  for (const s of standings) s.ratingDelta = deltas.get(s.uid) ?? null;

  const match = await prisma.match.create({
    data: {
      grade,
      mode: room.mode,
      mapId: room.map?.id ?? 'unknown',
      rated,
      vsBot: room.vsBot,
      rounds: Math.min(room.round, 12),
      winnerUid: standings[0]?.isBot ? null : standings[0]?.uid ?? null,
      review: room.review as object[],
      startedAt: new Date(room.startedAt || Date.now()),
      players: {
        create: standings.map((s) => {
          const p = room.players.get(s.uid);
          return {
            userId: s.isBot ? null : s.uid,
            name: s.name,
            color: s.color,
            place: s.place,
            territories: s.territories,
            correct: s.correct,
            answered: s.answered,
            ratingDelta: s.ratingDelta,
            isBot: s.isBot,
            isGuest: !!p?.isGuest,
          };
        }),
      },
    },
  });
  room.matchId = match.id;

  // грешки и статистика по теми — от въпросите, на които играчът е отговарял
  for (const s of humans) {
    const items = room.review.flatMap((r) =>
      r.results.filter((x) => x.uid === s.uid).map((x) => ({ questionId: r.questionId, score: x.score, correct: x.correct })),
    );
    await recordAnswers(prisma, s.uid, items).catch((e) => console.error('[persist] answers', e));
  }

  for (const s of humans) {
    const p = room.players.get(s.uid);
    const codes = ['first_battle'];
    if (s.place === 1 && humans.length + (room.vsBot ? 1 : 0) >= 2) codes.push('first_win');
    if (p?.capturedCapital) codes.push('capital_taker');
    if (s.place === 1 && standings.length >= 4) codes.push('battle_4p_win');
    if (s.answered >= 8 && s.correct === s.answered) codes.push('battle_flawless');
    if (room.review.some((r) => r.results.some((x) => x.uid === s.uid && x.correct && x.timeMs != null && x.timeMs < 3000))) codes.push('lightning');
    const xp = XP_MATCH_PLAY + (s.place === 1 ? XP_MATCH_WIN : 0) + s.correct * 10;
    await awardXp(s.uid, xp, codes).catch((e) => console.error('[persist] xp', e));
  }
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: { status: 'ACCEPTED', OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
  });
  return !!f;
}

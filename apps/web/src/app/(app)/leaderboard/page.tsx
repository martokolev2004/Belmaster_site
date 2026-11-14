import type { CSSProperties } from 'react';
import Link from 'next/link';
import { currentSeason, frameForRating, gradeLabel, LEAGUE_MOVE, LEAGUE_TIERS, leagueWeek, leagueWeekEnd, seasonLabel, type FrameTier } from '@belmaster/shared';
import { ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { publicUserWhere } from '@/lib/age';
import { ReportUserButton } from '@/components/report/ReportUserButton';
import { Avatar } from '@/components/ui';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { AddFriendForm, CopyCode, FriendList } from '../friends/FriendForms';
import { respondFriendAction } from '../friends/actions';
import './leaderboard.css';

export const metadata = { title: 'Класация' };
export const dynamic = 'force-dynamic';

type Tab = 'rating' | 'climb' | 'tower' | 'xp';
interface Row {
  id: string;
  name: string;
  avatar: unknown;
  frame?: FrameTier;
  num: number;
  value: string;
  sub?: string;
}
const TABS: { t: Tab; label: string; icon: string; unit: string; play: string; cta: string }[] = [
  { t: 'xp', label: 'Опит', icon: '⭐', unit: 'XP', play: '/tests', cta: 'Реши тест' },
  { t: 'rating', label: 'Битки', icon: '⚔️', unit: 'рейтинг', play: '/play', cta: 'Изиграй битка' },
  { t: 'climb', label: 'Към върха', icon: '⛰️', unit: 'рейтинг', play: '/climb', cta: 'Изкачи върха' },
  { t: 'tower', label: 'Кула', icon: '🏗️', unit: 'етажа', play: '/tower', cta: 'Построй кула' },
];
const MEDAL = ['#ffc93c', '#c3cae6', '#e0915a'];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string; season?: string; who?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'rating' ? 'rating' : sp.tab === 'climb' ? 'climb' : sp.tab === 'tower' ? 'tower' : 'xp';
  const season = sp.season === 'all' ? 'all' : currentSeason();
  const friendsOnly = sp.who === 'friends';
  const grade = user.grade!;
  const now = currentSeason();

  // приятели и покани
  const ships = await prisma.friendship.findMany({ where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] }, include: { requester: true, addressee: true }, orderBy: { createdAt: 'desc' } });
  const friendUsers = ships.filter((f) => f.status === 'ACCEPTED').map((f) => (f.requesterId === user.id ? f.addressee : f.requester));
  const friends = friendUsers.map((u) => ({ id: u.id, name: u.displayName, color: u.avatarColor, avatar: u.avatar, grade: gradeLabel(u.grade), sameGrade: u.grade === user.grade }));
  const incoming = ships.filter((f) => f.status === 'PENDING' && f.addresseeId === user.id);
  const outgoing = ships.filter((f) => f.status === 'PENDING' && f.requesterId === user.id);
  const circle = [user.id, ...friendUsers.map((u) => u.id)];
  const only = friendsOnly ? { userId: { in: circle } } : {};

  let rows: Row[] = [];
  if (tab === 'rating') {
    const list = await prisma.playerRating.findMany({ where: { grade, season, games: { gt: 0 }, user: publicUserWhere(), ...only }, orderBy: [{ rating: 'desc' }, { wins: 'desc' }], take: 50, include: { user: true } });
    rows = list.map((r, i) => ({ id: r.userId, name: r.user.displayName, avatar: r.user.avatar, frame: frameForRating(r.rating, season === 'all' && i < 10), num: r.rating, value: String(r.rating), sub: `${r.wins} победи · ${r.games} битки` }));
  } else if (tab === 'climb') {
    const list = await prisma.climbRating.findMany({ where: { grade, season, games: { gt: 0 }, user: publicUserWhere(), ...only }, orderBy: [{ rating: 'desc' }, { wins: 'desc' }], take: 50, include: { user: true } });
    rows = list.map((r) => ({ id: r.userId, name: r.user.displayName, avatar: r.user.avatar, num: r.rating, value: String(r.rating), sub: `${r.wins} победи · ${r.games} игри` }));
  } else if (tab === 'tower') {
    const list = await prisma.towerBest.findMany({ where: { grade, season, best: { gt: 0 }, user: { isGuest: false, ...publicUserWhere() }, ...only }, orderBy: [{ best: 'desc' }, { updatedAt: 'asc' }], take: 50, include: { user: true } });
    rows = list.map((r) => ({ id: r.userId, name: r.user.displayName, avatar: r.user.avatar, num: r.best, value: `${r.best} ет.`, sub: 'най-висока кула' }));
  } else {
    const list = await prisma.user.findMany({ where: { grade, isGuest: false, xp: { gt: 0 }, ...publicUserWhere(), ...(friendsOnly ? { id: { in: circle } } : {}) }, orderBy: { xp: 'desc' }, take: 50 });
    rows = list.map((u) => ({ id: u.id, name: u.displayName, avatar: u.avatar, num: u.xp, value: `${u.xp.toLocaleString('bg-BG')} XP`, sub: `Ниво ${u.level}` }));
  }

  // „Ти“: мястото ми във всяка класация този месец (сред всички от класа)
  const [myBattle, myClimb, myTower] = await Promise.all([
    prisma.playerRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade, season: now } } }),
    prisma.climbRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade, season: now } } }),
    prisma.towerBest.findUnique({ where: { userId_grade_season: { userId: user.id, grade, season: now } } }),
  ]);
  const pub = publicUserWhere();
  const [aheadBattle, aheadClimb, aheadTower, aheadXp] = await Promise.all([
    myBattle?.games ? prisma.playerRating.count({ where: { grade, season: now, games: { gt: 0 }, rating: { gt: myBattle.rating }, user: pub } }) : null,
    myClimb?.games ? prisma.climbRating.count({ where: { grade, season: now, games: { gt: 0 }, rating: { gt: myClimb.rating }, user: pub } }) : null,
    myTower?.best ? prisma.towerBest.count({ where: { grade, season: now, best: { gt: myTower.best }, user: { isGuest: false, ...pub } } }) : null,
    user.xp > 0 && !user.isGuest ? prisma.user.count({ where: { grade, isGuest: false, xp: { gt: user.xp }, ...pub } }) : null,
  ]);
  const mine: Record<Tab, { place: number | null; value: string }> = {
    rating: { place: aheadBattle == null ? null : aheadBattle + 1, value: myBattle?.games ? String(myBattle.rating) : '—' },
    climb: { place: aheadClimb == null ? null : aheadClimb + 1, value: myClimb?.games ? String(myClimb.rating) : '—' },
    tower: { place: aheadTower == null ? null : aheadTower + 1, value: myTower?.best ? `${myTower.best} ет.` : '—' },
    xp: { place: aheadXp == null ? null : aheadXp + 1, value: user.xp ? `${user.xp.toLocaleString('bg-BG')}` : '—' },
  };

  // седмичната лига
  const week = leagueWeek();
  const lm = user.isGuest ? null : await prisma.leagueMember.findUnique({ where: { userId_week: { userId: user.id, week } } });
  const group = lm ? await prisma.leagueMember.findMany({ where: { group: lm.group }, orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }], select: { userId: true, xp: true } }) : [];
  const lPlace = lm ? group.findIndex((g) => g.userId === user.id) + 1 : 0;
  const tier = LEAGUE_TIERS[lm?.tier ?? 0];
  const days = Math.max(0, Math.ceil((leagueWeekEnd(week).getTime() - Date.now()) / 86_400_000));
  const needXp = lm && lPlace > LEAGUE_MOVE && group[LEAGUE_MOVE - 1] ? group[LEAGUE_MOVE - 1].xp - lm.xp + 1 : 0;

  const meta = TABS.find((x) => x.t === tab)!;
  const href = (o: { tab?: Tab; season?: string | null; who?: string | null }) => {
    const q = new URLSearchParams();
    const t = o.tab ?? tab, s = o.season === undefined ? sp.season : o.season, w = o.who === undefined ? sp.who : o.who;
    if (t !== 'xp') q.set('tab', t);
    if (s) q.set('season', s);
    if (w) q.set('who', w);
    const str = q.toString();
    return `/leaderboard${str ? `?${str}` : ''}`;
  };
  const myIdx = rows.findIndex((r) => r.id === user.id);
  const gap = myIdx > 0 ? rows[myIdx - 1].num - rows[myIdx].num + 1 : 0;
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="lbx">
      <header className="nx-head animate-rise">
        <p className="ln-eyebrow">{gradeLabel(grade)}</p>
        <h1 className="ln-display nx-h1">
          Класа<span className="ln-grad">ция</span>
        </h1>
      </header>

      <div className="lbx-grid">
        <div className="lbx-main">
          {/* ── ти ── */}
          <section className="nx-panel lbx-me animate-rise">
            <div className="lbx-me-who">
              <UserAvatar avatar={user.avatar} name={user.id} size={64} />
              <div className="min-w-0">
                <p className="ln-display truncate text-lg">{user.displayName}</p>
                <p className="text-sm font-bold text-muted">
                  {user.isGuest
                    ? 'Гостите не влизат в класацията.'
                    : myIdx === 0
                      ? `Първи си в „${meta.label}“ — дръж се!`
                      : gap > 0
                        ? `Още ${gap} ${meta.unit} и изпреварваш ${rows[myIdx - 1].name}.`
                        : mine[tab].place
                          ? `Място ${mine[tab].place} в „${meta.label}“ този месец.`
                          : `Още не си в „${meta.label}“.`}
                </p>
              </div>
              {user.isGuest ? (
                <Link href="/login?tab=register" className="ln-btn ln-btn-primary ln-btn-sm ml-auto shrink-0">
                  Направи профил
                </Link>
              ) : (
                !mine[tab].place && (
                  <Link href={meta.play} className="ln-btn ln-btn-primary ln-btn-sm ml-auto shrink-0">
                    {meta.cta}
                  </Link>
                )
              )}
            </div>
            <div className="lbx-me-stats">
              {TABS.map((x) => (
                <Link key={x.t} href={href({ tab: x.t })} data-on={x.t === tab}>
                  <span>
                    {x.icon} {x.label}
                  </span>
                  <b className="ln-display">{mine[x.t].place ? `#${mine[x.t].place}` : '—'}</b>
                  <small>{mine[x.t].place ? `${mine[x.t].value}${x.t === 'xp' ? ' XP' : x.t === 'tower' ? '' : ' т.'}` : 'още не играно'}</small>
                </Link>
              ))}
            </div>
          </section>

          {/* ── коя класация ── */}
          <div className="lbx-bar">
            <div className="lbx-seg">
              <Link href={href({ who: null })} data-on={!friendsOnly}>
                Всички
              </Link>
              <Link href={href({ who: 'friends' })} data-on={friendsOnly}>
                Приятели{friends.length ? ` · ${friends.length}` : ''}
              </Link>
            </div>
            {tab !== 'xp' && (
              <div className="lbx-seg">
                <Link href={href({ season: null })} data-on={season !== 'all'}>
                  {seasonLabel(now)}
                </Link>
                <Link href={href({ season: 'all' })} data-on={season === 'all'}>
                  {seasonLabel('all')}
                </Link>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <section className="nx-panel lbx-empty">
              <span>{meta.icon}</span>
              <p className="ln-display">{friendsOnly ? 'Още никой от вас не е тук' : 'Мястото е свободно'}</p>
              <p>{friendsOnly ? (friends.length ? `Никой от приятелите ти още не е играл „${meta.label}“ този месец. Бъди първият.` : 'Добави приятели с код и се сравнявайте тук.') : `Никой още не е в класацията „${meta.label}“ — първото място те чака.`}</p>
              <Link href={meta.play} className="ln-btn ln-btn-primary">
                {meta.cta}
              </Link>
            </section>
          ) : (
            <>
              {/* ── подиум ── */}
              <section className="lbx-podium">
                {[1, 0, 2].map((i) => {
                  const r = podium[i];
                  if (!r) return <div key={i} className="lbx-step" data-n={i + 1} data-empty />;
                  return (
                    <div key={r.id} className="lbx-step" data-n={i + 1} data-me={r.id === user.id} style={{ '--m': MEDAL[i] } as CSSProperties}>
                      {i === 0 && <span className="lbx-crown">👑</span>}
                      <div className="lbx-ava">
                        <Avatar name={r.name} avatar={r.avatar} seed={r.id} frame={r.frame} size={i === 0 ? 84 : 64} />
                      </div>
                      <p className="lbx-name">{r.name}</p>
                      <p className="lbx-val ln-display">{r.value}</p>
                      <div className="lbx-block">
                        <b className="ln-display">{i + 1}</b>
                      </div>
                    </div>
                  );
                })}
              </section>

              {rest.length > 0 && (
                <ol className="nx-panel lbx-list">
                  {rest.map((r, i) => (
                    <li key={r.id} data-me={r.id === user.id}>
                      <span className="lbx-no">{i + 4}</span>
                      <Avatar name={r.name} avatar={r.avatar} seed={r.id} frame={r.frame} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold text-white">{r.name}</span>
                        {r.sub && <span className="block text-xs text-muted">{r.sub}</span>}
                      </span>
                      <span className="ln-display text-sm text-white">{r.value}</span>
                      {!user.isGuest && r.id !== user.id && <ReportUserButton userId={r.id} name={r.name} />}
                    </li>
                  ))}
                </ol>
              )}
              {myIdx < 0 && mine[tab].place && !friendsOnly && season !== 'all' && (
                <p className="lbx-far">
                  Ти си на място <b>{mine[tab].place}</b> с {mine[tab].value}
                  {tab === 'xp' ? ' XP' : ''} — показват се първите 50.
                </p>
              )}
            </>
          )}
        </div>

        <aside className="lbx-side">
          {/* ── седмична лига ── */}
          <Link href="/league" className="nx-panel lbx-league" style={{ '--c': tier.color === '#111827' ? '#8b93b8' : tier.color } as CSSProperties}>
            <span className="lbx-league-ic">{tier.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="ln-eyebrow">Седмична лига</span>
              <span className="ln-display mt-1 block text-lg">{lm ? `${tier.name} · #${lPlace}` : 'Влез в лигата'}</span>
              <span className="mt-1 block text-sm font-semibold text-muted">
                {user.isGuest
                  ? 'Само за ученици с профил.'
                  : !lm
                    ? 'С първия XP тази седмица влизаш в група.'
                    : lPlace <= LEAGUE_MOVE
                      ? `В зоната за качване си · ${lm.xp} XP`
                      : `Още ${needXp} XP до зоната за качване`}
                {lm && ` · ${days > 1 ? `остават ${days} дни` : 'последен ден'}`}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" />
          </Link>

          {/* ── приятели ── */}
          <section id="friends" className="nx-panel lbx-friends">
            <h2 className="ln-display">Приятели{friends.length ? ` · ${friends.length}` : ''}</h2>
            <p className="lbx-hint">Твоят код — дай го на приятел:</p>
            <CopyCode code={user.friendCode} />
            <div className="mt-3">
              <AddFriendForm />
            </div>

            {incoming.length > 0 && (
              <>
                <h3>Покани за приятелство</h3>
                <ul className="space-y-2">
                  {incoming.map((f) => (
                    <li key={f.id} className="lbx-req">
                      <Avatar name={f.requester.displayName} avatar={f.requester.avatar} seed={f.requester.id} size={36} />
                      <span className="min-w-0 flex-1 truncate font-extrabold">{f.requester.displayName}</span>
                      <ReportUserButton userId={f.requester.id} name={f.requester.displayName} />
                      <form action={respondFriendAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <button className="lbx-yes">Приеми</button>
                      </form>
                      <form action={respondFriendAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <button className="lbx-no-btn" aria-label="Откажи">✕</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {friends.length > 0 ? (
              <div className="mt-4">
                <FriendList friends={friends} />
              </div>
            ) : (
              <p className="lbx-none">Още нямаш приятели. Изпрати кода си на съученик — после се сравнявате в „Приятели“ и се каните на игра.</p>
            )}

            {outgoing.length > 0 && (
              <>
                <h3>Изпратени покани</h3>
                <ul className="space-y-1.5">
                  {outgoing.map((f) => (
                    <li key={f.id} className="lbx-req">
                      <Avatar name={f.addressee.displayName} avatar={f.addressee.avatar} seed={f.addressee.id} size={30} />
                      <span className="min-w-0 flex-1 truncate font-bold">{f.addressee.displayName}</span>
                      <form action={respondFriendAction}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="decision" value="cancel" />
                        <button className="text-xs font-extrabold text-muted hover:text-error">Откажи</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

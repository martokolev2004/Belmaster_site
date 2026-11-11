import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, currentSeason, gradeLabel, levelProgress, type AchievementCategory, type AchievementIcon } from '@belmaster/shared';
import { achievementMetrics } from '@belmaster/db';
import { Award, BookOpen, Brain, Castle, CheckCircle2, ChevronRight, Crown, Flame, Gem, GraduationCap, KeyRound, LogOut, Medal, Mountain, Pencil, Rocket, School, ScrollText, Shield, ShieldCheck, Star, Swords, Target, Trophy, UserRound, Users, Zap } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { diamondsOf } from '@/lib/avatar';
import { newItemKeys } from '@/lib/unlocks';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { logoutAction } from '@/app/(auth)/actions';
import { needsParent } from '@/lib/age';
import { PasswordForm, ProfileForm } from './ProfileForms';
import { PrivacyCard } from './PrivacyCard';

export const metadata = { title: 'Профил' };

const ICONS: Record<AchievementIcon, typeof Star> = { star: Star, flame: Flame, award: Award, swords: Swords, crown: Crown, castle: Castle, book: BookOpen, users: Users, target: Target, shield: Shield, mountain: Mountain, trophy: Trophy, brain: Brain, graduation: GraduationCap, zap: Zap, medal: Medal, scroll: ScrollText, check: CheckCircle2, gem: Gem, rocket: Rocket };

export default async function ProfilePage() {
  const user = await requireUser();
  const [achievements, attempts, rating, matches, metrics] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId: user.id }, orderBy: { unlockedAt: 'desc' } }),
    prisma.quizAttempt.aggregate({ where: { userId: user.id }, _count: true, _sum: { score: true, total: true } }),
    prisma.playerRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade: user.grade!, season: currentSeason() } } }),
    prisma.matchPlayer.findMany({ where: { userId: user.id }, include: { match: true }, orderBy: { match: { endedAt: 'desc' } }, take: 5 }),
    achievementMetrics(prisma, user.id),
  ]);
  const unlocked = new Set(achievements.map((a) => a.code));
  const lp = levelProgress(user.xp, user.level);
  const fresh = newItemKeys(user);
  const accuracy = attempts._sum.total ? Math.round(((attempts._sum.score ?? 0) / attempts._sum.total) * 100) : 0;
  const pct = Math.round((lp.inLevel / lp.needed) * 100);
  const wins = matches.filter((m) => m.place === 1).length;

  const stats = [
    { icon: '🔥', v: user.streak, l: 'дни серия', s: `рекорд ${user.bestStreak}`, c: '#ff9d3c' },
    { icon: '⭐', v: user.xp.toLocaleString('bg-BG'), l: 'общо XP', s: `ниво ${lp.level}`, c: '#ffd166' },
    { icon: '💎', v: diamondsOf(user), l: 'диаманта', s: 'за аватара', c: '#5fd0ff' },
    { icon: '📝', v: attempts._count, l: 'теста', s: `${accuracy}% точност`, c: '#6ea2ff' },
    { icon: '⚔️', v: rating ? rating.rating : '—', l: 'рейтинг', s: rating ? `${rating.wins}/${rating.games} победи` : 'този месец', c: '#ff7a8a' },
    { icon: '🏅', v: `${unlocked.size}/${ACHIEVEMENTS.length}`, l: 'постижения', s: 'отключени', c: '#c59bff' },
  ];

  return (
    <div className="pf">
      {/* ── кой съм ── */}
      <section className="nx-panel pf-hero animate-rise">
        <Link href="/profile/avatar" className="nx-avatar pf-avatar" title="Промени аватара">
          <UserAvatar avatar={user.avatar} name={user.id} size={132} />
          <span className="pf-edit">
            <Pencil className="size-4" />
          </span>
          {fresh.length > 0 && <span className="absolute -right-1 -top-1 size-4 rounded-full bg-error" />}
        </Link>
        <div className="min-w-0">
          <p className="ln-eyebrow">{user.isGuest ? 'Гост' : gradeLabel(user.grade)}</p>
          <h1 className="ln-display pf-name">{user.displayName}</h1>
          {!user.isGuest && <p className="mt-1 truncate text-sm font-semibold text-muted">{user.email}</p>}
          <div className="pf-actions">
            <Link href="/profile/avatar" className="nx-chip pf-main">
              {fresh.length > 0 ? `🎁 ${fresh.length} нови неща за аватара` : 'Промени аватара'}
            </Link>
            <Link href="/grade?next=/profile" className="nx-chip">Смени клас</Link>
            <Link href="/friends" className="nx-chip">
              Код за приятели: <b className="font-mono tracking-widest text-white">{user.friendCode}</b>
            </Link>
          </div>
        </div>
        <div className="pf-level">
          <div className="pf-ring" style={{ '--p': pct } as CSSProperties}>
            <div>
              <small>ниво</small>
              <b className="ln-display">{lp.level}</b>
            </div>
          </div>
          <p>
            <b>{lp.inLevel}</b> / {lp.needed} XP
          </p>
          <small>още {lp.needed - lp.inLevel} XP до ниво {lp.level + 1}</small>
        </div>
      </section>

      {user.isGuest && (
        <Link href="/login?tab=register" className="nx-panel nx-feature" style={{ '--c': '#ffd166' } as CSSProperties}>
          <span className="nx-emoji">👤</span>
          <span>
            <span className="ln-display nx-tile-t block">Играеш като гост</span>
            <span className="mt-1 block text-sm font-semibold text-muted">Направи профил, за да запазиш прогреса си и да влезеш в класациите.</span>
          </span>
          <ChevronRight className="nx-tile-go size-5" />
        </Link>
      )}

      {/* ── числа ── */}
      <section className="pf-stats">
        {stats.map((s) => (
          <div key={s.l} className="nx-panel pf-stat" style={{ '--c': s.c } as CSSProperties}>
            <span className="pf-stat-ic">{s.icon}</span>
            <b className="ln-display">{s.v}</b>
            <span>{s.l}</span>
            <small>{s.s}</small>
          </div>
        ))}
      </section>

      {/* ── постижения + битки ── */}
      <section className="pf-two">
        <div className="nx-panel pf-box">
          <header>
            <h2 className="ln-display">Постижения</h2>
            <a href="#all" className="pf-more">Виж всички →</a>
          </header>
          <div className="nx-bar mb-4">
            <i style={{ width: `${(unlocked.size / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
          {unlocked.size === 0 ? (
            <p className="text-sm font-semibold text-muted">Още няма отключени. Реши тест или изиграй игра и първото ще дойде.</p>
          ) : (
            <ul className="pf-badges">
              {achievements.slice(0, 6).map((ua) => {
                const a = ACHIEVEMENTS.find((x) => x.code === ua.code);
                if (!a) return null;
                const Icon = ICONS[a.icon];
                return (
                  <li key={a.code} title={a.description}>
                    <span className="pf-badge"><Icon className="size-5" /></span>
                    <span>{a.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="nx-panel pf-box">
          <header>
            <h2 className="ln-display">Последни игри</h2>
            <span className="pf-more">{wins} победи от {matches.length}</span>
          </header>
          {matches.length === 0 ? (
            <p className="text-sm font-semibold text-muted">Още няма изиграни игри.</p>
          ) : (
            <ul className="pf-matches">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/match/${m.matchId}`}>
                    <span className={m.place === 1 ? 'pf-win' : 'pf-loss'}>{m.place === 1 ? 'Победа' : `${m.place}. място`}</span>
                    <span className="flex-1 truncate">
                      {m.match.mode === 'CLIMB' ? `Към върха · стъпало ${m.territories}` : `Битка · ${m.territories} области`} · {m.correct}/{m.answered} верни
                    </span>
                    <small>{m.match.endedAt.toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'short' })}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── бързи връзки ── */}
      <section className="nx-tiles" style={{ marginTop: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <QuickLink href="/stats" icon={<Target className="size-5" />} c="#5fe0d0" title="Статистика" text="Силни и слаби теми" />
        <QuickLink href="/class" icon={<School className="size-5" />} c="#6ea2ff" title="Моят клас" text="Задачи от учителя" />
        <QuickLink href="/teacher" icon={<GraduationCap className="size-5" />} c="#c59bff" title={user.teacherStatus === 'APPROVED' ? 'Учител' : 'Аз съм учител'} text="Класове и тестове" />
      </section>

      {/* ── всички постижения ── */}
      <section id="all" className="nx-panel pf-box">
        <header>
          <h2 className="ln-display">Всички постижения</h2>
          <span className="pf-more">{unlocked.size} от {ACHIEVEMENTS.length}</span>
        </header>
        {(Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]).map((cat) => (
          <div key={cat} className="mt-4">
            <h3 className="pf-cat">{ACHIEVEMENT_CATEGORIES[cat]}</h3>
            <div className="pf-ach">
              {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                const Icon = ICONS[a.icon];
                const on = unlocked.has(a.code);
                const cur = a.metric ? Math.min(metrics[a.metric], a.goal ?? 0) : 0;
                return (
                  <div key={a.code} data-on={on}>
                    <span className="pf-badge"><Icon className="size-5" /></span>
                    <span className="min-w-0">
                      <b>{a.name}</b>
                      <small>{a.description}</small>
                      {!on && a.metric && a.goal && a.goal > 1 && (
                        <span className="pf-prog">
                          <span className="nx-bar"><i style={{ width: `${(cur / a.goal) * 100}%` }} /></span>
                          {cur}/{a.goal}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── настройки ── */}
      <section className="pf-settings">
        <h2 className="ln-display">Настройки</h2>
        <div className="pf-two">
          <div className="nx-panel pf-box">
            <header>
              <h3 className="pf-set-t"><UserRound className="size-5" /> Име в сайта</h3>
            </header>
            <ProfileForm displayName={user.displayName} avatarColor={user.avatarColor} />
          </div>
          {!user.isGuest && (
            <div className="nx-panel pf-box">
              <header>
                <h3 className="pf-set-t"><KeyRound className="size-5" /> {user.passwordHash ? 'Смяна на паролата' : 'Задай парола'}</h3>
              </header>
              <PasswordForm hasPassword={!!user.passwordHash} />
            </div>
          )}
        </div>
        {!user.isGuest && (
          <div className="nx-panel pf-box">
            <header>
              <h3 className="pf-set-t"><ShieldCheck className="size-5" /> Поверителност и сигурност</h3>
            </header>
            <div className="pf-privacy">
              <PrivacyCard email={user.email} verified={!!user.emailVerifiedAt} needsParent={needsParent(user)} parentEmail={user.parentEmail} hasPassword={!!user.passwordHash} />
            </div>
          </div>
        )}
        <form action={logoutAction}>
          <button className="pf-logout"><LogOut className="size-5" /> Изход</button>
        </form>
      </section>
    </div>
  );
}

function QuickLink({ href, icon, c, title, text }: { href: string; icon: React.ReactNode; c: string; title: string; text: string }) {
  return (
    <Link href={href} className="nx-panel nx-tile" style={{ '--c': c } as CSSProperties}>
      <span className="nx-tile-ic">{icon}</span>
      <span className="min-w-0">
        <span className="ln-display nx-tile-t block">{title}</span>
        <p>{text}</p>
      </span>
      <ChevronRight className="nx-tile-go size-5" />
    </Link>
  );
}

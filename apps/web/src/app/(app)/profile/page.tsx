import Link from 'next/link';
import { cookies } from 'next/headers';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, currentSeason, gradeLabel, levelProgress, type AchievementCategory, type AchievementIcon } from '@belmaster/shared';
import { achievementMetrics } from '@belmaster/db';
import { Award, BookOpen, Brain, Castle, CheckCircle2, Crown, Flame, Gem, GraduationCap, LogOut, Medal, Mountain, Rocket, ScrollText, Shield, Star, Swords, Target, Trophy, Users, Zap } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { diamondsOf } from '@/lib/avatar';
import { newItemKeys } from '@/lib/unlocks';
import { Avatar, ButtonLink, Card, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { logoutAction } from '@/app/(auth)/actions';
import { PasswordForm, ProfileForm, ThemePicker } from './ProfileForms';

export const metadata = { title: 'Профил' };

const ICONS: Record<AchievementIcon, typeof Star> = { star: Star, flame: Flame, award: Award, swords: Swords, crown: Crown, castle: Castle, book: BookOpen, users: Users, target: Target, shield: Shield, mountain: Mountain, trophy: Trophy, brain: Brain, graduation: GraduationCap, zap: Zap, medal: Medal, scroll: ScrollText, check: CheckCircle2, gem: Gem, rocket: Rocket };

export default async function ProfilePage() {
  const user = await requireUser();
  const [achievements, attempts, rating, matches, metrics] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId: user.id } }),
    prisma.quizAttempt.aggregate({ where: { userId: user.id }, _count: true, _sum: { score: true, total: true } }),
    prisma.playerRating.findUnique({ where: { userId_grade_season: { userId: user.id, grade: user.grade!, season: currentSeason() } } }),
    prisma.matchPlayer.findMany({ where: { userId: user.id }, include: { match: true }, orderBy: { match: { endedAt: 'desc' } }, take: 10 }),
    achievementMetrics(prisma, user.id),
  ]);
  const unlocked = new Set(achievements.map((a) => a.code));
  const lp = levelProgress(user.xp, user.level);
  const fresh = newItemKeys(user);
  const diamonds = diamondsOf(user);
  const theme = (await cookies()).get('bm_theme')?.value;
  const accuracy = attempts._sum.total ? Math.round(((attempts._sum.score ?? 0) / attempts._sum.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex flex-wrap items-center gap-5">
        <Avatar name={user.displayName} avatar={user.avatar} seed={user.id} size={96} />
        <div className="flex-1">
          <h1 className="text-3xl font-black">{user.displayName}</h1>
          <p className="text-muted">
            {user.isGuest ? 'Гост' : user.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/grade?next=/profile" className="inline-flex items-center gap-1.5 rounded-xl bg-accent/20 px-3 py-1.5 text-sm font-extrabold text-ink-strong hover:bg-accent/30">
              🎓 {gradeLabel(user.grade)} · Смени клас
            </Link>
            <Link href="/profile/avatar" className="inline-flex items-center gap-1.5 rounded-xl bg-secondary/10 px-3 py-1.5 text-sm font-extrabold text-secondary hover:bg-secondary/20">
              ✏️ Промени аватара
            </Link>
            <Link href="/class" className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold text-ink hover:bg-line">
              🏫 Моят клас
            </Link>
            <Link href="/teacher" className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold text-ink hover:bg-line">
              🎓 {user.teacherStatus === 'APPROVED' ? 'Учител' : 'Аз съм учител'}
            </Link>
            {fresh.length > 0 && (
              <Link href="/profile/avatar?new=1" className="relative inline-flex items-center gap-1.5 rounded-xl bg-error/10 px-3 py-1.5 text-sm font-extrabold text-error hover:bg-error/20">
                <span className="size-2.5 rounded-full bg-error" /> Имаш {fresh.length} {fresh.length === 1 ? 'ново нещо' : 'нови неща'} — виж
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Код за приятели: <span className="font-mono font-black tracking-widest text-ink-strong">{user.friendCode}</span>
          </p>
        </div>
      </section>

      {user.isGuest && (
        <Card className="border-accent! bg-accent/10">
          <p className="font-extrabold text-ink-strong">Играеш като гост</p>
          <p className="mt-1 text-sm text-muted">Направи профил, за да запазиш прогреса си, да влезеш в класациите и да играеш с рейтинг.</p>
          <ButtonLink href="/login?tab=register" variant="accent" className="mt-3">
            Създай профил
          </ButtonLink>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Серия" value={`${user.streak} 🔥`} sub={`рекорд ${user.bestStreak}`} />
        <Stat label="Общо XP" value={String(user.xp)} sub={`ниво ${lp.level} · ${diamonds} 💎`} />
        <Stat label="Тестове" value={String(attempts._count)} sub={`${accuracy}% точност`} />
        <Stat label="Рейтинг" value={rating ? String(rating.rating) : '—'} sub={rating ? `${rating.wins}/${rating.games} победи` : 'този месец'} />
      </section>

      <Card>
        <div className="mb-2 flex justify-between text-sm font-extrabold">
          <span>Ниво {lp.level}</span>
          <span className="text-muted">
            {lp.inLevel}/{lp.needed} XP
          </span>
        </div>
        <ProgressBar value={(lp.inLevel / lp.needed) * 100} color="bg-accent" />
        <p className="mt-2 text-xs text-muted">
          Следващо ниво при {lp.nextAt} XP общо. На всеки 1000 XP получаваш 1 💎 — с диамантите купуваш специални части за аватара. XP не се харчи и нивото не пада.
        </p>
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-black">Профил</h2>
          <ProfileForm displayName={user.displayName} avatarColor={user.avatarColor} />
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-black">Тема</h2>
            <ThemePicker current={theme === 'light' || theme === 'system' ? theme : 'dark'} />
          </Card>
          {!user.isGuest && (
            <Card>
              <h2 className="mb-4 text-lg font-black">Парола</h2>
              <PasswordForm hasPassword={!!user.passwordHash} />
            </Card>
          )}
        </div>
      </section>

      <form action={logoutAction}>
        <button className="inline-flex items-center gap-2 font-extrabold uppercase text-error">
          <LogOut className="size-5" /> Изход
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-xl font-black">История на битките</h2>
        {matches.length === 0 ? (
          <p className="text-muted">Още няма изиграни битки.</p>
        ) : (
          <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/match/${m.matchId}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                  <span className="font-bold">
                    {m.match.mode === 'CLIMB' ? '⛰️ ' : ''}{m.place === 1 ? '🏆 Победа' : `${m.place}. място`} · {m.match.mode === 'CLIMB' ? `стъпало ${m.territories}` : `${m.territories} области`} · {m.correct}/{m.answered} верни
                  </span>
                  <span className="text-sm text-muted">{m.match.endedAt.toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia' })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-black">Постижения</h2>
        <p className="mb-3 text-sm text-muted">
          {unlocked.size} от {ACHIEVEMENTS.length} отключени
        </p>
        {(Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]).map((cat) => (
          <div key={cat} className="mb-5">
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">{ACHIEVEMENT_CATEGORIES[cat]}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                const Icon = ICONS[a.icon];
                const on = unlocked.has(a.code);
                const cur = a.metric ? Math.min(metrics[a.metric], a.goal ?? 0) : 0;
                return (
                  <div key={a.code} className={cn('card3d rounded-2xl bg-surface p-3 text-center', !on && 'opacity-60')}>
                    <span className={cn('mx-auto mb-1.5 flex size-11 items-center justify-center rounded-full', on ? 'bg-accent text-[#4b3b00]' : 'bg-surface-2 text-muted grayscale')}>
                      <Icon className="size-5" />
                    </span>
                    <p className="text-sm font-extrabold leading-tight text-ink-strong">{a.name}</p>
                    <p className="text-[11px] leading-tight text-muted">{a.description}</p>
                    {!on && a.metric && a.goal && a.goal > 1 && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-secondary" style={{ width: `${(cur / a.goal) * 100}%` }} />
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold text-muted">
                          {cur}/{a.goal}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card3d rounded-2xl bg-surface p-4">
      <p className="text-xs font-extrabold uppercase text-muted">{label}</p>
      <p className="text-2xl font-black text-ink-strong">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}

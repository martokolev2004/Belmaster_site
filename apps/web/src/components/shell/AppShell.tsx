import Link from 'next/link';
import type { User } from '@belmaster/db';
import { gradeLabel } from '@belmaster/shared';
import { Bell, Flame, Gem, Star } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui';
import { isAdmin } from '@/lib/auth';
import { diamondsOf } from '@/lib/avatar';
import { newItemKeys } from '@/lib/unlocks';
import { isTeacher } from '@/lib/teacher';
import { prisma } from '@/lib/db';
import { UnlockCelebration } from '@/components/unlocks/UnlockCelebration';
import { NavLinks, BottomNav } from './NavLinks';
import { GameSocketProvider } from '@/components/game/GameSocketProvider';
import { InviteToasts } from '@/components/game/InviteToasts';
import { needsParent } from '@/lib/age';

export async function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const admin = isAdmin(user);
  const hasNew = newItemKeys(user).length > 0;
  const diamonds = admin ? 9999 : diamondsOf(user);
  const teacher = isTeacher(user);
  const [unread, member] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.classMember.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  return (
    <GameSocketProvider>
      <div className="min-h-dvh md:pl-64">
        {/* Странично меню (компютър) */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-line bg-bg px-4 py-6 md:flex">
          <Link href="/" className="mb-8 px-3">
            <Logo />
          </Link>
          <NavLinks admin={admin} teacher={teacher} inClass={!!member} />
          <Link href="/profile" className="mt-auto flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface-2">
            <span className="relative">
              <Avatar name={user.displayName} avatar={user.avatar} seed={user.id} size={36} />
              {hasNew && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-bg bg-error" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-extrabold text-ink-strong">{user.displayName}</span>
              <span className="block text-xs text-muted">
                {user.isGuest ? 'Гост' : gradeLabel(user.grade)}
              </span>
            </span>
          </Link>
        </aside>

        {/* Горна лента */}
        <header className="sticky top-0 z-20 border-b-2 border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
            <Link href="/" className="md:hidden">
              <Logo compact />
            </Link>
            <Link href="/grade?next=/" title="Смени клас" className="hidden rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold text-muted hover:bg-line hover:text-ink md:inline">
              {gradeLabel(user.grade)} ▾
            </Link>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <span className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-orange" title="Серия от дни">
                <Flame className="size-5" fill="currentColor" /> {user.streak}
              </span>
              <span className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-accent-dark" title="Опит (XP)">
                <Star className="size-5" fill="currentColor" /> {user.xp}
              </span>
              <Link href="/notifications" className="relative rounded-xl p-1.5 text-muted hover:bg-surface-2" aria-label="Известия" title="Известия">
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-black text-white">{unread > 9 ? '9+' : unread}</span>
                )}
              </Link>
              <Link href="/profile/avatar" className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-secondary hover:bg-surface-2" title="Диаманти — за магазина на аватара">
                <Gem className="size-5" /> {diamonds}
              </Link>
              <Link href="/profile" className="relative md:hidden" aria-label="Профил">
                <Avatar name={user.displayName} avatar={user.avatar} seed={user.id} size={34} />
                {hasNew && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-bg bg-error" />}
              </Link>
            </div>
          </div>
        </header>

        {needsParent(user) ? (
          <Link href="/profile#privacy" className="block bg-accent/20 px-4 py-2 text-center text-sm font-bold text-ink-strong hover:bg-accent/30">
            👪 Чакаме родител да потвърди профила ти по имейл. Дотогава играеш само сам и срещу бот. →
          </Link>
        ) : (
          !user.isGuest &&
          user.email &&
          !user.emailVerifiedAt && (
            <Link href="/profile#privacy" className="block bg-secondary/10 px-4 py-2 text-center text-sm font-bold text-ink-strong hover:bg-secondary/20">
              ✉️ Потвърди имейла си — пратихме ти линк. Не е стигнал? →
            </Link>
          )
        )}
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:pb-12 has-[[data-wide]]:max-w-none has-[[data-wide]]:lg:px-8">
          {children}
          <footer className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted [main:has([data-wide])_&]:hidden">
            <Link href="/privacy" className="hover:underline">Поверителност</Link>
            <Link href="/terms" className="hover:underline">Общи условия</Link>
            <span>© БЕЛ Мастер</span>
          </footer>
        </main>
        <BottomNav />
        <InviteToasts />
        <UnlockCelebration avatar={user.avatar} seed={user.id} />
      </div>
    </GameSocketProvider>
  );
}

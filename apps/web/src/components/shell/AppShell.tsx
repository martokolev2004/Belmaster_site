import Link from 'next/link';
import type { User } from '@belmaster/db';
import { gradeLabel } from '@belmaster/shared';
import { Flame, Gem } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui';
import { isAdmin } from '@/lib/auth';
import { NavLinks, BottomNav } from './NavLinks';
import { GameSocketProvider } from '@/components/game/GameSocketProvider';
import { InviteToasts } from '@/components/game/InviteToasts';

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const admin = isAdmin(user);
  return (
    <GameSocketProvider>
      <div className="min-h-dvh md:pl-64">
        {/* Странично меню (компютър) */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-line bg-bg px-4 py-6 md:flex">
          <Link href="/" className="mb-8 px-3">
            <Logo />
          </Link>
          <NavLinks admin={admin} />
          <Link href="/profile" className="mt-auto flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface-2">
            <Avatar name={user.displayName} avatar={user.avatar} seed={user.id} size={36} />
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
            <span className="hidden rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-extrabold text-muted md:inline">
              {gradeLabel(user.grade)}
            </span>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <span className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-orange" title="Серия от дни">
                <Flame className="size-5" fill="currentColor" /> {user.streak}
              </span>
              <span className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-secondary" title="Опит (XP)">
                <Gem className="size-5" /> {user.xp}
              </span>
              <Link href="/profile" className="md:hidden" aria-label="Профил">
                <Avatar name={user.displayName} avatar={user.avatar} seed={user.id} size={34} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
        <BottomNav />
        <InviteToasts />
      </div>
    </GameSocketProvider>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Home, ListChecks, Shield, Swords, Trophy, User, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/', label: 'Начало', icon: Home },
  { href: '/tests', label: 'Тестове', icon: ListChecks },
  { href: '/play', label: 'Битка', icon: Swords },
  { href: '/library', label: 'Библиотека', icon: BookOpen },
  { href: '/leaderboard', label: 'Класация', icon: Trophy },
  { href: '/friends', label: 'Приятели', icon: Users },
  { href: '/profile', label: 'Профил', icon: User },
];

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export function NavLinks({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = admin ? [...ITEMS, { href: '/admin', label: 'Админ', icon: Shield }] : ITEMS;
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-4 rounded-2xl border-2 px-3 py-2.5 text-[15px] font-extrabold uppercase tracking-wide transition',
              active ? 'border-secondary/50 bg-secondary/10 text-secondary' : 'border-transparent text-muted hover:bg-surface-2',
            )}
          >
            <Icon className="size-6" strokeWidth={2.4} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const MOBILE = [ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[3], ITEMS[4], ITEMS[5]];

export function BottomNav() {
  const path = usePathname();
  if (/^\/play\/[A-Z0-9]+/i.test(path)) return null; // по време на игра — цял екран
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6">
        {MOBILE.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn('flex flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold', active ? 'text-secondary' : 'text-muted')}
            >
              <span className={cn('rounded-xl border-2 p-1.5', active ? 'border-secondary/50 bg-secondary/10' : 'border-transparent')}>
                <Icon className="size-6" strokeWidth={2.4} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Castle, GraduationCap, Mountain, Home, ListChecks, School, Shield, Swords, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/', label: 'Начало', icon: Home },
  { href: '/tests', label: 'Тестове', icon: ListChecks },
  { href: '/play', label: 'Битка', icon: Swords },
  { href: '/climb', label: 'Към върха', icon: Mountain },
  { href: '/tower', label: 'Кула', icon: Castle },
  { href: '/library', label: 'Библиотека', icon: BookOpen },
  { href: '/leaderboard', label: 'Класация', icon: Trophy },
  { href: '/profile', label: 'Профил', icon: User },
];

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export function NavLinks({ admin, teacher, inClass }: { admin: boolean; teacher: boolean; inClass: boolean }) {
  const path = usePathname();
  const items = [
    ...ITEMS,
    ...(inClass || !teacher ? [{ href: '/class', label: 'Моят клас', icon: School }] : []),
    ...(teacher ? [{ href: '/teacher', label: 'Учител', icon: GraduationCap }] : []),
    ...(admin ? [{ href: '/admin', label: 'Админ', icon: Shield }] : []),
  ];
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            data-nav
            data-active={active}
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

const MOBILE = ITEMS.slice(0, 6);
/** цветът на всеки раздел — същият като в плочките на началната страница */
const TINT: Record<string, string> = { '/': '#6ea2ff', '/tests': '#5fe0d0', '/play': '#ff7a8a', '/climb': '#7fd0ff', '/tower': '#ffd166', '/library': '#c59bff' };

export function BottomNav() {
  const path = usePathname();
  if (/^\/play\/[A-Z0-9]+/i.test(path)) return null; // по време на игра — цял екран
  return (
    <nav className="bn md:hidden" aria-label="Основно меню">
      <div className="bn-wrap">
      <div className="bn-bar">
        {MOBILE.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-label={label} data-active={active} className="bn-item" style={{ '--c': TINT[href] } as React.CSSProperties}>
              <span className="bn-glow">
                <span className="bn-ic">
                  <Icon className="size-[22px]" strokeWidth={2.3} />
                </span>
              </span>
              <span className="bn-t">{label}</span>
            </Link>
          );
        })}
      </div>
      </div>
    </nav>
  );
}

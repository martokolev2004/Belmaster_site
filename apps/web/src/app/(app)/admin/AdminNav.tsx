'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/admin', label: 'Табло' },
  { href: '/admin/questions', label: 'Въпроси' },
  { href: '/admin/works', label: 'Произведения' },
  { href: '/admin/exams', label: 'Матури' },
  { href: '/admin/import', label: 'Импорт' },
  { href: '/admin/reports', label: 'Доклади' },
  { href: '/admin/teachers', label: 'Учители' },
  { href: '/admin/users', label: 'Потребители' },
  { href: '/admin/messages', label: 'Съобщения' },
  { href: '/admin/mail', label: 'Имейли' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-6 mt-3 flex gap-1 overflow-x-auto border-b-2 border-line">
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn('-mb-0.5 shrink-0 border-b-4 px-3 py-2 text-sm font-extrabold uppercase', active ? 'border-secondary text-secondary' : 'border-transparent text-muted hover:text-ink')}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

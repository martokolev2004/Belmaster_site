import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';

/** Обвивка за публичните страници (без вход) — за посетители и търсачки. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="БЕЛ Мастер — начало">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/library" className="hidden rounded-xl px-3 py-2 text-sm font-extrabold text-muted hover:text-ink sm:inline">
              Библиотека
            </Link>
            <ButtonLink href="/login" variant="outline" size="sm">
              Вход
            </ButtonLink>
            <ButtonLink href="/login?tab=register" size="sm">
              Започни
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">{children}</main>
      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-8 text-xs text-muted">
        <span>© БЕЛ Мастер</span>
        <Link href="/privacy" className="hover:underline">Поверителност</Link>
        <Link href="/terms" className="hover:underline">Общи условия</Link>
        <Link href="/contact" className="hover:underline">Контакти</Link>
      </footer>
    </div>
  );
}

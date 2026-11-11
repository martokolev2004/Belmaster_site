import '@fontsource-variable/unbounded';
import '@/components/shell/nx.css';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nx min-h-dvh">
      <header className="mx-auto flex w-full max-w-3xl items-center px-4 py-4">
        <Link href="/" aria-label="Начало">
          <Logo />
        </Link>
      </header>
      <main className="legal mx-auto w-full max-w-3xl px-4 pb-16 leading-relaxed text-ink [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-black [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-black [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_ul]:mb-3">
        {children}
      </main>
    </div>
  );
}

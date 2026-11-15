import '@fontsource-variable/unbounded';
import '@/components/shell/nx.css';
import '@/components/landing/landing-next.css';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const ART = [
  { img: '/landing/battle.webp', c: '#ff5a5a', st: { '--x': '-58%', '--y': '10%', '--r': '-10deg' } },
  { img: '/landing/tower.webp', c: '#ffd84d', st: { '--x': '58%', '--y': '10%', '--r': '10deg' } },
  { img: '/landing/climb-hero.webp', c: '#35b8ff', st: { '--x': '0%', '--y': '0%', '--r': '0deg', '--s': 1.1 } },
];
const PERKS = [
  ['⚔️', 'Три игри', 'Завладявай земи, изкачвай върхове, строй кули.'],
  ['📝', 'Истински изпитни въпроси', 'Език, литература и четене с разбиране.'],
  ['🏆', 'Класации и лиги', 'Срещу съученици, приятели или бот.'],
];

/** Вход, регистрация, забравена парола и пр. — отляво какво е сайтът, отдясно формата. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nx au">
      <aside className="au-side">
        <div className="au-glow" />
        <Link href="/" aria-label="Начало" className="au-logo">
          <Logo />
        </Link>
        <div className="au-fan" aria-hidden>
          {ART.map((a) => (
            <span key={a.img} style={{ backgroundImage: `url(${a.img})`, '--c': a.c, ...a.st } as unknown as React.CSSProperties} />
          ))}
        </div>
        <div className="au-copy">
          <p className="ln-eyebrow">Български език и литература</p>
          <h2 className="ln-display">
            Не зубри. Играй. <span className="ln-grad">Печели.</span>
          </h2>
          <ul>
            {PERKS.map(([i, t, d]) => (
              <li key={t}>
                <i>{i}</i>
                <span>
                  <b>{t}</b>
                  {d}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="au-main">
        <header className="au-top">
          <Link href="/" aria-label="Начало">
            <Logo />
          </Link>
        </header>
        <main className="au-card nx-panel">{children}</main>
        <footer className="au-foot">
          <Link href="/library">Библиотека</Link>
          <Link href="/privacy">Поверителност</Link>
          <Link href="/terms">Общи условия</Link>
          <Link href="/cookies">Бисквитки</Link>
          <Link href="/contact">Контакти</Link>
        </footer>
      </div>
    </div>
  );
}

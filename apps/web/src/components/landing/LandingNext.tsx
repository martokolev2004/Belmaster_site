import type { CSSProperties } from 'react';
import Link from 'next/link';
import '@fontsource-variable/unbounded';
import '@/components/landing/landing-next.css';
import { LogoMark } from '@/components/Logo';
import { ClimbDemo } from '@/components/climb/ClimbDemo';
import { MapPreview } from '@/components/game/MapPreview';
import { Hero, Nav, Reveal, Tilt } from '@/components/landing/LandingFx';


const LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'БЕЛ Мастер',
  url: process.env.APP_URL ?? 'https://belmaster.eu',
  inLanguage: 'bg',
  description: 'Български език и литература като игра — образователни игри, тестове и библиотека с произведенията за 7., 10. и 12. клас.',
};
const TOPICS = ['Правопис', 'Граматика', 'Пунктуация', 'Лексика', 'Литература', 'Четене с разбиране', 'Изразни средства', 'Герои и теми'];
const GAMES = [
  { no: '01', c: '#ff5a5a', img: '/landing/battle.webp', tag: 'Стратегия · 2–4 играчи', title: 'Битка за Континента', text: 'Завладявай области с верни и бързи отговори. Пази столицата си — пада след три удара.', href: '/play' },
  { no: '02', c: '#35b8ff', img: '/landing/climb.webp', tag: 'Дуел · 1 на 1', title: 'Към върха', text: 'Строй стъпала към върха или събори съперника с точен изстрел. Щитът е само един.', href: '/climb' },
  { no: '03', c: '#ffd84d', img: '/landing/tower.webp', tag: 'Аркада · сам', title: 'Кула на Словото', text: 'Всеки верен отговор е нов етаж. Пусни го точно — иначе кулата се срутва.', href: '/tower' },
];

/** Началната страница за посетители (без вход). Старият вариант е запазен в app/Landing.tsx. */
export function LandingNext() {
  const row = [...TOPICS, ...TOPICS, ...TOPICS];

  return (
    <div className="ln-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />
      <Nav>
        <div className="ln-wrap ln-nav-in">
          <Link href="/" className="flex items-center gap-3" aria-label="БЕЛ Мастер">
            <LogoMark size={38} />
            <span className="ln-display text-[1.05rem]">
              БЕЛ <span className="ln-grad">Мастер</span>
            </span>
          </Link>
          <nav className="flex items-center gap-7">
            <a href="#games" className="ln-link hidden md:inline">Игри</a>
            <a href="#live" className="ln-link hidden md:inline">На живо</a>
            <Link href="/library" className="ln-link hidden md:inline">Библиотека</Link>
            <Link href="/login" className="ln-link">Вход</Link>
            <Link href="/login?tab=register" className="ln-btn ln-btn-primary ln-btn-sm">Играй</Link>
          </nav>
        </div>
      </Nav>

      <Hero>
        <div className="ln-wrap ln-hero-grid">
          <div className="ln-hero-copy">
            <p className="ln-eyebrow ln-in">Български език и литература · 7. – 12. клас</p>
            <h1 className="ln-display ln-h1 ln-in" style={{ '--d': '.12s' } as CSSProperties}>
              Не зубри.
              <br />
              Играй.
              <br />
              <span className="ln-grad">Печели.</span>
            </h1>
            <p className="ln-lead ln-in" style={{ '--d': '.26s' } as CSSProperties}>
              Правопис, граматика, пунктуация и литература, превърнати в три игри. Завладявай земи, изкачвай върхове и строй кули — с всеки верен отговор.
            </p>
            <div className="ln-cta ln-in" style={{ '--d': '.4s' } as CSSProperties}>
              <span className="ln-glow">
                <Link href="/login?tab=register" className="ln-btn ln-btn-primary">
                  Играй безплатно <span aria-hidden>→</span>
                </Link>
              </span>
              <a href="#games" className="ln-btn ln-btn-ghost">Виж игрите</a>
            </div>
            <p className="ln-trust ln-in" style={{ '--d': '.54s' } as CSSProperties}>
              <span><b>Безплатно</b> · без реклами</span>
              <span><b>Без регистрация</b> — влез като гост</span>
              <span>Срещу <b>приятел</b> или <b>бот</b></span>
            </p>
          </div>
          <div className="ln-fan ln-in" style={{ '--d': '.3s' } as CSSProperties}>
            {[
              { g: GAMES[0], st: { '--tx': '-70%', '--ty': '9%', '--r': '-11deg', '--z': 1, '--k': '-14px', '--fd': '-2s' } },
              { g: GAMES[2], st: { '--tx': '70%', '--ty': '9%', '--r': '11deg', '--z': 2, '--k': '-20px', '--fd': '-4s' } },
              { g: GAMES[1], st: { '--tx': '0%', '--ty': '-2%', '--r': '0deg', '--s': 1.1, '--z': 3, '--k': '-30px', '--fd': '0s' } },
            ].map(({ g, st }) => (
              <div key={g.no} className="ln-fan-slot" style={st as CSSProperties}>
                <div className="ln-fan-float" style={st as CSSProperties}>
                  <Link href={g.href} className="ln-fan-card" style={{ backgroundImage: `url(${g.img})`, '--c': g.c } as CSSProperties}>
                    <span className="ln-display">
                      <em>{g.tag}</em>
                      {g.title}
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="ln-scroll" aria-hidden />
      </Hero>

      <section id="games" className="ln-section">
        <div className="ln-orb" style={{ background: '#58cc02', top: '-10rem', right: '-18rem' }} />
        <div className="ln-wrap">
          <Reveal>
            <p className="ln-eyebrow">Избери арена</p>
            <h2 className="ln-display ln-h2">
              Три игри. <span className="ln-grad">Една цел.</span>
            </h2>
            <p className="ln-sub">Във всяка напредваш само с верни отговори. Сам, срещу бот или срещу съученик — ти избираш.</p>
          </Reveal>
          <div className="ln-games">
            {GAMES.map((g, i) => (
              <Reveal key={g.no} delay={i * 0.12}>
                <Tilt href={g.href} className="ln-card" style={{ '--c': g.c } as CSSProperties}>
                  <div className="ln-card-img" style={{ backgroundImage: `url(${g.img})` }} />
                  <div className="ln-card-edge" />
                  <span className="ln-display ln-card-no">{g.no}</span>
                  <div className="ln-card-body">
                    <span className="ln-chip">{g.tag}</span>
                    <h3 className="ln-display ln-card-title">{g.title}</h3>
                    <p className="ln-card-text">{g.text}</p>
                    <span className="ln-card-go">
                      Играй <span aria-hidden>→</span>
                    </span>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="live" className="ln-section" style={{ paddingTop: 0 }}>
        <div className="ln-wrap ln-split">
          <Reveal>
            <p className="ln-eyebrow">На живо от играта</p>
            <h2 className="ln-display ln-h2">
              Знаеш отговора? <span className="ln-grad">Удряй.</span>
            </h2>
            <ul className="ln-list">
              <li><i>⚡</i><span><b>Бързината решава</b>Вярно и по-бързо от съперника — и ходът е твой.</span></li>
              <li><i>🎯</i><span><b>Рискувай или се качи</b>Сигурно стъпало нагоре или изстрел, който може да се върне.</span></li>
              <li><i>🛡️</i><span><b>Един щит на игра</b>Вдигни го в точния момент и ударът рикошира.</span></li>
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="ln-frame">
              <div className="ln-frame-in">
                <div className="ln-frame-bar"><span className="ln-live" /> Към върха · демо</div>
                <ClimbDemo theme="night" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="ln-marquee" aria-hidden>
        <div className="ln-track">
          {row.map((a, i) => (
            <span key={i} className="ln-display">{a}</span>
          ))}
        </div>
      </div>

      <section className="ln-section">
        <div className="ln-orb" style={{ background: '#1cb0f6', bottom: '-14rem', left: '-20rem' }} />
        <div className="ln-wrap ln-split" data-flip="true">
          <Reveal delay={0.15}>
            <div className="ln-frame">
              <div className="ln-frame-in">
                <div className="ln-frame-bar"><span className="ln-live" /> Континентът на Словото</div>
                <MapPreview className="block w-full" />
              </div>
            </div>
          </Reveal>
          <Reveal>
            <p className="ln-eyebrow">Не е просто игра</p>
            <h2 className="ln-display ln-h2">
              Всичко за <span className="ln-grad">шестицата.</span>
            </h2>
            <ul className="ln-list">
              <li><i>📝</i><span><b>Истински изпитни въпроси</b>Правопис, граматика, пунктуация, лексика, литература и четене с разбиране.</span></li>
              <li><i>📚</i><span><b>Библиотека</b>Резюме, герои, теми и идеи за произведенията, които учиш.</span></li>
              <li><i>🔁</i><span><b>Грешките се връщат</b>Сайтът помни къде бъркаш и ти го дава отново, докато го научиш.</span></li>
              <li><i>🏆</i><span><b>Лиги и класации</b>Седмични лиги, рейтинг, постижения и аватар, който расте с теб.</span></li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="ln-section" style={{ paddingTop: 0 }}>
        <div className="ln-wrap">
          <Reveal>
            <p className="ln-eyebrow">Как започваш</p>
            <h2 className="ln-display ln-h2">
              В игра за <span className="ln-grad">30 секунди.</span>
            </h2>
          </Reveal>
          <div className="ln-steps">
            {[
              { n: '1', t: 'Влез', p: 'Като гост — с един клик. Или си направи профил, за да пазиш прогреса си.' },
              { n: '2', t: 'Избери игра', p: 'Битка за територии, дуел към върха или кула. Срещу приятел, случаен съперник или бот.' },
              { n: '3', t: 'Отговаряй и печели', p: 'XP, нива, диаманти и място в класацията. А между другото — научаваш материала.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1} className="ln-step">
                <span className="ln-display ln-step-n">{s.n}</span>
                <h3 className="ln-display">{s.t}</h3>
                <p>{s.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="ln-final">
        <div className="ln-hero-glow" style={{ zIndex: -2 }} />
        <div className="ln-wrap">
          <Reveal>
            <p className="ln-eyebrow" style={{ justifyContent: 'center' }}>Първата игра е на един клик</p>
            <h2 className="ln-display ln-final-h">
              Твой <span className="ln-grad">ред е.</span>
            </h2>
            <span className="ln-glow">
              <Link href="/login?tab=register" className="ln-btn ln-btn-primary">
                Започни сега <span aria-hidden>→</span>
              </Link>
            </span>
          </Reveal>
        </div>
      </section>

      <footer className="ln-wrap ln-footer">
        <span>© {new Date().getFullYear()} БЕЛ Мастер</span>
        <span className="flex flex-wrap gap-6">
          <Link href="/library">Библиотека</Link>
          <Link href="/privacy">Поверителност</Link>
          <Link href="/terms">Общи условия</Link>
          <Link href="/contact">Контакти</Link>
        </span>
      </footer>
    </div>
  );
}

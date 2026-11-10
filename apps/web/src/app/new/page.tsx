import type { CSSProperties } from 'react';
import Link from 'next/link';
import '@fontsource-variable/unbounded';
import '@/components/landing/landing-next.css';
import { prisma } from '@/lib/db';
import { LogoMark } from '@/components/Logo';
import { ClimbDemo } from '@/components/climb/ClimbDemo';
import { MapPreview } from '@/components/game/MapPreview';
import { CountUp, Hero, Nav, Reveal, Tilt } from '@/components/landing/LandingFx';

export const metadata = { title: 'БЕЛ Мастер — матурата като игра', robots: { index: false } };
export const dynamic = 'force-dynamic';

const GAMES = [
  { no: '01', c: '#ff5a5a', img: '/landing/battle.webp', tag: 'Стратегия · 2–4 играчи', title: 'Битка за Континента', text: 'Завладявай области с верни и бързи отговори. Пази столицата си — пада след три удара.', href: '/play' },
  { no: '02', c: '#35b8ff', img: '/landing/climb.webp', tag: 'Дуел · 1 на 1', title: 'Към върха', text: 'Строй стъпала към върха или събори съперника с точен изстрел. Щитът е само един.', href: '/climb' },
  { no: '03', c: '#ffd84d', img: '/landing/tower.webp', tag: 'Аркада · сам', title: 'Кула на Словото', text: 'Всеки верен отговор е нов етаж. Пусни го точно — иначе кулата се срутва.', href: '/tower' },
];

export default async function NewLanding() {
  const [questions, exams, works, list] = await Promise.all([
    prisma.question.count({ where: { status: 'ACTIVE' } }),
    prisma.exam.count(),
    prisma.work.count({ where: { published: true } }),
    prisma.work.findMany({ where: { published: true, grade: 'G12' }, select: { author: true }, distinct: ['author'] }),
  ]);
  const authors = list.map((w) => w.author);
  const row = [...authors, ...authors];

  return (
    <div className="ln-root">
      <Nav>
        <div className="ln-wrap ln-nav-in">
          <Link href="/new" className="flex items-center gap-3" aria-label="БЕЛ Мастер">
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

      <Hero image="/landing/hero.webp">
        <div className="ln-wrap">
          <div className="ln-hero-copy">
            <p className="ln-eyebrow ln-in">Матура по БЕЛ · 12. клас</p>
            <h1 className="ln-display ln-h1 ln-in" style={{ '--d': '.12s' } as CSSProperties}>
              Матурата
              <br />
              не се учи.
              <br />
              <span className="ln-grad">Печели се.</span>
            </h1>
            <p className="ln-lead ln-in" style={{ '--d': '.26s' } as CSSProperties}>
              Истинските въпроси от матурите, превърнати в три игри. Завладявай земи, изкачвай върхове и строй кули — с всеки верен отговор.
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
              <span>Въпроси от <b>МОН</b></span>
            </p>
          </div>
        </div>
        <span className="ln-scroll" aria-hidden />
      </Hero>

      <div className="ln-stats">
        {[
          { n: questions, l: 'въпроса от матури' },
          { n: exams, l: 'изпита на МОН' },
          { n: works, l: 'произведения' },
          { n: 3, l: 'игри в едно' },
        ].map((s, i) => (
          <Reveal key={s.l} delay={i * 0.08} className="ln-stat">
            <div className="ln-display ln-stat-n ln-grad">
              <CountUp to={s.n} />
            </div>
            <div className="ln-stat-l">{s.l}</div>
          </Reveal>
        ))}
      </div>

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
              <li><i>📝</i><span><b>Истински матури</b>Правопис, граматика, пунктуация, литература и четене с разбиране — с ключовете на МОН.</span></li>
              <li><i>📚</i><span><b>Библиотека</b>Резюме, герои, теми и идеи за всяко произведение от програмата.</span></li>
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
        <div className="ln-final-bg" style={{ backgroundImage: 'url(/landing/hero.webp)' }} />
        <div className="ln-wrap">
          <Reveal>
            <p className="ln-eyebrow" style={{ justifyContent: 'center' }}>Май идва по-бързо, отколкото мислиш</p>
            <h2 className="ln-display ln-h1" style={{ marginInline: 'auto', maxWidth: '16ch' }}>
              Бъди <span className="ln-grad">готов.</span>
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

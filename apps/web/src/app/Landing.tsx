// РЕЗЕРВЕН ВАРИАНТ: старата начална страница. Не се показва никъде — пази се, за да може да се върне.
// За връщане: в app/page.tsx сложи <Landing /> вместо <LandingNext />.
import Link from 'next/link';
import { BookOpen, Castle, ListChecks, Swords, Trophy, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';
import { MapPreview } from '@/components/game/MapPreview';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';

const FAQ = [
  { q: 'Какво е БЕЛ Мастър?', a: 'Безплатен сайт за подготовка за матурата (ДЗИ) по български език и литература за 12. клас. Решаваш въпроси от истински матури на МОН, учиш произведенията от програмата и играеш образователни игри срещу съученици или бот.' },
  { q: 'Откъде са въпросите?', a: 'От официалните държавни зрелостни изпити по БЕЛ (2017–2026), с верните отговори от ключовете на МОН: правопис, граматика, пунктуация, лексика, литература и четене с разбиране.' },
  { q: 'Безплатно ли е?', a: 'Да, напълно. Можеш да пробваш и като гост, без регистрация. С профил прогресът ти се пази и влизаш в класациите.' },
  { q: 'Кои произведения има в библиотеката?', a: 'Всички творби от програмата по литература за матурата — от Ботев, Вазов, Алеко Константинов, Яворов, Елин Пелин, Йовков, Смирненски, Вапцаров, Далчев, Багряна, Талев, Радичков и други — с резюме, герои, теми и идеи.' },
  { q: 'Как помагат игрите за матурата?', a: 'Във всяка игра напредваш само с верни отговори на въпроси от матури. Така преговаряш повече, без да ти доскучае, а сайтът запомня грешките ти и ти ги дава отново за преговор.' },
];

const FEATURES = [
  { icon: ListChecks, color: 'text-primary bg-primary/15', title: 'Мини тестове', text: 'Език, литература и четене с разбиране — с въпроси от истинските матури.' },
  { icon: Swords, color: 'text-error bg-error/15', title: 'Мултиплейър битки', text: 'Завладявай области на Континента на Словото с верни и бързи отговори.' },
  { icon: Castle, color: 'text-orange bg-orange/15', title: 'Столици и земи', text: 'Пази столицата си и превземи цяла земя за двойна атака.' },
  { icon: BookOpen, color: 'text-secondary bg-secondary/15', title: 'Библиотека', text: 'Всички произведения от учебната програма на едно място.' },
  { icon: Users, color: 'text-purple bg-purple/20', title: 'Приятели', text: 'Добавяй приятели и ги канѝ на битка с един линк.' },
  { icon: Trophy, color: 'text-[#8a6500] bg-accent/20', title: 'Класации', text: 'Рейтинг за всеки клас, месечни сезони и класация по опит.' },
];

export async function Landing() {
  const works = await prisma.work.findMany({ where: { published: true, grade: 'G12' }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }], select: { title: true, author: true } });
  const base = process.env.APP_URL ?? 'https://belmaster.eu';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'БЕЛ Мастър', url: base, inLanguage: 'bg', description: 'Подготовка за матурата по български език и литература — тестове от минали матури, анализи на произведенията и образователни игри.' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  return (
    <div className="min-h-dvh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-xl px-4 py-2 font-extrabold uppercase text-secondary hover:bg-surface-2 sm:block">
            Вход
          </Link>
          <ButtonLink href="/login?tab=register" size="sm">
            Започни
          </ButtonLink>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 md:grid-cols-2 md:pt-14">
        <div className="animate-rise">
          <p className="mb-3 inline-block rounded-full bg-accent/20 px-3 py-1 text-sm font-extrabold text-[#8a6500]">7. · 10. · 12. клас</p>
          <h1 className="text-4xl font-black leading-tight md:text-5xl">
            Матурата по БЕЛ — <span className="text-primary">като игра.</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted">
            Решавай въпроси от минали матури, учи произведенията и предизвиквай приятели в битки за територии.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/login?tab=register" size="lg">
              Създай профил
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg">
              Играй като гост
            </ButtonLink>
          </div>
        </div>
        <div className="animate-pop">
          <MapPreview className="w-full drop-shadow-xl" />
        </div>
      </section>

      <section className="border-t-2 border-line bg-surface-2/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-center text-3xl font-black">Какво има в БЕЛ Мастър</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, color, title, text }) => (
              <div key={title} className="card3d rounded-2xl bg-surface p-5">
                <span className={`mb-3 inline-flex rounded-2xl p-3 ${color}`}>
                  <Icon className="size-7" strokeWidth={2.4} />
                </span>
                <h3 className="text-lg font-extrabold">{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center text-3xl font-black">Произведенията за матурата</h2>
          <p className="mb-8 text-center text-muted">Резюме, герои, теми и идеи за всяка творба от програмата за 12. клас.</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((w) => (
              <li key={w.title}>
                <Link href={`/library/${slugify(w.title)}`} className="block rounded-xl px-3 py-2 hover:bg-surface-2">
                  <span className="font-extrabold text-ink-strong">„{w.title.replace(/\.\.\.$/, '…')}“</span> <span className="text-muted">— {w.author}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t-2 border-line bg-surface-2/60 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-6 text-center text-3xl font-black">Често задавани въпроси</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card3d rounded-2xl bg-surface p-4">
                <summary className="cursor-pointer font-extrabold">{f.q}</summary>
                <p className="mt-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 py-8 text-center text-sm text-muted">
        <span>© {new Date().getFullYear()} БЕЛ Мастър</span>
        <Link href="/privacy" className="hover:underline">Поверителност</Link>
        <Link href="/terms" className="hover:underline">Общи условия</Link>
        <Link href="/contact" className="hover:underline">Контакти</Link>
      </footer>
    </div>
  );
}

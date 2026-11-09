import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';

export const dynamic = 'force-dynamic';

/** llms.txt — кратко описание на сайта за AI асистентите (https://llmstxt.org). */
export async function GET() {
  const base = process.env.APP_URL ?? 'https://belmaster.eu';
  const works = await prisma.work.findMany({ where: { published: true, grade: 'G12' }, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }], select: { title: true, author: true, genre: true } });
  const body = `# БЕЛ Мастер

> Безплатен български сайт за подготовка за матурата (ДЗИ) по български език и литература за 12. клас: тестове с въпроси от истински матури на МОН (2017–2026), библиотека с анализи на произведенията от програмата, преговор на грешките и образователни игри (битки за територии, „Към върха“, „Кула на Словото“) срещу съученици или бот.

Сайтът е на български език. Въпросите са от официалните изпити на МОН с верните отговори от ключовете. Регистрацията е безплатна; може да се играе и като гост.

## Библиотека — произведенията за матурата (12. клас)

${works.map((w) => `- [${w.title} — ${w.author}](${base}/library/${slugify(w.title)}): резюме, герои, теми и идеи${w.genre ? ` (${w.genre.split('(')[0].trim()})` : ''}`).join('\n')}

## Основни страници

- [Начало](${base}/): какво предлага сайтът
- [Библиотека](${base}/library): всички произведения от програмата
- [Контакти](${base}/contact)
`;
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

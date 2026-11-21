import type { Work } from '@belmaster/db';

export type Flashcard = { id: string; tag: string; front: string; hint?: string; back: string | string[] };

const bullets = (s: string | null) => (s ?? '').split('\n').map((l) => l.replace(/^\s*[•\-–]\s*/, '').trim()).filter((l) => l.length > 1);
const sentences = (s: string | null, n: number) => {
  const parts = (s ?? '').replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+(\s|$)/g) ?? [];
  return parts.slice(0, n).join('').trim() || (s ?? '').trim();
};

/**
 * Флаш карти за произведение — само от това, което вече е въведено в библиотеката
 * (автор, жанр, направление, герои, теми, резюме). Нищо не се измисля.
 */
export function buildCards(w: Pick<Work, 'id' | 'title' | 'author' | 'genre' | 'period' | 'year' | 'summary' | 'themes' | 'characters' | 'authorInfo'>): Flashcard[] {
  const cards: Flashcard[] = [];
  const t = `„${w.title.replace(/\.\.\.$/, '…')}“`;
  cards.push({ id: 'author', tag: 'Автор', front: `Кой е авторът на ${t}?`, back: w.author });
  const kind = [w.genre, w.period && `Период/направление: ${w.period}`, w.year && `Година: ${w.year}`].filter(Boolean) as string[];
  if (kind.length) cards.push({ id: 'genre', tag: 'Жанр', front: `Какво произведение е ${t} — жанр и период?`, back: kind });
  if (w.summary) cards.push({ id: 'summary', tag: 'Сюжет', front: `За какво се разказва в ${t}?`, hint: 'Кажи го с две-три изречения', back: sentences(w.summary, 3) });
  bullets(w.characters).forEach((c, i) => {
    const m = c.match(/^(.{2,60}?)\s+[–—-]\s+(.+)$/);
    if (!m) return;
    const name = m[1].replace(/[„“"]/g, '').trim();
    cards.push({ id: `ch${i}`, tag: 'Герой', front: name, hint: 'Кой е и какъв е?', back: m[2].charAt(0).toUpperCase() + m[2].slice(1) });
  });
  const themes = bullets(w.themes);
  if (themes.length) cards.push({ id: 'themes', tag: 'Теми', front: `Кои са основните теми и идеи в ${t}?`, hint: `Опитай да се сетиш за ${themes.length}`, back: themes });
  if (w.authorInfo) cards.push({ id: 'authorInfo', tag: 'За автора', front: `Какво трябва да знаеш за ${w.author}?`, back: sentences(w.authorInfo, 2) });
  return cards;
}

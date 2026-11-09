/** Проверка на публичното име (вижда се в класациите). */
const BAD = [
  'путк', 'пичк', 'ебан', 'ебал', 'шиба', 'педал', 'мамк', 'майка ти', 'курв', 'хуй', 'gay', 'fuck', 'shit', 'bitch', 'dick', 'porn', 'секс', 'нацист', 'хитлер', 'hitler',
];
export function checkDisplayName(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return 'Името трябва да е поне 2 знака.';
  if (n.length > 30) return 'Името е твърде дълго.';
  if (/@|https?:|www\.|\.(com|bg|eu|net)\b/i.test(n)) return 'Името не може да съдържа имейл или адрес на сайт.';
  if (/\d{6,}/.test(n.replace(/[\s.-]/g, ''))) return 'Името не може да съдържа телефонен номер.';
  const low = n.toLowerCase().replace(/[^a-zа-я ]/g, '');
  const words = low.split(/\s+/);
  if (BAD.some((b) => (b.length <= 3 ? words.some((w) => w.startsWith(b) && w.length <= b.length + 3) : low.includes(b)))) return 'Избери друго име — това не е подходящо.';
  return null;
}

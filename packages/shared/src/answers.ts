/** Нормализира кратък писмен отговор за сравнение. */
export function normalizeAnswer(s: string): string {
  return s
    .toLocaleLowerCase('bg-BG')
    .normalize('NFC')
    .replace(/[„“”"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:!?-]+|[\s.,;:!?-]+$/g, '')
    .trim();
}

/**
 * Допустим отговор:
 *  - обикновен текст — трябва да съвпада (без значение от главни букви, кавички, интервали);
 *  - „~показване|ключ1 ключ2“ — приема се всеки отговор, който съдържа всички ключови думи
 *    (може и част от дума: „зрени“ хваща „зрението“, „зрение“).
 */
export function matchesAccepted(given: string, accepted: string): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  if (accepted.startsWith('~')) {
    const [, keys = ''] = accepted.slice(1).split('|');
    const words = normalizeAnswer(keys).split(' ').filter(Boolean);
    return words.length > 0 && words.every((w) => g.includes(w));
  }
  return normalizeAnswer(accepted) === g;
}

export function isShortAnswerCorrect(given: string, accepted: string[]): boolean {
  return accepted.some((a) => matchesAccepted(given, a));
}

/** Как да се покаже допустимият отговор на ученика. */
export function displayAccepted(accepted: string[]): string {
  return accepted.map((a) => (a.startsWith('~') ? a.slice(1).split('|')[0] : a)).join(' / ');
}

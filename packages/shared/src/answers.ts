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

export function isShortAnswerCorrect(given: string, accepted: string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return accepted.some((a) => normalizeAnswer(a) === g);
}

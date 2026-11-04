export type GradeCode = 'G7' | 'G10' | 'G12';

export const GRADES: { code: GradeCode; num: 7 | 10 | 12; label: string; exam: string }[] = [
  { code: 'G7', num: 7, label: '7. клас', exam: 'НВО 7. клас' },
  { code: 'G10', num: 10, label: '10. клас', exam: 'НВО 10. клас' },
  { code: 'G12', num: 12, label: '12. клас', exam: 'ДЗИ 12. клас' },
];

export function gradeLabel(code: GradeCode | null | undefined): string {
  return GRADES.find((g) => g.code === code)?.label ?? '—';
}

export function isGrade(v: unknown): v is GradeCode {
  return v === 'G7' || v === 'G10' || v === 'G12';
}

export const SECTION_LABELS = {
  LANGUAGE: 'Език',
  LITERATURE: 'Литература',
  READING: 'Четене с разбиране',
} as const;

export const TOPIC_LABELS = {
  GRAMMAR: 'Граматика',
  LEXIS: 'Лексика',
  SPELLING: 'Правопис',
  PUNCTUATION: 'Пунктуация',
} as const;

import { AVATAR_PART_LABELS, EXTRA_LABELS, type AvatarPart } from '@belmaster/shared';

const FEATURE_LABELS: Record<string, string> = { none: 'Без', freckles: 'Лунички', birthmark: 'Бенка', blush: 'Руменина', mustache: 'Мустак' };
export const COLOR_PARTS: AvatarPart[] = ['hairColor', 'skinColor', 'bg'];

export function itemLabel(part: AvatarPart, v: string) {
  if (part === 'extra') return EXTRA_LABELS[v] ?? v;
  if (part === 'features') return FEATURE_LABELS[v] ?? v;
  if (v === 'none') return 'Без';
  if (part === 'hair') return v.replace('short', 'Къса ').replace('long', 'Дълга ');
  return v.replace('variant', '');
}

/** „Прическа · Дълга 03“, „Фон“ … */
export function itemTitle(part: AvatarPart, v: string) {
  return COLOR_PARTS.includes(part) ? AVATAR_PART_LABELS[part] : `${AVATAR_PART_LABELS[part]} · ${itemLabel(part, v)}`;
}

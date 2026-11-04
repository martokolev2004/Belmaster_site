'use client';

import { memo, useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import { sanitizeAvatar, type AvatarConfig, type FrameTier } from '@belmaster/shared';
import { cn } from '@/lib/cn';
import { EXTRA_SVG, FRAME_SVG } from './extras';

export function avatarSvg(cfg: AvatarConfig, frame: FrameTier = 'none'): string {
  const svg = createAvatar(adventurer, {
    randomizeIds: true,
    hair: [cfg.hair as never],
    hairColor: [cfg.hairColor],
    skinColor: [cfg.skinColor],
    eyes: [cfg.eyes as never],
    eyebrows: [cfg.eyebrows as never],
    mouth: [cfg.mouth as never],
    glasses: cfg.glasses === 'none' ? [] : [cfg.glasses as never],
    glassesProbability: cfg.glasses === 'none' ? 0 : 100,
    earrings: cfg.earrings === 'none' ? [] : [cfg.earrings as never],
    earringsProbability: cfg.earrings === 'none' ? 0 : 100,
    features: cfg.features === 'none' ? [] : [cfg.features as never],
    featuresProbability: cfg.features === 'none' ? 0 : 100,
    backgroundColor: [cfg.bg],
    radius: 20,
  }).toString();
  const extra = EXTRA_SVG[cfg.extra] ?? '';
  const fr = FRAME_SVG[frame] ?? '';
  return svg.replace(/<\/svg>\s*$/, `${extra}${fr}</svg>`);
}

/** Аватар на потребител. Без конфигурация — стабилен случаен аватар по името. */
export const UserAvatar = memo(function UserAvatar({
  avatar,
  name,
  size = 40,
  frame = 'none',
  className,
}: {
  avatar?: unknown;
  name: string;
  size?: number;
  frame?: FrameTier;
  className?: string;
}) {
  const html = useMemo(() => avatarSvg(sanitizeAvatar(avatar, null, name || '?'), frame), [avatar, name, frame]);
  return (
    <span
      className={cn('inline-block shrink-0 overflow-hidden rounded-[22%] [&>svg]:h-full [&>svg]:w-full', className)}
      style={{ width: size, height: size }}
      aria-label={name}
      role="img"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

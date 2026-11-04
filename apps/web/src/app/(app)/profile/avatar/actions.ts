'use server';

import { revalidatePath } from 'next/cache';
import { sanitizeAvatar } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { unlockProgress } from '@/lib/avatar';

export async function saveAvatarAction(config: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const progress = await unlockProgress(user);
  // заключените части, които не са отключени, се махат на сървъра
  const clean = sanitizeAvatar(config, progress, user.id);
  await prisma.user.update({ where: { id: user.id }, data: { avatar: clean } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

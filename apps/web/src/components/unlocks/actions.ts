'use server';

import { getCurrentUser } from '@/lib/auth';
import { ackCelebration, pendingCelebration, type Celebration } from '@/lib/unlocks';

export async function checkCelebrationAction(): Promise<Celebration | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return pendingCelebration(user);
}

export async function ackCelebrationAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await ackCelebration(user);
}

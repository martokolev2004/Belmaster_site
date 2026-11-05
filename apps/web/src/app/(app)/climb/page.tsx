import { Suspense } from 'react';
import { WEAPONS, isUnlocked, weaponKey } from '@belmaster/shared';
import { requireUser } from '@/lib/auth';
import { diamondsOf, unlockProgress } from '@/lib/avatar';
import { ClimbGame } from '@/components/climb/ClimbGame';

export const metadata = { title: 'Към върха' };
export const dynamic = 'force-dynamic';

export default async function ClimbPage() {
  const user = await requireUser();
  const progress = unlockProgress(user);
  const weapons = WEAPONS.map((w) => ({ ...w, open: !w.rule || isUnlocked(w.rule, progress, weaponKey(w.id)) }));
  const selected = weapons.find((w) => w.id === user.weapon && w.open)?.id ?? 'stone';
  return (
    <Suspense>
      <ClimbGame weapons={weapons} selected={selected} diamonds={progress.diamonds} isGuest={user.isGuest} />
    </Suspense>
  );
}

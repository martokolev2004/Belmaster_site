'use client';

import { useEffect, useState } from 'react';
import { useGame } from './GameSocketProvider';

/** Оставащо време до deadline (по часовника на сървъра). */
export function useCountdown(deadline: number | null | undefined): number {
  const { clockOffset } = useGame();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return 0;
  return Math.max(0, deadline - (now + clockOffset));
}

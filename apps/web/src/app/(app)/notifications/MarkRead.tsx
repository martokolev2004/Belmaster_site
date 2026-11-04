'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markNotificationsReadAction } from '../class/actions';

/** Отбелязва известията като прочетени (след кратко, за да се види кои са нови). */
export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => void markNotificationsReadAction().then(() => router.refresh()), 2500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}

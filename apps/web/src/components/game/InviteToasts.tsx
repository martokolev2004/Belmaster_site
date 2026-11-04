'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, X } from 'lucide-react';
import { MODE_LABELS } from '@belmaster/shared';
import { useGame } from './GameSocketProvider';

export function InviteToasts() {
  const { invites, dismissInvite } = useGame();
  const path = usePathname();
  if (!invites.length) return null;
  return (
    <div className="fixed bottom-24 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-6">
      {invites.slice(-3).map((inv) =>
        path === `/play/${inv.code}` ? null : (
          <div key={inv.id} className="card3d animate-pop rounded-2xl bg-surface p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-accent/20 p-2 text-[#8a6500]">
                <Swords className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-ink-strong">{inv.fromName} те кани на битка!</p>
                <p className="text-sm text-muted">{MODE_LABELS[inv.mode].name}</p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/play/${inv.code}`}
                    onClick={() => dismissInvite(inv.id)}
                    className="btn3d rounded-xl bg-primary px-4 py-2 text-sm font-extrabold uppercase text-white [--btn-shadow:var(--color-primary-dark)]"
                  >
                    Влез
                  </Link>
                  <button onClick={() => dismissInvite(inv.id)} className="rounded-xl px-3 py-2 text-sm font-extrabold text-muted hover:bg-surface-2">
                    По-късно
                  </button>
                </div>
              </div>
              <button onClick={() => dismissInvite(inv.id)} aria-label="Затвори" className="text-muted">
                <X className="size-4" />
              </button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

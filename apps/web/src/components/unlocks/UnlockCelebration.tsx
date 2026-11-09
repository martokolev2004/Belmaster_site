'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ACHIEVEMENTS, itemsForLevel, sanitizeAvatar, type AvatarPart } from '@belmaster/shared';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { itemTitle } from '@/components/avatar/labels';
import { Confetti } from '@/components/game/BattleExtras';
import { play } from '@/lib/sound';
import type { Celebration } from '@/lib/unlocks';
import { ackCelebrationAction, checkCelebrationAction } from './actions';

/** Пусни това събитие, когато ученикът може да е получил XP (край на тест, край на битка). */
export const PROGRESS_EVENT = 'bm:progress';
export function notifyProgress(delayMs = 0) {
  if (typeof window === 'undefined') return;
  setTimeout(() => window.dispatchEvent(new Event(PROGRESS_EVENT)), delayMs);
}

export function Padlock() {
  return (
    <svg viewBox="0 0 40 48" className="size-14 drop-shadow-lg" aria-hidden>
      <path className="unlock-shackle" d="M11 22v-7a9 9 0 0 1 18 0v7" fill="none" stroke="#9aa6ad" strokeWidth="5" strokeLinecap="round" />
      <rect x="5" y="20" width="30" height="24" rx="6" fill="#ffc800" stroke="#e5a400" strokeWidth="2.5" />
      <circle cx="20" cy="30" r="3.4" fill="#4b3b00" />
      <rect x="18.6" y="31" width="2.8" height="7" rx="1.4" fill="#4b3b00" />
    </svg>
  );
}

export function UnlockCelebration({ avatar, seed }: { avatar: unknown; seed: string }) {
  const [data, setData] = useState<Celebration | null>(null);
  const busy = useRef(false);
  const path = usePathname();
  const router = useRouter();

  const check = useCallback(async () => {
    if (busy.current || data) return;
    busy.current = true;
    try {
      const c = await checkCelebrationAction();
      if (c) {
        setData(c);
        play(c.toLevel > c.fromLevel || c.achievements.length ? 'levelup' : 'unlock');
        if (c.items.length) setTimeout(() => play('unlock'), 1100);
      }
    } catch {
      /* без мрежа — ще пробваме пак */
    } finally {
      busy.current = false;
    }
  }, [data]);

  useEffect(() => {
    // не прекъсваме битка
    if (/^\/play\/[A-Z0-9]+/i.test(path)) return;
    void check();
  }, [path, check]);

  useEffect(() => {
    const on = () => void check();
    window.addEventListener(PROGRESS_EVENT, on);
    return () => window.removeEventListener(PROGRESS_EVENT, on);
  }, [check]);

  if (!data) return null;
  const close = () => {
    setData(null);
    void ackCelebrationAction().then(() => router.refresh());
  };
  const levelUp = data.toLevel > data.fromLevel;
  const base = sanitizeAvatar(avatar, null, seed);
  const upcoming = itemsForLevel(data.toLevel + 1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal>
      {(levelUp || data.achievements.length > 0) && <Confetti />}
      <div className="animate-pop relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-surface p-6 text-center shadow-2xl">
        {levelUp ? (
          <>
            <span className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-accent text-4xl font-black text-[#4b3b00] shadow-[0_5px_0_var(--color-accent-dark)]">
              {data.toLevel}
            </span>
            <h2 className="mt-4 text-3xl font-black">Ниво {data.toLevel}!</h2>
            <p className="mt-1 text-muted">Браво! Продължавай така.</p>
          </>
        ) : data.items.length ? (
          <h2 className="text-2xl font-black">Отключи нещо ново!</h2>
        ) : (
          <h2 className="text-2xl font-black">{data.achievements.length > 1 ? 'Нови постижения!' : 'Ново постижение!'}</h2>
        )}

        {data.achievements.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.achievements.slice(0, 6).map((code, i) => {
              const a = ACHIEVEMENTS.find((x) => x.code === code);
              if (!a) return null;
              return (
                <div key={code} className="animate-rise flex items-center gap-3 rounded-2xl bg-accent/15 px-3 py-2 text-left" style={{ animationDelay: `${0.2 + i * 0.25}s` }}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xl">🏅</span>
                  <span>
                    <span className="block font-extrabold text-ink-strong">{a.name}</span>
                    <span className="block text-xs text-muted">{a.description}</span>
                  </span>
                </div>
              );
            })}
            {data.achievements.length > 6 && <p className="text-xs font-bold text-muted">и още {data.achievements.length - 6} — виж ги в профила</p>}
          </div>
        )}

        {data.items.length > 0 && (
          <>
            <p className="mt-5 text-sm font-extrabold uppercase text-muted">Отключи</p>
            <div className="mt-3 flex flex-wrap justify-center gap-4">
              {data.items.map((it, i) => {
                const part = it.part as AvatarPart;
                return (
                  <div key={it.key} className="flex w-28 flex-col items-center" style={{ ['--d' as string]: `${0.3 + i * 0.45}s` }}>
                    <div className="relative">
                      <span className="unlock-glow absolute -inset-3 rounded-full bg-accent/60 blur-md" />
                      <div className="unlock-item relative">
                        <UserAvatar avatar={{ ...base, [part]: it.value }} name={`new-${it.key}`} size={96} />
                      </div>
                      <span className="unlock-lock absolute inset-0 flex items-center justify-center">
                        <Padlock />
                      </span>
                    </div>
                    <span className="mt-2 text-xs font-extrabold text-ink-strong">{itemTitle(part, it.value)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {levelUp && upcoming.length > 0 && (
          <p className="mt-5 text-xs text-muted">
            На ниво {data.toLevel + 1}: {upcoming.map((u) => itemTitle(u.part, u.value)).join(', ')}
          </p>
        )}

        <div className="mt-6 grid gap-2">
          {data.items.length > 0 && (
            <Link
              href="/profile/avatar?new=1"
              onClick={close}
              className="btn3d rounded-2xl bg-secondary px-5 py-3 font-extrabold uppercase text-white [--btn-shadow:var(--color-secondary-dark)]"
            >
              Пробвай го
            </Link>
          )}
          <button onClick={close} className="btn3d rounded-2xl border-2 border-line bg-surface px-5 py-3 font-extrabold uppercase text-ink">
            Супер!
          </button>
        </div>
      </div>
    </div>
  );
}

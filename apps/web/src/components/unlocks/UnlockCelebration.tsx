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
import { ACHIEVEMENT_ICONS } from '@/app/(app)/profile/achievement-icons';
import './reward.css';

/** една стъпка от церемонията */
type Step = { kind: 'level' } | { kind: 'ach'; code: string } | { kind: 'more'; codes: string[] } | { kind: 'items' };

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
  const [at, setAt] = useState(0);
  /** преглед за админ: /?nagrada=1 — показва примерна церемония, без да записва нищо */
  const demo = useRef(false);
  const previewed = useRef(false);
  const busy = useRef(false);
  const path = usePathname();
  const router = useRouter();

  const check = useCallback(async () => {
    if (busy.current || data) return;
    busy.current = true;
    try {
      const preview = !previewed.current && new URLSearchParams(window.location.search).get('nagrada') === '1';
      if (preview) previewed.current = true;
      const c = preview
        ? { fromLevel: 4, toLevel: 5, achievements: ACHIEVEMENTS.slice(0, 2).map((a) => a.code), items: itemsForLevel(5).slice(0, 2).map((i) => ({ part: i.part, value: i.value, key: `${i.part}:${i.value}` })) }
        : await checkCelebrationAction();
      if (c) {
        demo.current = preview;
        setAt(0);
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

  // стъпките: ново ниво → постиженията едно по едно → новите части за аватара
  const steps: Step[] = [];
  if (data) {
    if (data.toLevel > data.fromLevel) steps.push({ kind: 'level' });
    data.achievements.slice(0, 4).forEach((code) => steps.push({ kind: 'ach', code }));
    if (data.achievements.length > 4) steps.push({ kind: 'more', codes: data.achievements.slice(4) });
    if (data.items.length) steps.push({ kind: 'items' });
  }
  const last = at >= steps.length - 1;

  const close = useCallback(() => {
    setData(null);
    if (demo.current) return router.replace(path);
    void ackCelebrationAction().then(() => router.refresh());
  }, [router, path]);
  const next = useCallback(() => {
    if (last) return close();
    setAt((n) => n + 1);
    play('unlock');
  }, [last, close]);

  useEffect(() => {
    if (!data) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [data, next, close]);

  if (!data || !steps.length) return null;
  const step = steps[Math.min(at, steps.length - 1)];
  const base = sanitizeAvatar(avatar, null, seed);
  const upcoming = itemsForLevel(data.toLevel + 1);
  const ach = step.kind === 'ach' ? ACHIEVEMENTS.find((a) => a.code === step.code) : null;
  const Icon = ach ? ACHIEVEMENT_ICONS[ach.icon] : null;
  const color = step.kind === 'level' ? '#ffb020' : step.kind === 'items' ? '#6ea2ff' : '#ffc93c';
  const achNo = step.kind === 'ach' ? data.achievements.indexOf(step.code) + 1 : 0;

  return (
    <div className="rw nx" style={{ '--c': color } as React.CSSProperties} role="dialog" aria-modal onClick={next}>
      <div className="rw-rays" />
      {step.kind !== 'items' && <Confetti key={at} />}
      {steps.length > 1 && !last && (
        <button
          className="rw-skip"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
        >
          Пропусни
        </button>
      )}

      <div key={at} className="rw-step">
        {step.kind === 'level' && (
          <>
            <p className="rw-kicker">Ново ниво</p>
            <div className="rw-level">
              <div className="ln-display">
                <span>{data.fromLevel}</span>
                <span>{data.toLevel}</span>
              </div>
              <i className="rw-shine" />
            </div>
            <h2 className="ln-display rw-title">Ниво {data.toLevel}!</h2>
            <p className="rw-text">Браво! Всеки тест и всяка игра те качват нагоре.</p>
            {upcoming.length > 0 && (
              <p className="rw-next">
                На ниво {data.toLevel + 1} те чака: {upcoming.map((u) => itemTitle(u.part, u.value)).join(', ')}
              </p>
            )}
          </>
        )}
        {step.kind === 'ach' && ach && Icon && (
          <>
            <p className="rw-kicker">{data.achievements.length > 1 ? `Постижение ${achNo} от ${data.achievements.length}` : 'Ново постижение'}</p>
            <div className="rw-medal">
              <Icon />
            </div>
            <h2 className="ln-display rw-title">{ach.name}</h2>
            <p className="rw-text">{ach.description}</p>
          </>
        )}
        {step.kind === 'more' && (
          <>
            <p className="rw-kicker">И още {step.codes.length}</p>
            <h2 className="ln-display rw-title">Още постижения</h2>
            <p className="rw-text">
              {step.codes
                .map((c) => ACHIEVEMENTS.find((a) => a.code === c)?.name)
                .filter(Boolean)
                .join(' · ')}
            </p>
          </>
        )}
        {step.kind === 'items' && (
          <>
            <p className="rw-kicker">За аватара</p>
            <h2 className="ln-display rw-title" style={{ animationDelay: '.15s' }}>
              Отключи {data.items.length > 1 ? 'нови неща' : 'нещо ново'}!
            </h2>
            <div className="rw-items">
              {data.items.map((it, i) => {
                const part = it.part as AvatarPart;
                return (
                  <div key={it.key} className="rw-item" style={{ ['--d' as string]: `${0.5 + i * 0.45}s` }}>
                    <div className="relative">
                      <span className="unlock-glow absolute -inset-3 rounded-full bg-accent/60 blur-md" />
                      <div className="unlock-item relative">
                        <UserAvatar avatar={{ ...base, [part]: it.value }} name={`new-${it.key}`} size={104} />
                      </div>
                      <span className="unlock-lock absolute inset-0 flex items-center justify-center">
                        <Padlock />
                      </span>
                    </div>
                    <small>{itemTitle(part, it.value)}</small>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div key={`f${at}`} className="rw-foot" onClick={(e) => e.stopPropagation()}>
        {step.kind === 'items' && last ? (
          <>
            <Link href="/profile/avatar?new=1" onClick={close} className="ln-btn ln-btn-primary">
              Пробвай го
            </Link>
            <button onClick={close} className="ln-btn ln-btn-ghost">
              По-късно
            </button>
          </>
        ) : (
          <button onClick={next} className="ln-btn ln-btn-primary" autoFocus>
            {last ? 'Супер!' : 'Продължи'}
          </button>
        )}
        {steps.length > 1 && (
          <div className="rw-dots">
            {steps.map((_, i) => (
              <i key={i} data-on={i === at} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

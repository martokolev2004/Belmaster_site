'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Gem, Lock, Shuffle } from 'lucide-react';
import {
  AVATAR_CREDIT,
  AVATAR_OPTIONS,
  AVATAR_PART_LABELS,
  FRAME_LABELS,
  isUnlocked,
  itemKey,
  lockOf,
  ruleText,
  type AvatarConfig,
  type AvatarPart,
  type FrameTier,
  type UnlockProgress,
} from '@belmaster/shared';
import { Button } from '@/components/ui';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { COLOR_PARTS, itemLabel, itemTitle } from '@/components/avatar/labels';
import { Padlock } from '@/components/unlocks/UnlockCelebration';
import { play } from '@/lib/sound';
import { cn } from '@/lib/cn';
import { buyItemAction, markSeenAction, saveAvatarAction } from './actions';

const TABS: AvatarPart[] = ['hair', 'hairColor', 'skinColor', 'eyes', 'eyebrows', 'mouth', 'glasses', 'earrings', 'features', 'extra', 'bg'];

export function AvatarEditor({
  initial,
  progress: initialProgress,
  newKeys,
  canBuy,
  frame,
  rating,
}: {
  initial: AvatarConfig;
  progress: UnlockProgress;
  newKeys: string[];
  canBuy: boolean;
  frame: FrameTier;
  rating: number | null;
}) {
  const params = useSearchParams();
  const [progress, setProgress] = useState(initialProgress);
  const [fresh, setFresh] = useState(() => new Set(newKeys));
  const [cfg, setCfg] = useState<AvatarConfig>(initial);
  const [tab, setTab] = useState<AvatarPart>(() => {
    if (params.get('new')) return TABS.find((t) => newKeys.some((k) => k.startsWith(`${t}:`))) ?? 'hair';
    return 'hair';
  });
  const [saved, setSaved] = useState(false);
  const [buying, setBuying] = useState<{ part: AvatarPart; value: string; price: number } | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const open = (part: AvatarPart, v: string) => isUnlocked(lockOf(part, v), progress, itemKey(part, v));

  const unlockedCount = useMemo(() => {
    let all = 0;
    let n = 0;
    for (const part of TABS)
      for (const v of AVATAR_OPTIONS[part])
        if (lockOf(part, v)) {
          all++;
          if (isUnlocked(lockOf(part, v), progress, itemKey(part, v))) n++;
        }
    return { all, open: n };
  }, [progress]);

  const see = (key: string) => {
    if (!fresh.has(key)) return;
    setFresh((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    void markSeenAction([key]);
  };

  const set = (part: AvatarPart, v: string) => {
    setSaved(false);
    see(itemKey(part, v));
    setCfg((c) => ({ ...c, [part]: v }));
  };

  const randomize = () => {
    setSaved(false);
    const next = { ...cfg };
    for (const part of TABS) {
      const free = AVATAR_OPTIONS[part].filter((v) => open(part, v));
      let pick = free[Math.floor(Math.random() * free.length)];
      if (['glasses', 'earrings', 'features', 'extra'].includes(part) && Math.random() < 0.6) pick = 'none';
      next[part] = pick;
    }
    setCfg(next);
  };

  const buy = () => {
    if (!buying) return;
    const key = itemKey(buying.part, buying.value);
    start(async () => {
      const res = await buyItemAction(key);
      if (!res.ok) {
        setBuyError(res.error ?? 'Грешка.');
        return;
      }
      setProgress((p) => ({ ...p, owned: [...p.owned, key], diamonds: res.diamonds ?? p.diamonds - buying.price }));
      setJustBought(key);
      setTimeout(() => play('unlock'), 900);
      setCfg((c) => ({ ...c, [buying.part]: buying.value }));
      setSaved(false);
      setBuying(null);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/profile" className="mb-4 inline-flex items-center gap-1 font-bold text-secondary">
        <ArrowLeft className="size-4" /> Профил
      </Link>
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <div className="card3d flex flex-col items-center rounded-3xl bg-surface p-5">
            <UserAvatar avatar={cfg} name="preview" size={220} frame={frame} />
            <p className="mt-3 text-sm font-bold text-muted">{FRAME_LABELS[frame]}{rating ? ` · рейтинг ${rating}` : ''}</p>
            <div className="mt-4 grid w-full gap-2">
              <Button
                block
                disabled={pending}
                icon={saved ? <Check className="size-5" /> : undefined}
                onClick={() =>
                  start(async () => {
                    await saveAvatarAction(cfg);
                    setSaved(true);
                    router.refresh();
                  })
                }
              >
                {saved ? 'Запазено' : pending ? 'Запазване…' : 'Запази'}
              </Button>
              <Button variant="outline" block onClick={randomize} icon={<Shuffle className="size-4" />}>
                Случаен
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-secondary/10 px-3 py-1.5 font-black text-secondary">
              <Gem className="size-5" /> {progress.diamonds} диаманта
            </p>
            <p className="mt-2 text-center text-xs font-bold text-muted">
              Отключени специални части: {unlockedCount.open} от {unlockedCount.all}
            </p>
            <p className="mt-2 text-center text-[11px] text-muted">1 💎 на всеки 1000 XP. Част с 🔒 ниво се отключва сама, част с 💎 се купува.</p>
          </div>
          <p className="mt-3 px-2 text-[11px] text-muted">Аватари: {AVATAR_CREDIT}.</p>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const dot = [...fresh].some((k) => k.startsWith(`${t}:`));
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn('relative rounded-xl border-2 px-3 py-1.5 text-sm font-extrabold', tab === t ? 'border-secondary bg-secondary/10 text-secondary' : 'border-line text-muted hover:bg-surface-2')}
                >
                  {AVATAR_PART_LABELS[t]}
                  {dot && <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-bg bg-error" aria-label="ново" />}
                </button>
              );
            })}
          </div>

          <div className={cn('grid gap-3', COLOR_PARTS.includes(tab) ? 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-7' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
            {AVATAR_OPTIONS[tab].map((v) => {
              const rule = lockOf(tab, v);
              const key = itemKey(tab, v);
              const isOpen = open(tab, v);
              const shop = !isOpen && rule?.kind === 'shop';
              const active = cfg[tab] === v;
              const isColor = COLOR_PARTS.includes(tab);
              const isNew = fresh.has(key);
              const anim = justBought === key;
              return (
                <button
                  key={v}
                  disabled={!isOpen && !shop}
                  onClick={() => {
                    if (isOpen) set(tab, v);
                    else if (shop && rule?.kind === 'shop') {
                      setBuyError(null);
                      setBuying({ part: tab, value: v, price: rule.price });
                    }
                  }}
                  title={isOpen ? itemLabel(tab, v) : shop ? `Купи за ${ruleText(rule!)}` : `Отключва се: ${ruleText(rule!)}`}
                  className={cn(
                    'card3d relative flex flex-col items-center gap-1 rounded-2xl bg-surface p-2 transition',
                    active && 'border-secondary! bg-secondary/10',
                    isOpen || shop ? 'hover:bg-surface-2' : 'cursor-not-allowed',
                  )}
                  style={anim ? { ['--d' as string]: '0s' } : undefined}
                >
                  <span className={cn('block', anim && 'unlock-item')}>
                    {isColor ? (
                      <span className={cn('block size-12 rounded-full border-2 border-black/10', !isOpen && 'opacity-40')} style={{ background: `#${v}` }} />
                    ) : (
                      <UserAvatar avatar={{ ...cfg, [tab]: v }} name={`opt-${tab}-${v}`} size={84} className={cn(!isOpen && 'opacity-35 grayscale')} />
                    )}
                  </span>
                  {!isColor && <span className="text-[11px] font-extrabold text-muted">{itemLabel(tab, v)}</span>}
                  {!isOpen && (
                    <span
                      className={cn(
                        'absolute inset-x-1 top-1/3 flex flex-col items-center rounded-lg px-1 py-1 text-[10px] font-extrabold leading-tight',
                        shop ? 'bg-secondary text-white' : 'bg-ink-strong/85 text-bg',
                      )}
                    >
                      {!shop && <Lock className="mb-0.5 size-3.5" />}
                      {ruleText(rule!)}
                    </span>
                  )}
                  {anim && (
                    <span className="unlock-lock pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Padlock />
                    </span>
                  )}
                  {isNew && <span className="absolute right-1.5 top-1.5 size-3 rounded-full border-2 border-surface bg-error" aria-label="ново" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {buying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal onClick={() => setBuying(null)}>
          <div className="animate-pop w-full max-w-sm rounded-3xl bg-surface p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <UserAvatar avatar={{ ...cfg, [buying.part]: buying.value }} name="buy-preview" size={140} className="mx-auto" />
            <h2 className="mt-3 text-xl font-black">{itemTitle(buying.part, buying.value)}</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-black text-secondary">
              <Gem className="size-5" /> {buying.price}
            </p>
            {!canBuy ? (
              <p className="mt-3 text-sm text-muted">Само за регистрирани профили.</p>
            ) : progress.diamonds < buying.price ? (
              <p className="mt-3 text-sm text-muted">
                Имаш {progress.diamonds} 💎 — трябват ти още {buying.price - progress.diamonds} (≈ {(buying.price - progress.diamonds) * 1000} XP).
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">След покупката ще имаш {progress.diamonds - buying.price} 💎.</p>
            )}
            {buyError && <p className="mt-2 text-sm font-bold text-error">{buyError}</p>}
            <div className="mt-5 grid gap-2">
              {canBuy && progress.diamonds >= buying.price && (
                <Button block disabled={pending} onClick={buy} icon={<Gem className="size-4" />}>
                  {pending ? 'Купуване…' : `Купи за ${buying.price}`}
                </Button>
              )}
              <Button variant="outline" block onClick={() => setBuying(null)}>
                Затвори
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

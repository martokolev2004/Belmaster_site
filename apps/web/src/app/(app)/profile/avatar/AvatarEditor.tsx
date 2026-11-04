'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Lock, Shuffle } from 'lucide-react';
import {
  AVATAR_CREDIT,
  AVATAR_OPTIONS,
  AVATAR_PART_LABELS,
  EXTRA_LABELS,
  FRAME_LABELS,
  isUnlocked,
  lockOf,
  ruleText,
  type AvatarConfig,
  type AvatarPart,
  type FrameTier,
  type UnlockProgress,
} from '@belmaster/shared';
import { Button } from '@/components/ui';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { cn } from '@/lib/cn';
import { saveAvatarAction } from './actions';

const TABS: AvatarPart[] = ['hair', 'hairColor', 'skinColor', 'eyes', 'eyebrows', 'mouth', 'glasses', 'earrings', 'features', 'extra', 'bg'];
const COLOR_PARTS: AvatarPart[] = ['hairColor', 'skinColor', 'bg'];
const FEATURE_LABELS: Record<string, string> = { none: 'Без', freckles: 'Лунички', birthmark: 'Бенка', blush: 'Руменина', mustache: 'Мустак' };

function label(part: AvatarPart, v: string) {
  if (part === 'extra') return EXTRA_LABELS[v] ?? v;
  if (part === 'features') return FEATURE_LABELS[v] ?? v;
  if (v === 'none') return 'Без';
  if (part === 'hair') return v.replace('short', 'Къса ').replace('long', 'Дълга ');
  return v.replace('variant', '');
}

export function AvatarEditor({ initial, progress, frame, rating }: { initial: AvatarConfig; progress: UnlockProgress; frame: FrameTier; rating: number | null }) {
  const [cfg, setCfg] = useState<AvatarConfig>(initial);
  const [tab, setTab] = useState<AvatarPart>('hair');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const unlockedCount = useMemo(() => {
    let all = 0;
    let open = 0;
    for (const part of TABS)
      for (const v of AVATAR_OPTIONS[part]) {
        const r = lockOf(part, v);
        if (r) {
          all++;
          if (isUnlocked(r, progress)) open++;
        }
      }
    return { all, open };
  }, [progress]);

  const set = (part: AvatarPart, v: string) => {
    setSaved(false);
    setCfg((c) => ({ ...c, [part]: v }));
  };

  const randomize = () => {
    setSaved(false);
    const next = { ...cfg };
    for (const part of TABS) {
      const free = AVATAR_OPTIONS[part].filter((v) => isUnlocked(lockOf(part, v), progress));
      let pick = free[Math.floor(Math.random() * free.length)];
      if (['glasses', 'earrings', 'features', 'extra'].includes(part) && Math.random() < 0.6) pick = 'none';
      next[part] = pick;
    }
    setCfg(next);
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
            <p className="mt-4 text-center text-xs font-bold text-muted">
              Отключени специални части: {unlockedCount.open} от {unlockedCount.all}
            </p>
          </div>
          <p className="mt-3 px-2 text-[11px] text-muted">Аватари: {AVATAR_CREDIT}.</p>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('rounded-xl border-2 px-3 py-1.5 text-sm font-extrabold', tab === t ? 'border-secondary bg-secondary/10 text-secondary' : 'border-line text-muted hover:bg-surface-2')}
              >
                {AVATAR_PART_LABELS[t]}
              </button>
            ))}
          </div>

          <div className={cn('grid gap-3', COLOR_PARTS.includes(tab) ? 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-7' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
            {AVATAR_OPTIONS[tab].map((v) => {
              const rule = lockOf(tab, v);
              const open = isUnlocked(rule, progress);
              const active = cfg[tab] === v;
              const isColor = COLOR_PARTS.includes(tab);
              return (
                <button
                  key={v}
                  disabled={!open}
                  onClick={() => set(tab, v)}
                  title={open ? label(tab, v) : `Отключва се: ${ruleText(rule!)}`}
                  className={cn(
                    'card3d relative flex flex-col items-center gap-1 rounded-2xl bg-surface p-2 transition',
                    active && 'border-secondary! bg-secondary/10',
                    open ? 'hover:bg-surface-2' : 'cursor-not-allowed',
                  )}
                >
                  {isColor ? (
                    <span className="block size-12 rounded-full border-2 border-black/10" style={{ background: `#${v}` }} />
                  ) : (
                    <UserAvatar avatar={{ ...cfg, [tab]: v }} name={`opt-${tab}-${v}`} size={84} className={cn(!open && 'opacity-35 grayscale')} />
                  )}
                  {!isColor && <span className="text-[11px] font-extrabold text-muted">{label(tab, v)}</span>}
                  {!open && (
                    <span className="absolute inset-x-1 top-1/3 flex flex-col items-center rounded-lg bg-ink-strong/85 px-1 py-1 text-[10px] font-extrabold leading-tight text-bg">
                      <Lock className="mb-0.5 size-3.5" />
                      {ruleText(rule!)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

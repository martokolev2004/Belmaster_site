import { cn } from '@/lib/cn';
import type { ComponentProps, ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ className, tone = 'gray', ...rest }: ComponentProps<'span'> & { tone?: 'gray' | 'green' | 'blue' | 'yellow' | 'red' | 'purple' }) {
  const tones = {
    gray: 'bg-surface-2 text-muted',
    green: 'bg-primary/15 text-primary-dark',
    blue: 'bg-secondary/15 text-secondary-dark',
    yellow: 'bg-accent/20 text-[#8a6500]',
    red: 'bg-error/15 text-error-dark',
    purple: 'bg-purple/20 text-purple-dark',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold', tones[tone], className)} {...rest} />;
}

export function ProgressBar({ value, className, color = 'bg-primary' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn('h-4 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cn('relative h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }}>
        <div className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card3d flex flex-col items-center rounded-2xl bg-surface px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="text-lg font-extrabold text-ink-strong">{title}</p>
      {children && <div className="mt-2 max-w-md text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-2xl border-2 border-line bg-surface-2 px-4 py-3 text-ink placeholder:text-muted focus:border-secondary focus:outline-none';

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(inputBase, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputBase, 'min-h-28', className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select className={cn(inputBase, 'appearance-auto', className)} {...rest} />;
}

export function Avatar({ name, color, size = 40, className }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-black text-white', className)}
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

export function Alert({ tone = 'red', children }: { tone?: 'red' | 'green' | 'blue'; children: ReactNode }) {
  const tones = {
    red: 'border-error/40 bg-error/10 text-error-dark',
    green: 'border-primary/40 bg-primary/10 text-primary-dark',
    blue: 'border-secondary/40 bg-secondary/10 text-secondary-dark',
  };
  return <div className={cn('rounded-2xl border-2 px-4 py-3 text-sm font-bold', tones[tone])}>{children}</div>;
}

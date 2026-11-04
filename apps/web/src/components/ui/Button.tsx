import { cn } from '@/lib/cn';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'outline' | 'ghost' | 'purple';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white [--btn-shadow:var(--color-primary-dark)] hover:brightness-105',
  secondary: 'bg-secondary text-white [--btn-shadow:var(--color-secondary-dark)] hover:brightness-105',
  accent: 'bg-accent text-[#4b3b00] [--btn-shadow:var(--color-accent-dark)] hover:brightness-105',
  danger: 'bg-error text-white [--btn-shadow:var(--color-error-dark)] hover:brightness-105',
  purple: 'bg-purple text-white [--btn-shadow:var(--color-purple-dark)] hover:brightness-105',
  outline: 'bg-surface text-secondary border-2 border-line [--btn-shadow:var(--line)] hover:bg-surface-2',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 shadow-none!',
};

const sizes = {
  sm: 'h-10 px-4 text-sm rounded-xl',
  md: 'h-12 px-5 text-[15px] rounded-2xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
};

interface Common {
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

function classes({ variant = 'primary', size = 'md', block, className }: Common) {
  return cn(
    'btn3d inline-flex select-none items-center justify-center gap-2 font-extrabold uppercase tracking-wide cursor-pointer',
    'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  );
}

export function Button({ variant, size, block, icon, className, children, ...rest }: Common & ComponentProps<'button'>) {
  return (
    <button className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

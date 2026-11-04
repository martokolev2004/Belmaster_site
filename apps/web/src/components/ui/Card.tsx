import { cn } from '@/lib/cn';
import type { ComponentProps } from 'react';

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('card3d rounded-2xl bg-surface p-5', className)} {...rest} />;
}

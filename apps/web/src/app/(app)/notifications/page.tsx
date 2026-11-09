import Link from 'next/link';
import { Bell } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { EmptyState, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MarkRead } from './MarkRead';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Известия' };

export default async function NotificationsPage() {
  const user = await requireUser({ allowNoGrade: true });
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 });
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Известия" />
      {unread && <MarkRead />}
      {items.length === 0 ? (
        <EmptyState title="Нямаш известия" icon={<Bell className="size-12" />} />
      ) : (
        <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
          {items.map((n) => {
            const inner = (
              <div className={cn('flex gap-3 px-4 py-3', !n.readAt && 'bg-secondary/8')}>
                {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-error" />}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-ink-strong">{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted">{n.createdAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-surface-2">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

import { prisma } from '@/lib/db';
import { Badge, EmptyState } from '@/components/ui';

export const metadata = { title: 'Имейли' };

/** Последните изпратени (или неизпратени, докато няма SMTP) имейли — с линковете в тях. */
export default async function MailPage() {
  const rows = await prisma.mailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const smtp = !!process.env.SMTP_HOST;
  return (
    <div className="space-y-4">
      {!smtp && (
        <p className="rounded-2xl bg-accent/15 p-3 text-sm font-bold">
          Няма настроен SMTP — имейлите не се изпращат, само се записват тук. Линковете може да ги пратиш ръчно.
        </p>
      )}
      {!rows.length ? (
        <EmptyState title="Още няма имейли" />
      ) : (
        <ul className="card3d divide-y-2 divide-line rounded-2xl bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.status === 'sent' ? 'green' : r.status === 'error' ? 'red' : 'gray'}>{r.status}</Badge>
                <span className="font-bold">{r.to}</span>
                <span className="text-muted">{r.createdAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}</span>
              </div>
              <p className="font-extrabold text-ink-strong">{r.subject}</p>
              {r.link && <p className="break-all font-mono text-xs text-secondary">{r.link}</p>}
              {r.error && <p className="text-xs text-error">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

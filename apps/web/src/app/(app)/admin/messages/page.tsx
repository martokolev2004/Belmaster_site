import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/ui';

export const metadata = { title: 'Съобщения' };

/** Съобщенията от страницата „Контакти“. */
export default async function MessagesPage() {
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  await prisma.contactMessage.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  if (!rows.length) return <EmptyState title="Няма съобщения" />;
  return (
    <ul className="space-y-3">
      {rows.map((m) => (
        <li key={m.id} className={`card3d rounded-2xl bg-surface p-4 ${m.readAt ? '' : 'ring-2 ring-secondary'}`}>
          <p className="font-extrabold text-ink-strong">{m.subject}</p>
          <p className="text-sm text-muted">
            {m.name} · <a className="text-secondary underline" href={`mailto:${m.email}`}>{m.email}</a> · {m.createdAt.toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}
          </p>
          <p className="mt-2 whitespace-pre-wrap">{m.message}</p>
        </li>
      ))}
    </ul>
  );
}

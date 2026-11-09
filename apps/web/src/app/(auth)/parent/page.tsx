import Link from 'next/link';
import { consumeToken } from '@/lib/email-tokens';
import { ParentForm } from './ParentForm';

export const metadata = { title: 'Съгласие на родител' };
export const dynamic = 'force-dynamic';

export default async function ParentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ? await consumeToken(token, 'parent', false) : null;
  if (!t)
    return (
      <div className="animate-rise text-center">
        <p className="text-6xl">⚠️</p>
        <h1 className="mt-2 text-3xl font-black">Линкът не е валиден</h1>
        <p className="mt-2 text-muted">Изтекъл е или вече е използван. Детето може да изпрати нов от профила си.</p>
      </div>
    );
  return (
    <div className="animate-rise">
      <h1 className="mb-2 text-3xl font-black">Съгласие на родител</h1>
      <div className="space-y-3 text-ink">
        <p>
          Вашето дете си е направило профил <b>„{t.user.displayName}“</b> в БЕЛ Мастер — безплатен сайт за подготовка за матурите по български език и литература.
        </p>
        <p>Събираме само нужното за работата на сайта: име (псевдоним), имейл, дата на раждане и резултатите от тестовете и игрите. Не показваме реклами, не продаваме данни и не ги даваме на трети лица. Другите потребители виждат само името и аватара на детето в класациите.</p>
        <p>
          Подробности:{' '}
          <Link href="/privacy" target="_blank" className="font-bold text-secondary underline">политика за поверителност</Link> и{' '}
          <Link href="/terms" target="_blank" className="font-bold text-secondary underline">общи условия</Link>. Можете да оттеглите съгласието и да поискате изтриване на профила по всяко време.
        </p>
      </div>
      <div className="mt-6">
        <ParentForm token={token!} />
      </div>
    </div>
  );
}

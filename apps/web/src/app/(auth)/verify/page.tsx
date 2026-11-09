import { ButtonLink } from '@/components/ui';
import { prisma } from '@/lib/db';
import { consumeToken } from '@/lib/email-tokens';

export const metadata = { title: 'Потвърждение на имейл' };
export const dynamic = 'force-dynamic';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = token ? await consumeToken(token, 'verify') : null;
  const ok = !!t && t.email === t.user.email;
  if (ok) await prisma.user.update({ where: { id: t!.userId }, data: { emailVerifiedAt: new Date() } });
  return (
    <div className="animate-rise text-center">
      <p className="text-6xl">{ok ? '✅' : '⚠️'}</p>
      <h1 className="mt-2 text-3xl font-black">{ok ? 'Имейлът е потвърден!' : 'Линкът не е валиден'}</h1>
      <p className="mt-2 text-muted">{ok ? 'Благодарим. Вече можеш да възстановиш паролата си, ако я забравиш.' : 'Линкът е изтекъл или вече е използван. Поискай нов от профила си.'}</p>
      <ButtonLink href="/" className="mt-6">
        Към сайта
      </ButtonLink>
    </div>
  );
}

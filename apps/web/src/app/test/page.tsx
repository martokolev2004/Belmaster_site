import Link from 'next/link';
import '@fontsource-variable/unbounded';
import '@/components/shell/nx.css';
import '@/components/landing/landing-next.css';
import { getCurrentUser } from '@/lib/auth';
import { ClimbStageDemo } from '@/components/climb/ClimbStage';

export const metadata = { title: 'Към върха — нов вид (тест)', robots: { index: false } };

/** Тестова страница: нов вид на „Към върха“. Истинската игра не е пипана. */
export default async function TestPage() {
  const user = await getCurrentUser();
  return (
    <div className="nx min-h-dvh">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <Link href="/climb" className="text-sm font-bold text-secondary">← Към върха</Link>
        <p className="ln-eyebrow mt-4">Тест · нов вид</p>
        <h1 className="ln-display nx-h1 mb-5">
          Към <span className="ln-grad">върха</span>
        </h1>
        <ClimbStageDemo avatar={user?.avatar ?? null} seed={user?.id ?? 'guest'} name={user && !user.isGuest ? user.displayName.split(' ')[0] : 'Ти'} />
      </div>
    </div>
  );
}

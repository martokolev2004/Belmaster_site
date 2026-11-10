import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Climb3DDemo } from '@/components/climb/Climb3DDemo';

export const metadata = { title: 'Към върха — 3D тест' };

/** Тестова страница: 3D планина за „Към върха“ (без въпроси, без рейтинг). */
export default async function Climb3DPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/climb" className="mb-2 inline-block font-bold text-secondary">← Към върха</Link>
      <h1 className="text-2xl font-black">Към върха — 3D тест</h1>
      <p className="mb-3 text-sm text-muted">Пробен изглед: героите се качват, целят се и падат сами, без въпроси и без точки.</p>
      <Climb3DDemo />
    </div>
  );
}

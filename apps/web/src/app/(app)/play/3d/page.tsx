import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Battle3DDemo } from '@/components/game/Battle3DDemo';

export const metadata = { title: 'Битка — 3D тест' };

/** Тестова страница: 3D карта за битката (без въпроси, без рейтинг). */
export default async function Battle3DPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/play" className="mb-2 inline-block font-bold text-secondary">← Битка</Link>
      <h1 className="text-2xl font-black">Битка — 3D тест</h1>
      <p className="mb-3 text-sm text-muted">Пробен изглед на картата: областите се завладяват сами, без въпроси и без точки.</p>
      <Battle3DDemo />
    </div>
  );
}

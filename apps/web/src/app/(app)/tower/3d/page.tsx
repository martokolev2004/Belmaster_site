import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Tower3DDemo } from '@/components/tower/Tower3DDemo';

export const metadata = { title: 'Кула на Словото — 3D тест' };

/** Тестова страница: 3D изглед на кулата (без въпроси, без XP). */
export default async function Tower3DPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/tower" className="mb-2 inline-block font-bold text-secondary">← Кула на Словото</Link>
      <h1 className="text-2xl font-black">Кула на Словото — 3D тест</h1>
      <p className="mb-3 text-sm text-muted">Пробен изглед: само строенето, без въпроси и без точки. Правилата за пускане са същите като в играта.</p>
      <Tower3DDemo />
    </div>
  );
}

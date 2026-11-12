import '@fontsource-variable/unbounded';
import '@/components/shell/nx.css';
import '@/components/landing/landing-next.css';
import './tower-test.css';
import Link from 'next/link';
import { TowerStageDemo } from '@/components/tower/TowerStage';

export const metadata = { title: 'Кула на Словото — тест', robots: { index: false } };

/** Пробен изглед на „Кула на Словото“ — без въпроси и без точки. Истинската игра е на /tower. */
export default function TowerTestPage() {
  return (
    <div className="nx twg-page">
      <Link href="/tower" className="twg-back">← Сегашната кула</Link>
      <TowerStageDemo />
    </div>
  );
}

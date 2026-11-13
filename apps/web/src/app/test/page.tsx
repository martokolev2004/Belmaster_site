import '@fontsource-variable/unbounded';
import '@/components/shell/nx.css';
import '@/components/landing/landing-next.css';
import { BattleStageDemo } from '@/components/game/BattleStageDemo';

export const metadata = { title: 'Битка — тест', robots: { index: false } };

/** Пробен изглед на картата за „Битка“. Истинската игра е на /play и не е пипана. */
export default function BattleTestPage() {
  return (
    <div className="nx min-h-dvh">
      <BattleStageDemo />
    </div>
  );
}

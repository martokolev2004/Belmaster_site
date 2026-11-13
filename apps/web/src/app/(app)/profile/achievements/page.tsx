import Link from 'next/link';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, type AchievementCategory } from '@belmaster/shared';
import { achievementMetrics } from '@belmaster/db';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ACHIEVEMENT_ICONS as ICONS } from '../achievement-icons';

export const metadata = { title: 'Постижения' };

/** Всички постижения — отключени и предстоящи, с напредъка към всяко. */
export default async function AchievementsPage() {
  const user = await requireUser();
  const [achievements, metrics] = await Promise.all([prisma.userAchievement.findMany({ where: { userId: user.id } }), achievementMetrics(prisma, user.id)]);
  const unlocked = new Set(achievements.map((a) => a.code));
  return (
    <div className="pf">
      <Link href="/profile" className="pf-more">← Профил</Link>
      <section className="nx-panel pf-box">
        <header>
          <h1 className="ln-display" style={{ fontSize: '1.5rem' }}>Всички постижения</h1>
          <span className="pf-more">{unlocked.size} от {ACHIEVEMENTS.length}</span>
        </header>
        {(Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[]).map((cat) => (
          <div key={cat} className="mt-4">
            <h3 className="pf-cat">{ACHIEVEMENT_CATEGORIES[cat]}</h3>
            <div className="pf-ach">
              {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                const Icon = ICONS[a.icon];
                const on = unlocked.has(a.code);
                const cur = a.metric ? Math.min(metrics[a.metric], a.goal ?? 0) : 0;
                return (
                  <div key={a.code} data-on={on}>
                    <span className="pf-badge"><Icon className="size-5" /></span>
                    <span className="min-w-0">
                      <b>{a.name}</b>
                      <small>{a.description}</small>
                      {!on && a.metric && a.goal && a.goal > 1 && (
                        <span className="pf-prog">
                          <span className="nx-bar"><i style={{ width: `${(cur / a.goal) * 100}%` }} /></span>
                          {cur}/{a.goal}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

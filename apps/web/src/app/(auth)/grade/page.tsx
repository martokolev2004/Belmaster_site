import { redirect } from 'next/navigation';
import { GRADES } from '@belmaster/shared';
import { getCurrentUser } from '@/lib/auth';
import { setGradeAction } from '../actions';

export const metadata = { title: 'Избери клас' };

const DESC: Record<string, string> = {
  G7: 'Национално външно оценяване след 7. клас',
  G10: 'Национално външно оценяване след 10. клас',
  G12: 'Държавен зрелостен изпит по БЕЛ',
};

export default async function GradePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { next } = await searchParams;
  return (
    <div className="animate-rise">
      <h1 className="mb-1 text-3xl font-black">За кой изпит се готвиш?</h1>
      <p className="mb-8 text-muted">Въпросите и съперниците в битките са само от твоя клас. Можеш да смениш класа от профила.</p>
      <div className="space-y-3">
        {GRADES.map((g) => (
          <form key={g.code} action={setGradeAction}>
            <input type="hidden" name="grade" value={g.code} />
            <input type="hidden" name="next" value={next ?? '/'} />
            <button
              type="submit"
              className="card3d flex w-full items-center gap-4 rounded-2xl bg-surface p-5 text-left transition hover:border-secondary hover:bg-secondary/5"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-black text-primary">
                {g.num}
              </span>
              <span>
                <span className="block text-lg font-extrabold text-ink-strong">{g.label}</span>
                <span className="block text-sm text-muted">{DESC[g.code]}</span>
              </span>
              {user.grade === g.code && <span className="ml-auto text-sm font-extrabold text-primary">Текущ</span>}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

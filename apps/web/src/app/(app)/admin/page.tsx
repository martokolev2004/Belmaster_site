import Link from 'next/link';
import { GRADES, SECTION_LABELS } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui';

export const metadata = { title: 'Админ' };

export default async function AdminHome() {
  const [byGrade, works, exams, reports, users, matches, drafts] = await Promise.all([
    prisma.question.groupBy({ by: ['grade', 'section'], where: { status: 'ACTIVE' }, _count: true }),
    prisma.work.groupBy({ by: ['grade'], _count: true }),
    prisma.exam.count(),
    prisma.questionReport.count({ where: { status: 'OPEN' } }),
    prisma.user.count({ where: { isGuest: false } }),
    prisma.match.count(),
    prisma.question.count({ where: { status: 'DRAFT' } }),
  ]);
  const n = (g: string, s: string) => byGrade.find((b) => b.grade === g && b.section === s)?._count ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Потребители" value={users} />
        <Stat label="Битки" value={matches} />
        <Stat label="Матури" value={exams} />
        <Stat label="Непроверени" value={drafts} href="/admin/questions?status=DRAFT" />
        <Stat label="Отворени доклади" value={reports} href="/admin/reports" highlight={reports > 0} />
      </div>
      <Card>
        <h2 className="mb-3 text-lg font-black">Съдържание по клас (активни въпроси)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">Клас</th>
                {Object.values(SECTION_LABELS).map((l) => (
                  <th key={l}>{l}</th>
                ))}
                <th>Произведения</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {GRADES.map((g) => (
                <tr key={g.code} className="border-t-2 border-line">
                  <td className="py-2">{g.label}</td>
                  {Object.keys(SECTION_LABELS).map((s) => (
                    <td key={s}>
                      <Link className="text-secondary hover:underline" href={`/admin/questions?grade=${g.code}&section=${s}`}>
                        {n(g.code, s)}
                      </Link>
                    </td>
                  ))}
                  <td>
                    <Link className="text-secondary hover:underline" href={`/admin/works?grade=${g.code}`}>
                      {works.find((w) => w.grade === g.code)?._count ?? 0}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const inner = (
    <div className={`card3d rounded-2xl bg-surface p-4 ${highlight ? 'border-error!' : ''}`}>
      <p className="text-xs font-extrabold uppercase text-muted">{label}</p>
      <p className="text-3xl font-black text-ink-strong">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

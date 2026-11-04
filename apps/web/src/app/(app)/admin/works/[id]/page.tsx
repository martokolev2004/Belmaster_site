import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GRADES, isGrade } from '@belmaster/shared';
import { prisma } from '@/lib/db';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { deleteWorkAction, saveWorkAction } from '../../actions';

const LONG = [
  { k: 'summary', l: 'Резюме' },
  { k: 'themes', l: 'Теми, идеи и послания' },
  { k: 'characters', l: 'Герои' },
  { k: 'authorInfo', l: 'За автора' },
  { k: 'quotes', l: 'Ключови цитати (по един на ред)' },
  { k: 'extra', l: 'Бележки' },
] as const;

export default async function EditWork({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ grade?: string; saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const w = id === 'new' ? null : await prisma.work.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } });
  if (id !== 'new' && !w) notFound();
  const grade = w?.grade ?? (isGrade(sp.grade) ? sp.grade : 'G12');
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/admin/works?grade=${grade}`} className="mb-4 inline-block font-bold text-secondary">
        ← Към произведенията
      </Link>
      {sp.saved && (
        <div className="mb-4">
          <Alert tone="green">Запазено.</Alert>
        </div>
      )}
      <form action={saveWorkAction} className="space-y-4">
        <input type="hidden" name="id" value={w?.id ?? 'new'} />
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label="Заглавие">
            <Input name="title" defaultValue={w?.title} required />
          </Field>
          <Field label="Автор">
            <Input name="author" defaultValue={w?.author} required />
          </Field>
          <Field label="Клас">
            <Select name="grade" defaultValue={grade}>
              {GRADES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Епоха / направление">
            <Input name="period" defaultValue={w?.period ?? ''} />
          </Field>
          <Field label="Жанр">
            <Input name="genre" defaultValue={w?.genre ?? ''} />
          </Field>
          <Field label="Година">
            <Input name="year" defaultValue={w?.year ?? ''} />
          </Field>
          <Field label="Подредба">
            <Input name="sortOrder" type="number" defaultValue={w?.sortOrder ?? 0} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 font-bold">
            <input type="checkbox" name="published" defaultChecked={w?.published ?? true} className="size-5 accent-primary" /> Видимо в библиотеката
          </label>
        </Card>
        <Card className="space-y-4">
          {LONG.map(({ k, l }) => (
            <Field key={k} label={l}>
              <Textarea name={k} defaultValue={(w?.[k] as string | null) ?? ''} className="min-h-32" />
            </Field>
          ))}
        </Card>
        <Button type="submit" size="lg">
          Запази
        </Button>
      </form>
      {w && (
        <div className="mt-6 flex items-center justify-between">
          <Link href={`/admin/questions?work=${w.id}`} className="font-bold text-secondary">
            Въпроси за произведението ({w._count.questions}) →
          </Link>
          <form action={deleteWorkAction}>
            <input type="hidden" name="id" value={w.id} />
            <button className="font-extrabold text-error">Изтрий</button>
          </form>
        </div>
      )}
    </div>
  );
}

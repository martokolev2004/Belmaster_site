import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui';
import { savePassageAction } from '../../actions';

export default async function EditPassage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const p = await prisma.passage.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <form action={savePassageAction} className="mx-auto max-w-3xl space-y-4">
      {saved && <Alert tone="green">Запазено.</Alert>}
      <input type="hidden" name="id" value={p.id} />
      <Card className="space-y-4">
        <Field label="Заглавие">
          <Input name="title" defaultValue={p.title ?? ''} />
        </Field>
        <Field label="Текст">
          <Textarea name="text" defaultValue={p.text} className="min-h-96" />
        </Field>
      </Card>
      <Button type="submit">Запази</Button>
    </form>
  );
}

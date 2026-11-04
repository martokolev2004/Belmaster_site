import { ImportForm } from './ImportForm';

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-muted">
        Импорт на матура или набор от въпроси във формата от <code className="rounded bg-surface-2 px-1">data/questions/README.md</code>. Повторен импорт на същата матура (клас + година + сесия) <b>замества</b> старите ѝ въпроси.
      </p>
      <ImportForm />
    </div>
  );
}

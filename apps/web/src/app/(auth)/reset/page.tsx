import { ResetForm } from './ResetForm';

export const metadata = { title: 'Нова парола' };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="animate-rise">
      <h1 className="mb-6 text-3xl font-black">Нова парола</h1>
      <ResetForm token={token ?? ''} />
    </div>
  );
}

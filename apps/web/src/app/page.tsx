import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { Dashboard } from './Dashboard';
import { Landing } from './Landing';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  if (!user.grade) redirect('/grade');
  return (
    <AppShell user={user}>
      <Dashboard user={user} />
    </AppShell>
  );
}

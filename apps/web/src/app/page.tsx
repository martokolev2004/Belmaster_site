import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { Dashboard } from './Dashboard';
import { LandingNext } from '@/components/landing/LandingNext';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <LandingNext />;
  if (!user.isGuest && (!user.birthDate || !user.termsAcceptedAt)) redirect('/welcome');
  if (!user.grade) redirect('/grade');
  return (
    <AppShell user={user}>
      <Dashboard user={user} />
    </AppShell>
  );
}

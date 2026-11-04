import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForms } from './AuthForms';

export const metadata = { title: 'Вход' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && !user.isGuest) redirect(sp.next ?? '/');
  return (
    <AuthForms
      next={sp.next ?? '/'}
      initialTab={sp.tab === 'register' || user?.isGuest ? 'register' : 'login'}
      googleEnabled={!!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET}
      error={sp.error}
      isGuest={!!user?.isGuest}
    />
  );
}

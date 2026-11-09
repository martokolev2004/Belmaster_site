import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/shell/AppShell';
import { PublicShell } from '@/components/shell/PublicShell';

/** Библиотеката е публична: влезлите я виждат в приложението, останалите (и търсачките) — в публична обвивка. */
export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const ready = user && user.grade && (user.isGuest || (user.birthDate && user.termsAcceptedAt));
  return ready ? <AppShell user={user}>{children}</AppShell> : <PublicShell>{children}</PublicShell>;
}

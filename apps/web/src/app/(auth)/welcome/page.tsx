import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { WelcomeForm } from './WelcomeForm';

export const metadata = { title: 'Още една стъпка' };

export default async function WelcomePage() {
  const user = await requireUser({ allowNoGrade: true, allowIncomplete: true });
  if (user.isGuest || (user.birthDate && user.termsAcceptedAt)) redirect('/');
  return (
    <div className="animate-rise">
      <h1 className="mb-1 text-3xl font-black">Още една стъпка, {user.displayName}</h1>
      <p className="mb-6 text-muted">Обновихме правилата на сайта. Попълни датата си на раждане и приеми условията, за да продължиш. Отнема 10 секунди.</p>
      <WelcomeForm />
    </div>
  );
}

import { getCurrentUser } from '@/lib/auth';
import { OWNER } from '../info';
import { ContactForm } from './ContactForm';

export const metadata = { title: 'Контакти' };

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <article>
      <h1>Контакти</h1>
      <p>Имаш въпрос, откри грешка или искаш да подадеш сигнал? Пиши ни тук или на <b>{OWNER.email}</b>.</p>
      <p className="text-sm text-muted">
        За грешка във въпрос най-бързо е бутонът „Докладвай въпроса“ под него, а за потребител — знаменцето 🚩 до името му. Искания за личните данни (достъп, поправка, изтриване) отговаряме до един месец.
      </p>
      <ContactForm name={user && !user.isGuest ? user.displayName : undefined} email={user?.email ?? undefined} />
    </article>
  );
}

import { ForgotForm } from './ForgotForm';

export const metadata = { title: 'Забравена парола' };

export default function ForgotPage() {
  return (
    <div className="animate-rise">
      <h1 className="mb-1 text-3xl font-black">Забравена парола</h1>
      <p className="mb-6 text-muted">Въведи имейла на профила си — ще ти изпратим линк за нова парола.</p>
      <ForgotForm />
    </div>
  );
}

import { requireAdmin } from '@/lib/auth';
import { AdminNav } from './AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-black">Админ панел</h1>
      <AdminNav />
      {children}
    </div>
  );
}

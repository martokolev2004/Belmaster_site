import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'БЕЛ Мастер', template: '%s · БЕЛ Мастер' },
  description: 'Подготовка за матурите по български език и литература — тестове, библиотека и мултиплейър битки.',
  // добавен към началния екран на iPhone — отваря се без лентите на Safari
  appleWebApp: { capable: true, title: 'БЕЛ Мастер', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#131f24' },
    { media: '(prefers-color-scheme: dark)', color: '#131f24' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('bm_theme')?.value;
  // по подразбиране — тъмна; „Системна“ се пази като 'system'
  const dataTheme = theme === 'light' ? 'light' : theme === 'system' ? undefined : 'dark';
  return (
    <html lang="bg" data-theme={dataTheme}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

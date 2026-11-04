import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'БЕЛ Мастер', template: '%s · БЕЛ Мастер' },
  description: 'Подготовка за матурите по български език и литература — тестове, библиотека и мултиплейър битки.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131f24' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('bm_theme')?.value;
  const dataTheme = theme === 'light' || theme === 'dark' ? theme : undefined;
  return (
    <html lang="bg" data-theme={dataTheme}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

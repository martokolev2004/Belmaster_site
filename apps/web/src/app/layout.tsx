import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'https://belmaster.eu'),
  title: { default: 'БЕЛ Мастер — български език и литература като игра', template: '%s · БЕЛ Мастер' },
  description: 'Български език и литература като игра: образователни игри, тестове и библиотека с произведенията. Безплатно, за 7., 10. и 12. клас.',
  applicationName: 'БЕЛ Мастер',
  openGraph: { siteName: 'БЕЛ Мастер', locale: 'bg_BG', type: 'website' },
  ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : {} } }
    : {}),
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

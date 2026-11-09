import type { MetadataRoute } from 'next';

/** Позволяваме на търсачките и на AI търсачките (ChatGPT, Claude, Perplexity, Gemini…) да четат публичните страници. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? 'https://belmaster.eu';
  const disallow = ['/admin', '/api/', '/profile', '/play', '/match', '/climb', '/tower', '/tests', '/exams', '/friends', '/class', '/teacher', '/notifications', '/stats', '/league', '/leaderboard', '/welcome', '/verify', '/reset', '/parent', '/grade'];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

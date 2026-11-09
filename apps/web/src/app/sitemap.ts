import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? 'https://belmaster.eu';
  const works = await prisma.work.findMany({ where: { published: true }, select: { title: true, updatedAt: true } });
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/library`, changeFrequency: 'weekly', priority: 0.9 },
    ...works.map((w) => ({ url: `${base}/library/${slugify(w.title)}`, lastModified: w.updatedAt, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${base}/contact`, priority: 0.3 },
    { url: `${base}/privacy`, priority: 0.2 },
    { url: `${base}/terms`, priority: 0.2 },
  ];
}

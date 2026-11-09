// Импорт на един файл: npm run import:questions -- data/questions/12-klas/2023-mai.json
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from './index';
import { importQuestions } from './importer';

async function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!files.length) throw new Error('Подай път до JSON файл.');
  for (const f of files) {
    const abs = path.resolve(process.env.INIT_CWD ?? process.cwd(), f);
    const r = await importQuestions(prisma, JSON.parse(readFileSync(abs, 'utf8')), { force: process.argv.includes('--force') });
    if (r.skipped) {
      console.log(`${f}: без промяна — пропуснат (добави --force за повторен импорт)`);
      continue;
    }
    console.log(`${f}: ${r.examTitle ?? ''} → ${r.created} въпроса (заменени ${r.replaced})`);
    for (const w of r.warnings) console.log('  ⚠', w);
    for (const w of r.worksCreated) console.log('  + произведение', w);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

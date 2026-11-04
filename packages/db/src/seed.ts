// Зарежда началните данни: произведенията (data/works) и всички въпроси (data/questions).
// С флаг --demo зарежда и демо въпросите (data/demo).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './index';
import { importQuestions, importWorks } from './importer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonFiles(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

async function main() {
  const withDemo = process.argv.includes('--demo') || process.env.SEED_DEMO === '1';
  for (const f of jsonFiles(path.join(root, 'works'))) {
    const n = await importWorks(prisma, JSON.parse(readFileSync(f, 'utf8')));
    console.log(`Произведения: ${path.basename(f)} → ${n}`);
  }
  const qFiles = [...jsonFiles(path.join(root, 'questions')), ...(withDemo ? jsonFiles(path.join(root, 'demo')) : [])];
  for (const f of qFiles) {
    const r = await importQuestions(prisma, JSON.parse(readFileSync(f, 'utf8')));
    console.log(`Въпроси: ${path.relative(root, f)} → ${r.created} (заменени ${r.replaced})`);
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

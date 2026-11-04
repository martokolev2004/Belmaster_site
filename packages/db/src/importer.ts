import type { Grade, LanguageTopic, PrismaClient, QuestionType, Section } from '@prisma/client';
import { punctuationFromTexts } from '@belmaster/shared';

/**
 * Формат на файл за импорт (виж data/questions/README.md).
 */
export interface ImportFile {
  grade: Grade;
  demo?: boolean;
  sourceNote?: string;
  exam?: { year: number; session: string; title?: string };
  passages?: { key: string; title?: string; text: string }[];
  questions: ImportQuestion[];
}

export interface ImportQuestion {
  no?: number;
  section: Section;
  topic?: LanguageTopic | null;
  type?: QuestionType;
  prompt: string;
  context?: string | null;
  options?: string[];
  /** буква („А“, „Б“…) или 0-базиран индекс */
  correct?: string | number | null;
  acceptedAnswers?: string[];
  matching?: { left: string[]; right: string[]; pairs: number[] } | null;
  /** FILL_BLANKS: текстът е в context с маркери {{А}}; correct е буква или индекс */
  blanks?: { label: string; options: string[]; correct: string | number }[];
  /** PUNCTUATION: текстът без знаците и поправеният текст */
  punctuation?: { text: string; answer: string };
  /** SHORT_ANSWER: колко отговора се искат */
  answerCount?: number;
  explanation?: string | null;
  work?: { title: string; author: string; period?: string } | null;
  passage?: string | null;
  status?: 'ACTIVE' | 'DRAFT' | 'HIDDEN';
}

export interface ImportReport {
  examTitle: string | null;
  created: number;
  replaced: number;
  worksCreated: string[];
  warnings: string[];
}

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
const LATIN = ['A', 'B', 'V', 'G', 'D', 'E'];

function toIndex(correct: string | number | null | undefined, optionCount: number): number | null {
  if (correct === null || correct === undefined) return null;
  if (typeof correct === 'number') return correct >= 0 && correct < optionCount ? correct : null;
  const c = correct.trim().toUpperCase();
  let i = LETTERS.indexOf(c);
  if (i < 0) i = LATIN.indexOf(c);
  if (i < 0 && /^\d+$/.test(c)) i = Number(c);
  return i >= 0 && i < optionCount ? i : null;
}

export function validateImport(data: unknown): ImportFile {
  const f = data as ImportFile;
  if (!f || typeof f !== 'object') throw new Error('Файлът не е JSON обект.');
  if (!['G7', 'G10', 'G12'].includes(f.grade)) throw new Error('Липсва или е грешен "grade" (G7, G10 или G12).');
  if (!Array.isArray(f.questions)) throw new Error('Липсва масив "questions".');
  return f;
}

export async function importQuestions(prisma: PrismaClient, input: unknown): Promise<ImportReport> {
  const file = validateImport(input);
  const report: ImportReport = { examTitle: null, created: 0, replaced: 0, worksCreated: [], warnings: [] };

  return prisma.$transaction(
    async (tx) => {
      let examId: string | null = null;
      if (file.exam) {
        const title =
          file.exam.title ??
          `${file.grade === 'G12' ? 'ДЗИ' : 'НВО'} по БЕЛ — ${file.exam.session} ${file.exam.year}`;
        const exam = await tx.exam.upsert({
          where: { grade_year_session: { grade: file.grade, year: file.exam.year, session: file.exam.session } },
          update: { title },
          create: { grade: file.grade, year: file.exam.year, session: file.exam.session, title },
        });
        examId = exam.id;
        report.examTitle = title;
        // повторен импорт на същата матура замества старите въпроси и текстове
        const del = await tx.question.deleteMany({ where: { examId } });
        await tx.passage.deleteMany({ where: { examId } });
        report.replaced = del.count;
      } else if (file.demo) {
        const del = await tx.question.deleteMany({ where: { grade: file.grade, sourceNote: file.sourceNote ?? 'ДЕМО' } });
        await tx.passage.deleteMany({ where: { grade: file.grade, examId: null, questions: { none: {} } } });
        report.replaced = del.count;
      }

      const passageIds = new Map<string, string>();
      for (const p of file.passages ?? []) {
        const created = await tx.passage.create({
          data: { grade: file.grade, title: p.title ?? null, text: p.text, examId },
        });
        passageIds.set(p.key, created.id);
      }

      const workCache = new Map<string, string>();
      for (const [i, q] of file.questions.entries()) {
        const label = q.no ? `въпрос ${q.no}` : `въпрос #${i + 1}`;
        const type: QuestionType = q.type ?? 'SINGLE_CHOICE';
        const options = q.options ?? [];
        const correctIndex = type === 'SINGLE_CHOICE' ? toIndex(q.correct, options.length) : null;
        let status = q.status ?? 'ACTIVE';
        if (type === 'SINGLE_CHOICE' && (options.length < 2 || correctIndex === null)) {
          report.warnings.push(`${label}: липсват отговори или верен отговор — записан като непроверен.`);
          status = 'DRAFT';
        }
        if (type === 'SHORT_ANSWER' && !(q.acceptedAnswers && q.acceptedAnswers.length)) {
          report.warnings.push(`${label}: няма допустими отговори — записан като непроверен.`);
          status = 'DRAFT';
        }

        let data: object | undefined;
        if (type === 'FILL_BLANKS') {
          const blanks = (q.blanks ?? []).map((b) => ({ label: b.label, options: b.options, correct: toIndex(b.correct, b.options.length) ?? -1 }));
          if (!q.context || !blanks.length || blanks.some((b) => b.correct < 0)) {
            report.warnings.push(`${label}: празните места са непълни — записан като непроверен.`);
            status = 'DRAFT';
          }
          data = { blanks: { text: q.context ?? '', blanks } };
        }
        if (type === 'PUNCTUATION') {
          try {
            if (!q.punctuation) throw new Error('липсва "punctuation"');
            data = { punctuation: punctuationFromTexts(q.punctuation.text, q.punctuation.answer) };
          } catch (e) {
            report.warnings.push(`${label}: ${(e as Error).message} — записан като непроверен.`);
            status = 'DRAFT';
          }
        }

        let workId: string | null = null;
        if (q.work && q.section === 'LITERATURE') {
          const key = `${q.work.title}|${q.work.author}`;
          workId = workCache.get(key) ?? null;
          if (!workId) {
            const existing = await tx.work.findUnique({
              where: { grade_title_author: { grade: file.grade, title: q.work.title, author: q.work.author } },
            });
            if (existing) workId = existing.id;
            else {
              const w = await tx.work.create({
                data: { grade: file.grade, title: q.work.title, author: q.work.author, period: q.work.period ?? null },
              });
              workId = w.id;
              report.worksCreated.push(`${q.work.title} — ${q.work.author}`);
            }
            workCache.set(key, workId);
          }
        }

        let passageId: string | null = null;
        if (q.passage) {
          passageId = passageIds.get(q.passage) ?? null;
          if (!passageId) report.warnings.push(`${label}: непознат текст "${q.passage}".`);
        }

        await tx.question.create({
          data: {
            grade: file.grade,
            section: q.section,
            topic: q.section === 'LANGUAGE' ? q.topic ?? null : null,
            type,
            prompt: q.prompt,
            context: type === 'FILL_BLANKS' ? null : q.context ?? null,
            options,
            correctIndex,
            acceptedAnswers: q.acceptedAnswers ?? [],
            matching: q.matching ?? undefined,
            data,
            answerCount: q.answerCount ?? 1,
            explanation: q.explanation ?? null,
            status,
            workId,
            passageId,
            examId,
            sourceNo: q.no ?? null,
            sourceNote: file.demo ? file.sourceNote ?? 'ДЕМО' : file.sourceNote ?? null,
          },
        });
        report.created++;
      }
      return report;
    },
    { timeout: 60_000 },
  );
}

export interface WorksFile {
  grade: Grade;
  works: { title: string; author: string; period?: string; studiedIn?: string; year?: string; genre?: string }[];
}

export async function importWorks(prisma: PrismaClient, file: WorksFile): Promise<number> {
  let n = 0;
  for (const [i, w] of file.works.entries()) {
    await prisma.work.upsert({
      where: { grade_title_author: { grade: file.grade, title: w.title, author: w.author } },
      update: { period: w.period ?? undefined, sortOrder: i },
      create: {
        grade: file.grade,
        title: w.title,
        author: w.author,
        period: w.period ?? null,
        genre: w.genre ?? null,
        year: w.year ?? null,
        extra: w.studiedIn ? `Изучава се в ${w.studiedIn}.` : null,
        sortOrder: i,
      },
    });
    n++;
  }
  return n;
}

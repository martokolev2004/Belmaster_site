import 'server-only';
import type { Grade, Question, Work } from '@belmaster/db';
import { displayAccepted, renderPunctuated, scoreAnswer, SECTION_LABELS, TOPIC_LABELS, type MatchingData, type QuestionData } from '@belmaster/shared';
import { prisma } from './db';
import type { Answer, ClientPassage, ClientQuestion, QuestionResult } from './quiz-types';

export const TEST_SIZE = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toClient(q: Question & { work?: Work | null }): ClientQuestion {
  const m = q.matching as MatchingData | null;
  const d = q.data as QuestionData;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    context: q.context,
    options: q.type === 'SINGLE_CHOICE' ? q.options : [],
    answerCount: q.answerCount,
    matching: q.type === 'MATCHING' && m ? { left: m.left, right: m.right } : null,
    blanks: q.type === 'FILL_BLANKS' && d?.blanks ? { text: d.blanks.text, blanks: d.blanks.blanks.map((b) => ({ label: b.label, options: b.options })) } : null,
    tokens: q.type === 'PUNCTUATION' && d?.punctuation ? d.punctuation.tokens : null,
    passageId: q.passageId,
    workTitle: q.work ? `${q.work.title} — ${q.work.author}` : null,
    label: q.topic ? TOPIC_LABELS[q.topic] : SECTION_LABELS[q.section],
    sourceNo: q.sourceNo,
  };
}

async function randomIds(where: object, take: number): Promise<string[]> {
  const ids = await prisma.question.findMany({ where, select: { id: true } });
  return shuffle(ids.map((i) => i.id)).slice(0, take);
}

export async function buildPracticeTest(
  grade: Grade,
  kind: 'LANGUAGE' | 'LITERATURE' | 'READING',
  topic?: string | null,
  workId?: string | null,
): Promise<{ questions: ClientQuestion[]; passages: ClientPassage[] }> {
  if (kind === 'READING') {
    const passages = await prisma.passage.findMany({
      where: { grade, questions: { some: { status: 'ACTIVE' } } },
      select: { id: true },
    });
    const pick = shuffle(passages)[0];
    if (!pick) return { questions: [], passages: [] };
    const p = await prisma.passage.findUniqueOrThrow({
      where: { id: pick.id },
      include: { questions: { where: { status: 'ACTIVE' }, orderBy: [{ sourceNo: 'asc' }, { createdAt: 'asc' }] } },
    });
    return {
      questions: p.questions.map((q) => toClient(q)),
      passages: [{ id: p.id, title: p.title, text: p.text }],
    };
  }
  const where = {
    grade,
    section: kind,
    status: 'ACTIVE' as const,
    ...(kind === 'LANGUAGE' && topic && topic in TOPIC_LABELS ? { topic: topic as keyof typeof TOPIC_LABELS } : {}),
    ...(kind === 'LITERATURE' && workId ? { workId } : {}),
  };
  const ids = await randomIds(where, TEST_SIZE);
  const qs = await prisma.question.findMany({ where: { id: { in: ids } }, include: { work: true } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  return { questions: ids.map((id) => toClient(byId.get(id)!)), passages: [] };
}

export async function buildExamTest(grade: Grade, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, grade },
    include: {
      questions: { where: { status: 'ACTIVE' }, include: { work: true }, orderBy: [{ sourceNo: 'asc' }, { createdAt: 'asc' }] },
      passages: true,
    },
  });
  if (!exam) return null;
  const usedPassages = new Set(exam.questions.map((q) => q.passageId).filter(Boolean));
  return {
    exam,
    questions: exam.questions.map((q) => toClient(q)),
    passages: exam.passages.filter((p) => usedPassages.has(p.id)).map((p) => ({ id: p.id, title: p.title, text: p.text })),
  };
}

export function grade(q: Question, a: Answer | undefined): QuestionResult {
  const m = q.matching as MatchingData | null;
  const d = q.data as QuestionData;
  const r = scoreAnswer(
    { type: q.type, correctIndex: q.correctIndex, acceptedAnswers: q.acceptedAnswers, answerCount: q.answerCount, matching: m, data: d },
    a,
  );
  return {
    id: q.id,
    score: r.score,
    correct: r.correct,
    correctIndex: q.type === 'SINGLE_CHOICE' ? q.correctIndex : null,
    correctText: q.type === 'SHORT_ANSWER' ? displayAccepted(q.acceptedAnswers) : null,
    correctPairs: q.type === 'MATCHING' && m ? m.pairs : null,
    correctBlanks: q.type === 'FILL_BLANKS' && d?.blanks ? d.blanks.blanks.map((b) => b.correct) : null,
    correctMarks: q.type === 'PUNCTUATION' && d?.punctuation ? d.punctuation.marks : null,
    correctFull: q.type === 'PUNCTUATION' && d?.punctuation ? renderPunctuated(d.punctuation) : null,
    explanation: q.explanation,
  };
}

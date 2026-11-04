import type { AnyAnswer, PunctMark } from '@belmaster/shared';
import type { InputQuestion } from '@/components/quiz/inputs';

export type TestKind = 'LANGUAGE' | 'LITERATURE' | 'READING' | 'EXAM';

export interface ClientQuestion extends InputQuestion {
  prompt: string;
  context: string | null;
  passageId: string | null;
  workTitle: string | null;
  label: string;
  sourceNo: number | null;
}

export interface ClientPassage {
  id: string;
  title: string | null;
  text: string;
}

export type Answer = AnyAnswer;

export interface QuestionResult {
  id: string;
  /** 0..1 */
  score: number;
  correct: boolean;
  correctIndex: number | null;
  correctText: string | null;
  correctPairs: number[] | null;
  correctBlanks: number[] | null;
  correctMarks: PunctMark[] | null;
  correctFull: string | null;
  explanation: string | null;
}

export interface FinishResult {
  score: number;
  total: number;
  xpEarned: number;
  newXp: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  unlocked: string[];
  results: QuestionResult[];
}

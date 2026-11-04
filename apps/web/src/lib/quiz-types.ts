export type TestKind = 'LANGUAGE' | 'LITERATURE' | 'READING' | 'EXAM';

export interface ClientQuestion {
  id: string;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'MATCHING';
  prompt: string;
  context: string | null;
  options: string[];
  matching: { left: string[]; right: string[] } | null;
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

export interface Answer {
  index?: number | null;
  text?: string | null;
  pairs?: (number | null)[] | null;
}

export interface QuestionResult {
  id: string;
  correct: boolean;
  correctIndex: number | null;
  correctText: string | null;
  correctPairs: number[] | null;
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

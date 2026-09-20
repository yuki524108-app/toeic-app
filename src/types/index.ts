export type Word = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  level: number; // 400-900 相当の難易度目安
};

export type GrammarQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: number; // choices のインデックス
  explanation: string;
  level: number;
};

export type ReadingQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  level: number;
};

export type ReadingPassage = {
  id: string;
  title: string;
  passage: string;
  questions: ReadingQuestion[];
};

export type ItemType = "word" | "grammar" | "reading";

export type ProgressRecord = {
  itemId: string;
  itemType: ItemType;
  itemLevel: number;
  easeFactor: number;
  interval: number; // 日数
  repetitions: number;
  nextReviewDate: string; // ISO date (YYYY-MM-DD)
  lastAnsweredAt: string; // ISO datetime
  isCorrect: boolean;
};

export type DailyLog = {
  date: string; // YYYY-MM-DD
  wordsStudied: number;
  grammarStudied: number;
  readingsStudied: number;
};

export type AppData = {
  progress: Record<string, ProgressRecord>;
  dailyLogs: Record<string, DailyLog>;
  streak: number;
  lastStudyDate: string | null;
  bookmarks: string[]; // ブックマークした単語/文法問題のid一覧
  placementTestCompletedAt: string | null; // 初回模試を完了した日時（ISO）。未実施ならnull
};

/** 学習キューの絞り込み方法。recommended はページ側で専用ロジックにより算出する */
export type StudyMode = "due" | "all" | "incorrect" | "bookmarked" | "recommended";

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

export type ItemType = "word" | "grammar";

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
};

export type AppData = {
  progress: Record<string, ProgressRecord>;
  dailyLogs: Record<string, DailyLog>;
  streak: number;
  lastStudyDate: string | null;
  bookmarks: string[]; // ブックマークした単語/文法問題のid一覧
};

/** 学習キューの絞り込み方法 */
export type StudyMode = "due" | "all" | "incorrect" | "bookmarked";

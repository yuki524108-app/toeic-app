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
  // ダブルパッセージ（2文書）・トリプルパッセージ（3文書）の場合のみ指定される
  type?: "single" | "double" | "triple";
  title2?: string;
  passage2?: string;
  title3?: string;
  passage3?: string;
};

export type ItemType =
  | "word"
  | "grammar"
  | "reading"
  | "part6"
  | "listeningPart2"
  | "listeningPart34";

export type ListeningPart2Question = {
  id: string;
  question: string; // 音声で読み上げる設問文（テキストは解答後に表示）
  choices: [string, string, string]; // A, B, C の応答（音声のみ）
  answer: number; // 0=A, 1=B, 2=C
  explanation: string;
  level: number;
};

/** Part 3・4 の会話/トーク本文を構成する1発言。話者ごとに別の音声を割り当てて読み上げる */
export type ListeningScriptLine = {
  speaker: string; // "Man" "Woman" "Narrator" など。同じ値なら同じ声で読み上げられる
  line: string;
};

export type ListeningPart34Question = {
  id: string;
  question: string; // 設問文（印刷される想定のテキストとして常に表示、選択肢と合わせて4択）
  choices: [string, string, string, string];
  answer: number; // 0-3
  explanation: string;
  level: number;
};

export type ListeningPart34Set = {
  id: string;
  partType: "part3" | "part4"; // part3=複数話者の会話、part4=単独話者のトーク
  title: string;
  script: ListeningScriptLine[]; // 音声でのみ流れる本文（解答完了後にスクリプトとして表示）
  questions: ListeningPart34Question[]; // 各セット3問
};

export type Part6Blank = {
  id: string;
  choices: string[];
  answer: number;
  explanation: string;
  level: number;
};

export type Part6Passage = {
  id: string;
  title: string;
  passage: string; // 空欄は (1) (2) (3) (4) のように番号で表記する
  blanks: Part6Blank[];
};

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
  part6Studied: number;
  listeningPart2Studied: number;
  listeningPart34Studied: number;
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

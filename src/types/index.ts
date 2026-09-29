export type Word = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  level: number; // 400-900 相当の難易度目安
  pos?: string; // 品詞（名詞・動詞など）
  exampleJa?: string; // 例文の和訳
  note?: string; // 類義語・派生語・コロケーションなどの補足（改行区切り）
};

export type GrammarQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: number; // choices のインデックス
  explanation: string;
  level: number;
  category: string; // 文法項目（弱点分析用）。例：時制、前置詞、関係詞 など
};

export type ReadingQuestion = {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  level: number;
  questionJa?: string; // 設問の和訳
  choicesJa?: string[]; // 選択肢の和訳（choices と同じ順・同じ数）
  explanationDetail?: string; // 誤答の理由まで含む詳細解説
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
  passageJa?: string; // 全訳（passage）
  passage2Ja?: string;
  passage3Ja?: string;
  vocab?: string[]; // 重要語句（"word：意味" 形式）
};

export type ItemType =
  | "word"
  | "grammar"
  | "reading"
  | "part6"
  | "listeningPart1"
  | "listeningPart2"
  | "listeningPart34";

/**
 * Part 1（写真描写問題）。写真1枚につき4つの英文（音声のみ、テキストは解答後に開示）から
 * 最も適切に写真を描写しているものを選ぶ。写真は著作権フリー素材の代わりに、
 * アプリ内で完結するオリジナルのSVGイラスト（`image`にSVGマークアップを直接格納）を使用する。
 * 詳細は要件定義書 2.1.9 を参照。
 */
export type ListeningPart1Item = {
  id: string;
  image: string; // 自己完結したSVGマークアップ（<svg>...</svg>）
  choices: [string, string, string, string]; // 写真を描写する4つの英文（A〜D）
  answer: number; // 0-3
  explanation: string;
  level: number;
};

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
  questionJa?: string; // 設問の和訳
  choicesJa?: string[]; // 選択肢の和訳（choices と同じ順・同じ数）
  explanationDetail?: string; // 誤答の理由まで含む詳細解説
};

export type ListeningPart34Set = {
  id: string;
  partType: "part3" | "part4"; // part3=複数話者の会話、part4=単独話者のトーク
  title: string;
  script: ListeningScriptLine[]; // 音声でのみ流れる本文（解答完了後にスクリプトとして表示）
  questions: ListeningPart34Question[]; // 各セット3問
  scriptJa?: string[]; // script と同じ順・同じ行数の和訳
  vocab?: string[]; // 重要語句（"word：意味" 形式）
};

export type Part6Blank = {
  id: string;
  choices: string[];
  answer: number;
  explanation: string;
  level: number;
  choicesJa?: string[];
  explanationDetail?: string;
};

export type Part6Passage = {
  id: string;
  title: string;
  passage: string; // 空欄は (1) (2) (3) (4) のように番号で表記する
  blanks: Part6Blank[];
  passageJa?: string; // 空欄を正解で埋めた状態の全訳
  vocab?: string[];
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
  listeningPart1Studied: number;
  listeningPart2Studied: number;
  listeningPart34Studied: number;
};

/**
 * 模試モード（2.3節）の1回分の受験結果。リーディング・リスニング各セクションの
 * 正誤数と目安スコア（5〜495点）、およびそれらを合算した総合スコア（5〜990点）を保持する。
 */
export type MockTestSectionResult = {
  correct: number;
  total: number;
  score: number; // 5-495
};

/**
 * 模試の各設問1問ごとの解答記録（模試結果の復習画面用）。
 * selectedAnswer が null の場合は未解答（時間切れ等）を意味する。
 */
export type MockTestAnswerRecord = {
  id: string;
  itemType: ItemType;
  level: number;
  correctAnswer: number;
  selectedAnswer: number | null;
  qNumber: number; // 1-200（本番TOEICと同じ通し番号）
  partLabel: string; // "Part 1" 〜 "Part 7"
};

export type MockTestResult = {
  id: string; // 受験完了日時（ISO）をそのままidとして使う
  completedAt: string; // ISO datetime
  listening: MockTestSectionResult;
  reading: MockTestSectionResult;
  totalScore: number; // 5-990（reading.score + listening.score）
  // 模試結果の復習画面用の全設問記録。この機能追加より前に保存された履歴には存在しない（任意項目）
  answerRecords?: MockTestAnswerRecord[];
};

export type AppData = {
  progress: Record<string, ProgressRecord>;
  dailyLogs: Record<string, DailyLog>;
  streak: number;
  lastStudyDate: string | null;
  bookmarks: string[]; // ブックマークした単語/文法問題のid一覧
  placementTestCompletedAt: string | null; // 初回模試を完了した日時（ISO）。未実施ならnull
  mockTestHistory: MockTestResult[]; // 模試モードの受験履歴（新しい順ではなく受験順に追加）
};

/** 学習キューの絞り込み方法。recommended はページ側で専用ロジックにより算出する */
export type StudyMode = "due" | "all" | "incorrect" | "bookmarked" | "recommended";

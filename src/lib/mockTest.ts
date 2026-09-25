import grammarQuestions from "../data/grammar.json";
import readings from "../data/readings.json";
import part6Data from "../data/part6.json";
import listeningPart1Items from "../data/listeningPart1.json";
import listeningPart2Questions from "../data/listeningPart2.json";
import listeningPart34Sets from "../data/listeningPart34.json";
import type {
  GrammarQuestion,
  ItemType,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
  Part6Passage,
  ReadingPassage,
} from "../types";
import { scoreFromResults } from "./scoreEstimate";

const grammarPool = grammarQuestions as GrammarQuestion[];
const readingPool = readings as ReadingPassage[];
const part6Pool = part6Data as Part6Passage[];
const part1Pool = listeningPart1Items as ListeningPart1Item[];
const part2Pool = listeningPart2Questions as ListeningPart2Question[];
const part34Pool = listeningPart34Sets as ListeningPart34Set[];

/**
 * 公式TOEICの1回分と同じ出題数構成（リスニング100問・リーディング100問、計200問）。
 * Part 3・4は「1セット＝3問」の会話・トークのみを対象とする
 * （収録データ中1セットのみ設問4問のものがあり、公式と同じ数に揃えるため除外する）。
 */
export const MOCK_TEST_COUNTS = {
  part1: 6,
  part2: 25,
  part3Sets: 13, // 13セット×3問=39問
  part4Sets: 10, // 10セット×3問=30問
  grammar: 30,
  part6Passages: 4, // 4パッセージ×4空欄=16問
  readingSingle: 8, // 8本×3問=24問
  readingDouble: 2, // 2セット×5問=10問
  readingTriple: 4, // 4セット×5問=20問
} as const;

export const LISTENING_TIME_SEC = 45 * 60; // 45分
export const READING_TIME_SEC = 75 * 60; // 75分

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

export type ListeningStep =
  | { kind: "part1"; qNumber: number; item: ListeningPart1Item }
  | { kind: "part2"; qNumber: number; item: ListeningPart2Question }
  | {
      kind: "part34";
      qNumber: number;
      set: ListeningPart34Set;
      questionIndex: number;
    };

export type ReadingStep =
  | { kind: "grammar"; qNumber: number; item: GrammarQuestion }
  | { kind: "part6"; qNumberStart: number; passage: Part6Passage }
  | {
      kind: "reading";
      qNumber: number;
      passage: ReadingPassage;
      questionIndex: number;
    };

export type MockTest = {
  listeningSteps: ListeningStep[];
  readingSteps: ReadingStep[];
  listeningTotal: number;
  readingTotal: number;
};

/**
 * 毎回ランダムに問題を抽出し、公式TOEICと同じ並び順（Part1→2→3→4、Part5→6→7）で
 * 設問番号を1から通し採番した模試1回分を組み立てる。リスニングは1〜100、
 * リーディングは101〜200の番号になる（公式TOEICの問題番号と同じ体系）。
 */
export function buildMockTest(): MockTest {
  const part1Items = pick(part1Pool, MOCK_TEST_COUNTS.part1);
  const part2Items = pick(part2Pool, MOCK_TEST_COUNTS.part2);
  const part3Sets = pick(
    part34Pool.filter((s) => s.partType === "part3" && s.questions.length === 3),
    MOCK_TEST_COUNTS.part3Sets
  );
  const part4Sets = pick(
    part34Pool.filter((s) => s.partType === "part4" && s.questions.length === 3),
    MOCK_TEST_COUNTS.part4Sets
  );

  let q = 1;
  const listeningSteps: ListeningStep[] = [];
  for (const item of part1Items) {
    listeningSteps.push({ kind: "part1", qNumber: q++, item });
  }
  for (const item of part2Items) {
    listeningSteps.push({ kind: "part2", qNumber: q++, item });
  }
  for (const set of [...part3Sets, ...part4Sets]) {
    set.questions.forEach((_, questionIndex) => {
      listeningSteps.push({ kind: "part34", qNumber: q++, set, questionIndex });
    });
  }
  const listeningTotal = q - 1;

  const grammarItems = pick(grammarPool, MOCK_TEST_COUNTS.grammar);
  const part6Passages = pick(part6Pool, MOCK_TEST_COUNTS.part6Passages);
  const singlePassages = pick(
    readingPool.filter((p) => (p.type ?? "single") === "single"),
    MOCK_TEST_COUNTS.readingSingle
  );
  const doublePassages = pick(
    readingPool.filter((p) => p.type === "double"),
    MOCK_TEST_COUNTS.readingDouble
  );
  const triplePassages = pick(
    readingPool.filter((p) => p.type === "triple"),
    MOCK_TEST_COUNTS.readingTriple
  );

  // 公式TOEICと同じく、リーディングはリスニング（1〜100）に続けて101から採番する
  let r = 101;
  const readingSteps: ReadingStep[] = [];
  for (const item of grammarItems) {
    readingSteps.push({ kind: "grammar", qNumber: r++, item });
  }
  for (const passage of part6Passages) {
    readingSteps.push({ kind: "part6", qNumberStart: r, passage });
    r += passage.blanks.length;
  }
  for (const passage of [...singlePassages, ...doublePassages, ...triplePassages]) {
    passage.questions.forEach((_, questionIndex) => {
      readingSteps.push({ kind: "reading", qNumber: r++, passage, questionIndex });
    });
  }
  const readingTotal = r - 101;

  return { listeningSteps, readingSteps, listeningTotal, readingTotal };
}

/** 採点・進捗記録のために、ステップ構造から「設問1問ごと」の情報を平坦化したもの */
export type AtomicQuestion = {
  id: string;
  itemType: ItemType;
  level: number;
  correctAnswer: number;
};

export function flattenListening(steps: ListeningStep[]): AtomicQuestion[] {
  return steps.map((step) => {
    if (step.kind === "part1") {
      return {
        id: step.item.id,
        itemType: "listeningPart1" as const,
        level: step.item.level,
        correctAnswer: step.item.answer,
      };
    }
    if (step.kind === "part2") {
      return {
        id: step.item.id,
        itemType: "listeningPart2" as const,
        level: step.item.level,
        correctAnswer: step.item.answer,
      };
    }
    const question = step.set.questions[step.questionIndex];
    return {
      id: question.id,
      itemType: "listeningPart34" as const,
      level: question.level,
      correctAnswer: question.answer,
    };
  });
}

export function flattenReading(steps: ReadingStep[]): AtomicQuestion[] {
  const out: AtomicQuestion[] = [];
  for (const step of steps) {
    if (step.kind === "grammar") {
      out.push({
        id: step.item.id,
        itemType: "grammar",
        level: step.item.level,
        correctAnswer: step.item.answer,
      });
    } else if (step.kind === "part6") {
      for (const blank of step.passage.blanks) {
        out.push({
          id: blank.id,
          itemType: "part6",
          level: blank.level,
          correctAnswer: blank.answer,
        });
      }
    } else {
      const question = step.passage.questions[step.questionIndex];
      out.push({
        id: question.id,
        itemType: "reading",
        level: question.level,
        correctAnswer: question.answer,
      });
    }
  }
  return out;
}

export type MockTestSectionResult = {
  correct: number;
  total: number;
  score: number;
};

/**
 * 解答マップ（設問id→選択したインデックス）をもとに、1セクション分の正誤・目安スコアを算出する。
 * 未解答の設問は不正解として扱う（本番のTOEICと同様、時間切れ＝その時点で未解答分は得点にならない）。
 */
export function scoreSection(
  atomicQuestions: AtomicQuestion[],
  answers: Record<string, number>
): MockTestSectionResult {
  const correctLevels: number[] = [];
  for (const q of atomicQuestions) {
    if (answers[q.id] === q.correctAnswer) correctLevels.push(q.level);
  }
  const score = scoreFromResults(correctLevels, atomicQuestions.length);
  return { correct: correctLevels.length, total: atomicQuestions.length, score };
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

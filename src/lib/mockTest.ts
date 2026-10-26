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
  MockTestResult,
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

type Rng = () => number;

function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- 受験済み問題の履歴（次回の出題で優先的に避けるため） ----------

/** 設問ごとの受験履歴。count＝解答した模試の回数、lastIndex＝最後に解答した模試の受験順（0始まり） */
export type SeenStat = { count: number; lastIndex: number };

/**
 * 模試の受験履歴（`MockTestResult.answerRecords`）から、設問IDごとの出題済み情報を作る。
 * - 履歴は受験完了日時の順に並べ直して数える
 * - 実際に解答した設問（selectedAnswer が null でないもの）だけを出題済みとする。時間切れで未解答の設問は、
 *   聞いても読んでもいない可能性が高いため、出題済みとは扱わない
 * - `answerRecords` を持たない古い履歴（この機能追加以前の受験分）は設問の内容が分からないため対象外
 */
export function buildSeenIndex(history: MockTestResult[]): Map<string, SeenStat> {
  const seen = new Map<string, SeenStat>();
  [...history]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .forEach((result, testIndex) => {
      for (const rec of result.answerRecords ?? []) {
        if (rec.selectedAnswer === null) continue;
        const stat = seen.get(rec.id) ?? { count: 0, lastIndex: -1 };
        seen.set(rec.id, { count: stat.count + 1, lastIndex: testIndex });
      }
    });
  return seen;
}

/** 出題単位（1問、またはPart 3・4の会話／Part 6・7の文書のように複数設問を持つセット）の出題済み情報。いずれの設問も未解答なら undefined */
function unitStat(ids: string[], seen: Map<string, SeenStat>): SeenStat | undefined {
  let found: SeenStat | undefined;
  for (const id of ids) {
    const stat = seen.get(id);
    if (!stat) continue;
    found = found
      ? {
          count: Math.max(found.count, stat.count),
          lastIndex: Math.max(found.lastIndex, stat.lastIndex),
        }
      : stat;
  }
  return found;
}

/**
 * 候補から n 件を選ぶ。過去の模試で出題していない（未出題の）ものを優先し、足りない分だけ
 * 出題済みの中から「最後に出題された模試が古いもの」→「出題回数が少ないもの」の順に補う。
 * 返す順序はシャッフルする（出題済み・未出題の順に並ばないようにする）。
 */
function pickPreferUnseen<T>(
  items: T[],
  n: number,
  idsOf: (item: T) => string[],
  seen: Map<string, SeenStat>,
  rng: Rng
): T[] {
  const want = Math.min(n, items.length);
  const unseen: T[] = [];
  const seenItems: { item: T; stat: SeenStat }[] = [];
  for (const item of items) {
    const stat = unitStat(idsOf(item), seen);
    if (stat) seenItems.push({ item, stat });
    else unseen.push(item);
  }
  const picked = shuffle(unseen, rng).slice(0, want);
  if (picked.length < want) {
    // 先にシャッフルしてから安定ソートすることで、同順位のものはランダムに選ばれる
    const oldestFirst = shuffle(seenItems, rng).sort(
      (a, b) => a.stat.lastIndex - b.stat.lastIndex || a.stat.count - b.stat.count
    );
    picked.push(...oldestFirst.slice(0, want - picked.length).map((x) => x.item));
  }
  return shuffle(picked, rng);
}

// 出題の候補プール。Part 3・4は設問3問のセットのみ、Part 7は文書の種類ごとに分ける
const part3Pool = part34Pool.filter((s) => s.partType === "part3" && s.questions.length === 3);
const part4Pool = part34Pool.filter((s) => s.partType === "part4" && s.questions.length === 3);
const readingSinglePool = readingPool.filter((p) => (p.type ?? "single") === "single");
const readingDoublePool = readingPool.filter((p) => p.type === "double");
const readingTriplePool = readingPool.filter((p) => p.type === "triple");

const idsOfSet = (s: ListeningPart34Set) => s.questions.map((q) => q.id);
const idsOfPart6 = (p: Part6Passage) => p.blanks.map((b) => b.id);
const idsOfReading = (p: ReadingPassage) => p.questions.map((q) => q.id);
const idsOfSingle = (x: { id: string }) => [x.id];

/**
 * 過去の模試で出題済みのものを使わないと必要数を満たせない区分（＝次回の模試で過去の問題と重なる区分）を返す。
 * 例：Part 3の未出題の会話が13セット未満なら "Part 3" を含む。
 */
export function findRepeatShortages(history: MockTestResult[]): string[] {
  const seen = buildSeenIndex(history);
  const short = (
    label: string,
    pool: unknown[],
    need: number,
    idsOf: (x: never) => string[]
  ) => {
    const unseen = pool.filter((x) => !unitStat(idsOf(x as never), seen)).length;
    return unseen < Math.min(need, pool.length) ? [label] : [];
  };
  return [
    ...short("Part 1", part1Pool, MOCK_TEST_COUNTS.part1, idsOfSingle),
    ...short("Part 2", part2Pool, MOCK_TEST_COUNTS.part2, idsOfSingle),
    ...short("Part 3", part3Pool, MOCK_TEST_COUNTS.part3Sets, idsOfSet),
    ...short("Part 4", part4Pool, MOCK_TEST_COUNTS.part4Sets, idsOfSet),
    ...short("Part 5", grammarPool, MOCK_TEST_COUNTS.grammar, idsOfSingle),
    ...short("Part 6", part6Pool, MOCK_TEST_COUNTS.part6Passages, idsOfPart6),
    ...short("Part 7（1つの文書）", readingSinglePool, MOCK_TEST_COUNTS.readingSingle, idsOfReading),
    ...short("Part 7（2つの文書）", readingDoublePool, MOCK_TEST_COUNTS.readingDouble, idsOfReading),
    ...short("Part 7（3つの文書）", readingTriplePool, MOCK_TEST_COUNTS.readingTriple, idsOfReading),
  ];
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
 * 公式TOEICと同じ並び順（Part1→2→3→4、Part5→6→7）で設問番号を1から通し採番した模試1回分を組み立てる。
 * リスニングは1〜100、リーディングは101〜200の番号になる（公式TOEICの問題番号と同じ体系）。
 *
 * 問題は区分ごとにランダムに抽出するが、`history`（過去の模試の受験履歴）に解答済みとして残っている
 * 問題は優先的に避け、未出題の問題から選ぶ。未出題が足りない区分は、最後に出題された模試が古いものから補う。
 * 履歴を渡さない場合（初回など）は、従来どおり全プールから完全にランダムに抽出する。
 */
export function buildMockTest(
  history: MockTestResult[] = [],
  rng: Rng = Math.random
): MockTest {
  const seen = buildSeenIndex(history);

  const part1Items = pickPreferUnseen(part1Pool, MOCK_TEST_COUNTS.part1, idsOfSingle, seen, rng);
  const part2Items = pickPreferUnseen(part2Pool, MOCK_TEST_COUNTS.part2, idsOfSingle, seen, rng);
  const part3Sets = pickPreferUnseen(part3Pool, MOCK_TEST_COUNTS.part3Sets, idsOfSet, seen, rng);
  const part4Sets = pickPreferUnseen(part4Pool, MOCK_TEST_COUNTS.part4Sets, idsOfSet, seen, rng);

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

  const grammarItems = pickPreferUnseen(grammarPool, MOCK_TEST_COUNTS.grammar, idsOfSingle, seen, rng);
  const part6Passages = pickPreferUnseen(part6Pool, MOCK_TEST_COUNTS.part6Passages, idsOfPart6, seen, rng);
  const singlePassages = pickPreferUnseen(readingSinglePool, MOCK_TEST_COUNTS.readingSingle, idsOfReading, seen, rng);
  const doublePassages = pickPreferUnseen(readingDoublePool, MOCK_TEST_COUNTS.readingDouble, idsOfReading, seen, rng);
  const triplePassages = pickPreferUnseen(readingTriplePool, MOCK_TEST_COUNTS.readingTriple, idsOfReading, seen, rng);

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

/** 採点・進捗記録・模試レビュー画面のために、ステップ構造から「設問1問ごと」の情報を平坦化したもの */
export type AtomicQuestion = {
  id: string;
  itemType: ItemType;
  level: number;
  correctAnswer: number;
  qNumber: number; // 1-200（本番TOEICと同じ通し番号）
  partLabel: string; // "Part 1" 〜 "Part 7"（模試レビュー画面での表示用）
};

export function flattenListening(steps: ListeningStep[]): AtomicQuestion[] {
  return steps.map((step) => {
    if (step.kind === "part1") {
      return {
        id: step.item.id,
        itemType: "listeningPart1" as const,
        level: step.item.level,
        correctAnswer: step.item.answer,
        qNumber: step.qNumber,
        partLabel: "Part 1",
      };
    }
    if (step.kind === "part2") {
      return {
        id: step.item.id,
        itemType: "listeningPart2" as const,
        level: step.item.level,
        correctAnswer: step.item.answer,
        qNumber: step.qNumber,
        partLabel: "Part 2",
      };
    }
    const question = step.set.questions[step.questionIndex];
    return {
      id: question.id,
      itemType: "listeningPart34" as const,
      level: question.level,
      correctAnswer: question.answer,
      qNumber: step.qNumber,
      partLabel: step.set.partType === "part3" ? "Part 3" : "Part 4",
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
        qNumber: step.qNumber,
        partLabel: "Part 5",
      });
    } else if (step.kind === "part6") {
      step.passage.blanks.forEach((blank, i) => {
        out.push({
          id: blank.id,
          itemType: "part6",
          level: blank.level,
          correctAnswer: blank.answer,
          qNumber: step.qNumberStart + i,
          partLabel: "Part 6",
        });
      });
    } else {
      const question = step.passage.questions[step.questionIndex];
      out.push({
        id: question.id,
        itemType: "reading",
        level: question.level,
        correctAnswer: question.answer,
        qNumber: step.qNumber,
        partLabel: "Part 7",
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

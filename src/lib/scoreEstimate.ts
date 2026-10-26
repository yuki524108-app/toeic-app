import type { ItemType, ProgressRecord } from "../types";

const MIN_RECORDS_FOR_ESTIMATE = 20;
const WINDOW_SIZE = 50;

/**
 * リーディングセクション相当（Part 5〜7）のうち、正誤が客観的に決まる（採点される）問題種別。
 * 単語は「わかる／わからない」の自己判定で、実際の正誤ではなく本人の申告のため、ここには含めない。
 */
const GRADED_READING_ITEM_TYPES: ItemType[] = ["grammar", "reading", "part6"];
/** 自己判定の問題種別。採点される問題が足りないときに限り、暫定値の算出に使う */
const SELF_ASSESSED_ITEM_TYPES: ItemType[] = ["word"];
/** リスニングセクション相当（Part 1〜4）とみなす問題種別 */
const LISTENING_ITEM_TYPES: ItemType[] = [
  "listeningPart1",
  "listeningPart2",
  "listeningPart34",
];

/** 正答率(0-1)を目安スコア(5-495)にマッピングするS字カーブ */
function accuracyToScore(accuracy: number): number {
  const table: [number, number, number][] = [
    // [正答率の上限, 開始スコア, 終了スコア]
    [0.2, 5, 150],
    [0.4, 150, 250],
    [0.6, 250, 350],
    [0.75, 350, 400],
    [0.85, 400, 425],
    [0.93, 425, 450],
    [0.97, 450, 470],
    [1.0, 470, 495],
  ];

  let prevBound = 0;
  for (const [upperBound, startScore, endScore] of table) {
    if (accuracy <= upperBound) {
      const rangeSize = upperBound - prevBound;
      const progress = rangeSize > 0 ? (accuracy - prevBound) / rangeSize : 1;
      return startScore + (endScore - startScore) * progress;
    }
    prevBound = upperBound;
  }
  return 495;
}

export type SectionScoreEstimate =
  | { status: "insufficient-data"; answeredCount: number; needed: number }
  | {
      status: "ok";
      score: number;
      accuracy: number;
      sampleSize: number;
      /**
       * 自己判定（単語）の解答を含む暫定値か。採点される問題が十分にたまっていない間だけ true になり、
       * たまると単語を除いた値に切り替わる（単語は正答率が高く出やすく、スコアが高めにずれるため）。
       */
      provisional: boolean;
    };

/**
 * 正解した問題の難易度一覧と全体の設問数から目安スコア(5-495)を算出する共通ロジック。
 * 通常の進捗ベース推定（`estimateSectionScore`、直近の解答履歴を使用）と、
 * 模試モード（`src/lib/mockTest.ts`、1回分の受験結果を使用）の両方から利用される。
 */
export function scoreFromResults(
  correctItemLevels: number[],
  totalCount: number
): number {
  if (totalCount === 0) return 5;
  const accuracy = correctItemLevels.length / totalCount;
  const baseScore = accuracyToScore(accuracy);
  const avgLevel =
    correctItemLevels.length > 0
      ? correctItemLevels.reduce((sum, l) => sum + l, 0) /
        correctItemLevels.length
      : 600;
  const levelAdjustment = (avgLevel - 600) * 0.05;
  return Math.round(Math.min(495, Math.max(5, baseScore + levelAdjustment)));
}

/**
 * 1セクション分（リーディング or リスニング）の解答履歴から目安スコア(5-495)を推定する。
 * 直近50問の正答率をベースに、正解した問題の難易度で補正するS字カーブ方式。
 */
function estimateSectionScore(
  records: ProgressRecord[],
  provisional = false
): SectionScoreEstimate {
  if (records.length < MIN_RECORDS_FOR_ESTIMATE) {
    return {
      status: "insufficient-data",
      answeredCount: records.length,
      needed: MIN_RECORDS_FOR_ESTIMATE,
    };
  }

  const recent = records.slice(-WINDOW_SIZE);
  const correct = recent.filter((r) => r.isCorrect);
  const accuracy = correct.length / recent.length;
  const score = scoreFromResults(
    correct.map((r) => r.itemLevel),
    recent.length
  );

  return { status: "ok", score, accuracy, sampleSize: recent.length, provisional };
}

/**
 * リーディングの目安スコア。採点される問題（文法・読解・Part 6）が必要数以上あれば、それだけで算出する。
 * 足りないときは、自己判定の単語も含めて暫定値として算出する（初回模試の直後など。初回模試は単語15問＋文法15問）。
 * それでも必要数に満たなければデータ不足とする。
 */
function estimateReadingScore(all: ProgressRecord[]): SectionScoreEstimate {
  const graded = all.filter((r) => GRADED_READING_ITEM_TYPES.includes(r.itemType));
  if (graded.length >= MIN_RECORDS_FOR_ESTIMATE) return estimateSectionScore(graded);
  const withSelfAssessed = all.filter(
    (r) =>
      GRADED_READING_ITEM_TYPES.includes(r.itemType) ||
      SELF_ASSESSED_ITEM_TYPES.includes(r.itemType)
  );
  return estimateSectionScore(withSelfAssessed, true);
}

export type TotalScoreEstimate =
  | { status: "insufficient-data" }
  | { status: "ok"; score: number; provisional: boolean };

export type ScoreEstimate = {
  /** リーディング（文法・読解・Part 6。採点された問題が足りない間は単語を含む暫定値）の目安スコア */
  reading: SectionScoreEstimate;
  /** リスニング（Part 1・2・3・4）の目安スコア */
  listening: SectionScoreEstimate;
  /** リーディング・リスニング両方のデータが揃って初めて算出される合計スコア（5-990） */
  total: TotalScoreEstimate;
};

/**
 * リーディング・リスニングそれぞれのセクションスコアを推定し、
 * 両方のデータが揃っていれば合計（総合スコア、5-990点）も算出する。
 * 一方のセクションのみデータが足りている場合、そのセクションの目安スコアは表示できるが
 * 合計は「データ不足」として返す（本番TOEICと同じく、L・R両方を測って初めて総合スコアになるため）。
 */
export function estimateScore(
  progress: Record<string, ProgressRecord>
): ScoreEstimate {
  const all = Object.values(progress).sort((a, b) =>
    a.lastAnsweredAt.localeCompare(b.lastAnsweredAt)
  );

  const listeningRecords = all.filter((r) =>
    LISTENING_ITEM_TYPES.includes(r.itemType)
  );

  const reading = estimateReadingScore(all);
  const listening = estimateSectionScore(listeningRecords);

  const total: TotalScoreEstimate =
    reading.status === "ok" && listening.status === "ok"
      ? {
          status: "ok",
          score: Math.min(990, reading.score + listening.score),
          provisional: reading.provisional,
        }
      : { status: "insufficient-data" };

  return { reading, listening, total };
}

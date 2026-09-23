import type { ProgressRecord } from "../types";

const MIN_RECORDS_FOR_ESTIMATE = 20;
const WINDOW_SIZE = 50;

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

export type ScoreEstimate =
  | { status: "insufficient-data"; answeredCount: number; needed: number }
  | { status: "ok"; score: number; accuracy: number; sampleSize: number };

export function estimateScore(
  progress: Record<string, ProgressRecord>
): ScoreEstimate {
  const records = Object.values(progress).sort(
    (a, b) => a.lastAnsweredAt.localeCompare(b.lastAnsweredAt)
  );

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

  const baseScore = accuracyToScore(accuracy);

  const avgLevel =
    correct.length > 0
      ? correct.reduce((sum, r) => sum + r.itemLevel, 0) / correct.length
      : 600;
  const levelAdjustment = (avgLevel - 600) * 0.05;

  const score = Math.round(
    Math.min(495, Math.max(5, baseScore + levelAdjustment))
  );

  return { status: "ok", score, accuracy, sampleSize: recent.length };
}

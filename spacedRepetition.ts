import type { ItemType, ProgressRecord } from "../types";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 回答結果を受け取り、次回復習日などを含む新しいProgressRecordを返す。
 * SM-2アルゴリズムを単純化したバージョン。
 */
export function updateProgress(
  itemId: string,
  itemType: ItemType,
  itemLevel: number,
  isCorrect: boolean,
  previous: ProgressRecord | undefined
): ProgressRecord {
  let easeFactor = previous?.easeFactor ?? DEFAULT_EASE;
  let repetitions = previous?.repetitions ?? 0;
  let interval = previous?.interval ?? 0;

  if (isCorrect) {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 3;
    else interval = Math.round(interval * easeFactor);
    easeFactor = Math.min(easeFactor + 0.1, 3.0);
  } else {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(easeFactor - 0.2, MIN_EASE);
  }

  return {
    itemId,
    itemType,
    itemLevel,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: addDays(interval),
    lastAnsweredAt: new Date().toISOString(),
    isCorrect,
  };
}

/** 今日出題すべきか判定（未学習 or 復習日が今日以前） */
export function isDueToday(record: ProgressRecord | undefined): boolean {
  if (!record) return true;
  return record.nextReviewDate <= new Date().toISOString().slice(0, 10);
}

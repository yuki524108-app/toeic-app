import type { AnswerConfidence, ItemType, ProgressRecord } from "../types";
import { addDaysLocal, localDateStr, todayStr } from "./date";
import { attemptsOf, wrongCountOf } from "./history";

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

function addDays(days: number): string {
  return localDateStr(addDaysLocal(new Date(), days));
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
  previous: ProgressRecord | undefined,
  confidence: AnswerConfidence = "sure"
): ProgressRecord {
  let easeFactor = previous?.easeFactor ?? DEFAULT_EASE;
  let repetitions = previous?.repetitions ?? 0;
  let interval = previous?.interval ?? 0;

  if (isCorrect && confidence === "unsure") {
    // 確信のない正解（あてずっぽう・うろ覚え・ヒントを使った正解）は、定着したとはみなさない：
    // 連続正解数と難しさの係数は進めず、翌日にもう一度出す（「何度も間違える問題」から外れる条件にも数えない）
    interval = 1;
  } else if (isCorrect) {
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
    attempts: (previous ? attemptsOf(previous) : 0) + 1,
    wrongCount: (previous ? wrongCountOf(previous) : 0) + (isCorrect ? 0 : 1),
    // 間違えた理由の記録は、解答を重ねても引き継ぐ
    ...(previous?.reasonCounts ? { reasonCounts: { ...previous.reasonCounts } } : {}),
  };
}

/** 今日出題すべきか判定（未学習 or 復習日が今日以前） */
export function isDueToday(record: ProgressRecord | undefined): boolean {
  if (!record) return true;
  return record.nextReviewDate <= todayStr();
}

import type { AppData, ProgressRecord } from "../types";

const MIN_RECORDS_FOR_RECOMMENDATION = 10;
const RECOMMENDATION_COUNT = 20;

export type AbilityEstimate =
  | { status: "insufficient-data"; answeredCount: number; needed: number }
  | { status: "ok"; targetLevel: number; accuracy: number };

/**
 * 直近の解答から「今ちょうどいい難易度」を推定する。
 * 正答率が高いほど少し難しめ、低いほど少し易しめのレベルを狙う。
 */
export function estimateAbilityLevel(
  progress: Record<string, ProgressRecord>
): AbilityEstimate {
  const records = Object.values(progress).sort((a, b) =>
    a.lastAnsweredAt.localeCompare(b.lastAnsweredAt)
  );

  if (records.length < MIN_RECORDS_FOR_RECOMMENDATION) {
    return {
      status: "insufficient-data",
      answeredCount: records.length,
      needed: MIN_RECORDS_FOR_RECOMMENDATION,
    };
  }

  const recent = records.slice(-50);
  const correct = recent.filter((r) => r.isCorrect);
  const accuracy = correct.length / recent.length;

  const avgLevel =
    recent.reduce((sum, r) => sum + r.itemLevel, 0) / recent.length;

  // 正答率70%を基準に、高ければ難易度を上げ、低ければ下げる
  const shift = (accuracy - 0.7) * 300;
  const targetLevel = Math.min(900, Math.max(400, Math.round(avgLevel + shift)));

  return { status: "ok", targetLevel, accuracy };
}

/**
 * 目標レベルに近く、まだ習熟していない項目を優先して並べ替える。
 * - 目標レベルとの距離が近いほど優先
 * - 習熟済み（連続正解3回以上）の項目は後回し
 * - 直近不正解だった項目はやや優先
 */
export function recommendItems<T extends { id: string; level: number }>(
  items: T[],
  data: AppData,
  targetLevel: number,
  count: number = RECOMMENDATION_COUNT
): T[] {
  const scored = items.map((item) => {
    const record = data.progress[item.id];
    const distance = Math.abs(item.level - targetLevel);
    const masteryPenalty =
      record && record.isCorrect && record.repetitions >= 3 ? 500 : 0;
    const wrongBonus = record && record.isCorrect === false ? -60 : 0;
    return { item, score: distance + masteryPenalty + wrongBonus };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.item);
}

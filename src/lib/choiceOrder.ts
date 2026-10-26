import type { MockTestResult } from "../types";

/**
 * 選択肢の並び順（問題データの形式）の版。
 * 2：正解の位置を均等にした並び（`tools/rebalance_choices.py` で並べ替えたもの）。
 * 結果にこの値がない（未設定）旧い模試の履歴は、並べ替え前の並び順で選択肢の番号を保存している。
 */
export const CHOICE_ORDER_VERSION = 2;

/**
 * 旧い並び順で保存された「選んだ選択肢の番号」を、現在の並び順の番号に変換する。
 *
 * 並べ替えは「正解の選択肢を目標の位置へ移し、ほかの選択肢の相対的な順序は保つ」規則で行っている
 * （`tools/rebalance_choices.py`）。そのため、旧い正解番号（記録に保存済み）と新しい正解番号
 * （現在の問題データ）の2つだけから、すべての選択肢の対応が決まる。
 */
export function legacyToCurrentIndex(
  selected: number,
  oldCorrect: number,
  newCorrect: number
): number {
  if (selected === oldCorrect) return newCorrect;
  const rank = selected < oldCorrect ? selected : selected - 1; // 正解を除いたときの位置
  return rank < newCorrect ? rank : rank + 1;
}

/** 旧い並び順で保存された履歴か（並べ替え前に受験した結果、またはその結果を含むバックアップ） */
export function isLegacyChoiceOrder(result: MockTestResult): boolean {
  return (result.choiceOrder ?? 1) < CHOICE_ORDER_VERSION;
}

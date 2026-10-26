import { addDaysLocal, localDateStr, parseLocalDate, todayStr } from "./date";

/**
 * 画面に表示する連続学習日数。
 * `data.streak` は次に学習したときに更新される（`recordAnswer`）ため、数日学習を空けても
 * 保存値は古いままになる。最終学習日が昨日より前なら連続は途切れているので0日として扱う。
 * 保存値そのものは書き換えない（次に学習したときに、従来どおり1日目からやり直しになる）。
 *
 * - 最終学習日が今日または昨日 → 保存されている連続日数
 * - 最終学習日が一昨日以前、または未設定 → 0
 */
export function displayStreak(
  streak: number,
  lastStudyDate: string | null,
  today: string = todayStr()
): number {
  if (!lastStudyDate) return 0;
  const todayDate = parseLocalDate(today);
  if (!todayDate) return streak;
  const yesterday = localDateStr(addDaysLocal(todayDate, -1));
  // YYYY-MM-DD 形式の文字列は辞書順が日付順と一致する。今日より後（端末の時計の変更など）も継続中として扱う
  return lastStudyDate >= yesterday ? streak : 0;
}

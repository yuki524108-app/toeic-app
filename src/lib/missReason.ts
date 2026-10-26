import type { MissReason, ProgressRecord } from "../types";

/**
 * 間違えた理由（2.1.30）。間違えた直後に1タップで選ぶ（任意）。理由によって効く対策が違うため、
 * 進捗画面で内訳を見て、対策の目安を確認できる。
 */
export const MISS_REASONS: { id: MissReason; label: string; hint: string; manual: boolean }[] = [
  { id: "unknown", label: "知らなかった", hint: "知識の不足。単語・文法の復習で補います", manual: true },
  { id: "careless", label: "うっかり", hint: "分かっていたのに間違えた。選ぶ前に選択肢を見直す習慣を", manual: true },
  { id: "unsure", label: "迷って外した", hint: "2択まで絞れたが外した。解説で違いを確認しましょう", manual: true },
  // 時間切れは、時間制限つきの練習（時間感覚トレーニング）で自動で付く。自分では選ばない
  { id: "timeout", label: "時間切れ", hint: "時間内に解けなかった。時間感覚トレーニングで、1問にかける時間に慣れましょう", manual: false },
];

export const MISS_REASON_LABEL: Record<MissReason, string> = Object.fromEntries(
  MISS_REASONS.map((r) => [r.id, r.label])
) as Record<MissReason, string>;

/**
 * 問題の記録に、間違えた理由を1件反映する。
 * - next：新しく選んだ理由（取り消すなら null）
 * - prev：同じ間違いに対して、直前に選んでいた理由（選び直しのとき、前の理由の分を減らす。なければ null）
 */
export function applyMissReason(
  record: ProgressRecord,
  next: MissReason | null,
  prev: MissReason | null
): ProgressRecord {
  const counts = { ...record.reasonCounts };
  if (prev && (counts[prev] ?? 0) > 0) counts[prev] = (counts[prev] ?? 0) - 1;
  if (next) counts[next] = (counts[next] ?? 0) + 1;
  return { ...record, reasonCounts: counts };
}

/** 全問題を通した、理由ごとの記録数 */
export function reasonTotals(
  progress: Record<string, ProgressRecord>
): Record<MissReason, number> {
  const total: Record<MissReason, number> = { unknown: 0, careless: 0, unsure: 0, timeout: 0 };
  for (const r of Object.values(progress)) {
    for (const { id } of MISS_REASONS) {
      const n = r.reasonCounts?.[id];
      if (typeof n === "number" && Number.isFinite(n) && n > 0) total[id] += n;
    }
  }
  return total;
}

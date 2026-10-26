import type { ItemType, ProgressRecord } from "../types";
import { PART2_TYPES, READING_TYPES, typeKeyLabel } from "./questionType";

/** 問題タイプ別の集計（2.1.31）に使う、種別ごとの設定 */
export const TYPE_GROUPS: { itemType: ItemType; label: string; types: { id: string; label: string; hint: string }[]; prefix: string }[] = [
  { itemType: "reading", label: "読解（Part 7）", prefix: "r:", types: READING_TYPES },
  { itemType: "listeningPart34", label: "リスニング Part 3・4", prefix: "r:", types: READING_TYPES },
  { itemType: "listeningPart2", label: "リスニング Part 2", prefix: "p2:", types: PART2_TYPES },
];

/** 集計の対象にする最小の解答数（これ未満のタイプは表示しない） */
export const MIN_SHOWN = 3;
/** 「弱点」とみなす最小の解答数と、正答率の上限 */
export const MIN_WEAK = 5;
export const WEAK_BELOW = 0.6;

export type TypeRow = { key: string; label: string; hint: string; answered: number; correct: number; accuracy: number; weak: boolean };
export type TypeGroup = { itemType: ItemType; label: string; rows: TypeRow[] };

/**
 * 問題タイプ別の正答率（各問題の最新の正誤）。正答率の低い順に並べる。
 * - index：設問ID → 問題タイプの索引（src/data/questionTypes.json）
 */
export function questionTypeStats(
  progress: Record<string, ProgressRecord>,
  index: Record<string, string>
): TypeGroup[] {
  return TYPE_GROUPS.map((g) => {
    const tally = new Map<string, { n: number; ok: number }>();
    for (const r of Object.values(progress)) {
      if (r.itemType !== g.itemType) continue;
      const key = index[r.itemId];
      if (!key || !key.startsWith(g.prefix)) continue;
      const v = tally.get(key) ?? { n: 0, ok: 0 };
      v.n += 1;
      if (r.isCorrect) v.ok += 1;
      tally.set(key, v);
    }
    const rows: TypeRow[] = [];
    for (const [key, v] of tally) {
      if (v.n < MIN_SHOWN) continue;
      const id = key.slice(g.prefix.length);
      const meta = g.types.find((t) => t.id === id);
      const accuracy = v.ok / v.n;
      rows.push({
        key,
        label: meta?.label ?? typeKeyLabel(key),
        hint: meta?.hint ?? "",
        answered: v.n,
        correct: v.ok,
        accuracy,
        weak: v.n >= MIN_WEAK && accuracy < WEAK_BELOW,
      });
    }
    rows.sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);
    return { itemType: g.itemType, label: g.label, rows };
  }).filter((g) => g.rows.length > 0);
}

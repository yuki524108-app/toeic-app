import type { AppData, ItemType, ProgressRecord } from "../types";
import { localDateStr, todayStr } from "./date";
import { finalizePlan, questionTypeMap } from "./dailyPlan";
import type { DailyPlan } from "./dailyPlan";
import { questionIds, shuffle, toQuickItems } from "./quickQueue";
import type { QuickCategory, QuickItem, QuickPools } from "./quickQueue";

/**
 * 基礎固め（2.1.32）。
 *
 * 何度も間違える問題（`isLeech`）で、同じ解説をもう一度読んでも定着しにくいときに、
 * 「同じ分野のやさしい問題」を先に解いてから、その問題に戻る流れを作る。
 * 分野は、文法は文法項目、Part 2・読解・Part 3/4は問題タイプ（2.1.31）。単語・Part 1・Part 6は分野がないため対象外。
 */

export const BRIDGE_KINDS: ItemType[] = ["grammar", "listeningPart2", "listeningPart34", "reading"];

export function isBridgeKind(kind: string): kind is QuickCategory {
  return (BRIDGE_KINDS as string[]).includes(kind);
}

/** 基礎固めで出す、やさしい問題の数 */
export const BRIDGE_COUNT = 3;

export type BridgePlan = DailyPlan & {
  /** 基礎固めの問題（やさしい問題）の数。0なら、この問題に基礎固めの手がかりがない */
  bridgeCount: number;
  /** 戻ってくる問題（苦手な問題）の出題単位 */
  target: QuickItem;
};

/** 出題単位の難易度。読解・Part 3/4・Part 6には文書・会話ごとの難易度がないため、設問の難易度の平均で表す */
export function levelOf(q: QuickItem): number {
  if (q.kind === "reading" || q.kind === "listeningPart34") {
    const qs = q.item.questions;
    return qs.length === 0 ? 0 : qs.reduce((n, x) => n + x.level, 0) / qs.length;
  }
  if (q.kind === "part6") {
    const bs = q.item.blanks;
    return bs.length === 0 ? 0 : bs.reduce((n, x) => n + x.level, 0) / bs.length;
  }
  return q.item.level;
}

function isMastered(r: ProgressRecord | undefined): boolean {
  return !!r && r.isCorrect && r.repetitions >= 3;
}

/**
 * 設問 itemId の基礎固めを組み立てる。やさしい問題（難易度が低く、同じ分野）を最大 BRIDGE_COUNT 問、
 * やさしい順に並べ、最後に元の問題を置く。見つからない（対象外の種別・設問がない）ときは null。
 */
export function buildBridgePlan(
  data: AppData,
  pools: QuickPools,
  kind: QuickCategory,
  itemId: string,
  opts: { count?: number; rng?: () => number; today?: string } = {}
): BridgePlan | null {
  if (!isBridgeKind(kind)) return null;
  const count = opts.count ?? BRIDGE_COUNT;
  const rng = opts.rng ?? Math.random;
  const today = opts.today ?? todayStr();

  const all = toQuickItems(kind, pools);
  const target = all.find((q) => questionIds(q).includes(itemId));
  if (!target) return null;

  // 分野の判定：文法は文法項目、それ以外は問題タイプ
  const typeOf = questionTypeMap(pools);
  const fieldsOf = (q: QuickItem): string[] =>
    q.kind === "grammar" ? [`g:${q.item.category}`] : questionIds(q).map((id) => typeOf.get(id) ?? "");
  const targetField = target.kind === "grammar" ? `g:${target.item.category}` : (typeOf.get(itemId) ?? "");
  if (!targetField) return null;

  const answeredToday = (id: string) => {
    const r = data.progress[id];
    return !!r && localDateStr(new Date(r.lastAnsweredAt)) === today;
  };

  const sameField = all.filter(
    (q) =>
      q.item.id !== target.item.id &&
      fieldsOf(q).includes(targetField) &&
      !questionIds(q).some(answeredToday) &&
      !questionIds(q).every((id) => isMastered(data.progress[id]))
  );
  // まだ解いていない・不正解のものを先に。その中で、元の問題に近い難易度（直前の段階）を優先する
  const unmastered = (q: QuickItem) => (questionIds(q).some((id) => !data.progress[id] || !data.progress[id].isCorrect) ? 0 : 1);
  const rank = (list: QuickItem[]) =>
    shuffle(list, rng).sort((a, b) => unmastered(a) - unmastered(b) || levelOf(b) - levelOf(a));

  // 「やさしい」＝難易度が低い。足りなければ、同じ難易度の問題で補う
  const easier = rank(sameField.filter((q) => levelOf(q) < levelOf(target))).slice(0, count);
  const equal = easier.length < count ? rank(sameField.filter((q) => levelOf(q) === levelOf(target))) : [];
  const chosen = [...easier, ...equal.slice(0, count - easier.length)].sort((a, b) => levelOf(a) - levelOf(b));   // 出題は、やさしい順

  const plan = finalizePlan([
    ...chosen.map((q) => ({ q, reason: "bridge" as const })),
    { q: target, reason: "leech" as const },
  ]);
  return { ...plan, bridgeCount: chosen.length, target };
}

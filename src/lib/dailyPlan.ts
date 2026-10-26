import type { AppData, ProgressRecord } from "../types";
import { localDateStr, todayStr } from "./date";
import { answerSamples, isLeech, wrongCountOf } from "./history";
import { QUICK_CATEGORIES, questionIds, quickWeight, shuffle, toQuickItems } from "./quickQueue";
import { classifyPart2Question, classifyReadingQuestion } from "./questionType";
import type { QuickCategory, QuickItem, QuickPools } from "./quickQueue";

/**
 * 今日のおすすめセット（2.1.28）。
 *
 * 「何をやるか迷う」で学習が止まらないよう、次の5種類の問題を1つのセットに混ぜて自動で組み立てる。
 * - 苦手：何度も間違えていて、まだ定着していない問題（`isLeech`）
 * - 復習：復習日を迎えた問題（前回間違えたものを先に）
 * - 弱点の補強：正答率の低い種別・文法の分野の問題
 * - 新しい問題：まだ解いていない問題（弱点の分野のものを先に）
 * - おさらい：上のどれにも当たらないときの穴埋め（復習日が近い順）
 * 出題と解答の画面は、すきま時間モードのものをそのまま使う。
 */

export type PlanReason = "leech" | "dueWrong" | "due" | "weak" | "new" | "other" | "bridge";

export const PLAN_REASON_LABEL: Record<PlanReason, string> = {
  leech: "苦手",
  dueWrong: "復習（前回間違えた問題）",
  due: "復習",
  weak: "弱点の補強",
  new: "新しい問題",
  other: "おさらい",
  bridge: "基礎固め（やさしい問題）",
};

/** 優先順位（先ほど優先）。セットは含まれる設問のうち最も優先度の高いものに合わせる */
/** 「基礎固め」は、苦手な問題の前に出す、同じ分野のやさしい問題（2.1.32）。通常の組み立てには出てこない */
const REASON_ORDER: PlanReason[] = ["leech", "dueWrong", "due", "weak", "new", "other"];

export const DEFAULT_PLAN_COUNT = 10;

/** この正答率を下回る種別・分野を「弱点」とみなす */
export const WEAK_ACCURACY = 0.6;
/** 種別（単語・文法など）の弱点判定に必要な最小の解答数 */
const MIN_SAMPLES_TYPE = 10;
/** 文法の分野ごとの弱点判定に必要な最小の解答数 */
const MIN_SAMPLES_CATEGORY = 5;

/** セットの構成の目安（問題数に対する割合）。足りない種類は、他の種類で埋める */
const QUOTA: { reasons: PlanReason[]; ratio: number }[] = [
  { reasons: ["leech"], ratio: 0.2 },
  { reasons: ["dueWrong", "due"], ratio: 0.4 },
  { reasons: ["weak"], ratio: 0.2 },
  { reasons: ["new"], ratio: 0.2 },
];

/** 解答が少ない問題タイプは、たまたまの不正解で弱点にしない（文法の分野と同じ考え方） */
const MIN_SAMPLES_QTYPE = 5;

export type WeakGroups = {
  types: Set<QuickCategory>;
  grammarCategories: Set<string>;
  /** 弱点の問題タイプ（読解・Part 3/4は "r:inference" など、Part 2は "p2:who" など。2.1.31） */
  questionTypes: Set<string>;
};

/** 設問ID → 問題タイプ（読解・Part 3/4・Part 2）。問題文の英文から規則で判定する（2.1.31） */
export function questionTypeMap(pools: QuickPools): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of pools.reading) for (const q of p.questions) m.set(q.id, `r:${classifyReadingQuestion(q.question)}`);
  for (const s of pools.listeningPart34) for (const q of s.questions) m.set(q.id, `r:${classifyReadingQuestion(q.question)}`);
  for (const q of pools.listeningPart2) m.set(q.id, `p2:${classifyPart2Question(q.question)}`);
  return m;
}

/** 弱点の種別・文法の分野（直近の解答の正答率から判定する） */
export function findWeakGroups(
  data: AppData,
  pools: QuickPools,
  typeOf: Map<string, string> = questionTypeMap(pools)
): WeakGroups {
  const samples = answerSamples(data);
  const categoryOf = new Map(pools.grammar.map((g) => [g.id, g.category]));

  const byType = new Map<string, { n: number; ok: number }>();
  const byCategory = new Map<string, { n: number; ok: number }>();
  const byQType = new Map<string, { n: number; ok: number }>();
  const add = (m: Map<string, { n: number; ok: number }>, key: string, ok: boolean) => {
    const v = m.get(key) ?? { n: 0, ok: 0 };
    v.n += 1;
    if (ok) v.ok += 1;
    m.set(key, v);
  };
  for (const s of samples) {
    add(byType, s.type, s.correct);
    if (s.type === "grammar") {
      const c = categoryOf.get(s.id);
      if (c) add(byCategory, c, s.correct);
    }
    const qt = typeOf.get(s.id);
    if (qt) add(byQType, qt, s.correct);
  }
  const weak = (v: { n: number; ok: number }, min: number) =>
    v.n >= min && v.ok / v.n < WEAK_ACCURACY;

  const types = new Set<QuickCategory>();
  for (const c of QUICK_CATEGORIES) {
    const v = byType.get(c.id);
    if (v && weak(v, MIN_SAMPLES_TYPE)) types.add(c.id);
  }
  const grammarCategories = new Set<string>();
  for (const [name, v] of byCategory) if (weak(v, MIN_SAMPLES_CATEGORY)) grammarCategories.add(name);
  const questionTypes = new Set<string>();
  for (const [key, v] of byQType) if (weak(v, MIN_SAMPLES_QTYPE)) questionTypes.add(key);
  return { types, grammarCategories, questionTypes };
}

type Classified = { q: QuickItem; reason: PlanReason; key: number; weakGroup: boolean };

function classifyQuestion(
  record: ProgressRecord | undefined,
  inWeakGroup: boolean,
  today: string
): PlanReason {
  if (!record) return "new";
  // 今日すでに解いた問題は、同じ日に続けて出さない（他に出す問題がないときの穴埋めにだけ使う）
  const answeredOn = new Date(record.lastAnsweredAt);
  if (!Number.isNaN(answeredOn.getTime()) && localDateStr(answeredOn) === today) return "other";
  if (isLeech(record)) return "leech";
  if (record.nextReviewDate <= today) return record.isCorrect ? "due" : "dueWrong";
  return inWeakGroup ? "weak" : "other";
}

function classify(
  q: QuickItem,
  data: AppData,
  weak: WeakGroups,
  typeIndex: Map<string, string>,
  today: string
): Classified {
  const inWeakGroup =
    weak.types.has(q.kind) ||
    (q.kind === "grammar" && weak.grammarCategories.has(q.item.category)) ||
    // 弱点の問題タイプ（例：読解の「推測」）の設問を含む出題単位（2.1.31）
    (weak.questionTypes.size > 0 && questionIds(q).some((id) => weak.questionTypes.has(typeIndex.get(id) ?? "")));
  let best: PlanReason = "other";
  let key = 0;
  for (const id of questionIds(q)) {
    const record = data.progress[id];
    const reason = classifyQuestion(record, inWeakGroup, today);
    if (REASON_ORDER.indexOf(reason) < REASON_ORDER.indexOf(best)) best = reason;
  }
  // 同じ種類の中での並び順（小さいほど先）
  const records = questionIds(q).map((id) => data.progress[id]);
  if (best === "leech") {
    key = -Math.max(...records.map((r) => (r ? wrongCountOf(r) : 0)));
  } else if (best === "dueWrong" || best === "due" || best === "other") {
    const dates = records.filter((r): r is ProgressRecord => !!r).map((r) => r.nextReviewDate);
    key = dates.length > 0 ? Number(dates.sort()[0].replaceAll("-", "")) : 0;
  } else if (best === "new") {
    key = inWeakGroup ? 0 : 1; // 弱点の分野の新しい問題を先に
  }
  return { q, reason: best, key, weakGroup: inWeakGroup };
}

/** 同じ種類の中で、優先度順を保ちつつカテゴリが偏らないよう、カテゴリを順番に取り出して並べる */
function interleaveByCategory(items: Classified[], rng: () => number): Classified[] {
  const groups = new Map<QuickCategory, Classified[]>();
  for (const c of items) {
    const g = groups.get(c.q.kind) ?? [];
    g.push(c);
    groups.set(c.q.kind, g);
  }
  const lists = shuffle([...groups.values()], rng);
  const out: Classified[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

export type DailyPlan = {
  queue: QuickItem[];
  /** 出題単位のID → 出題の理由（画面の表示用） */
  reasons: Record<string, PlanReason>;
  /** 理由ごとの設問数 */
  breakdown: Record<PlanReason, number>;
  /** 設問数の合計 */
  total: number;
  /** 所要時間の目安（分）。最低1分 */
  minutes: number;
};

export type PlanOptions = {
  count?: number;
  /** 出題してよいカテゴリ。指定がなければすべて（音声が使えない端末ではリスニングを除く、など呼び出し側で決める） */
  categories?: QuickCategory[];
  /** 指定すると、これらの理由の問題だけで組み立てる（「苦手な問題だけ練習」など） */
  onlyReasons?: PlanReason[];
  rng?: () => number;
  today?: string;
};

export function buildDailyPlan(data: AppData, pools: QuickPools, opts: PlanOptions = {}): DailyPlan {
  const count = opts.count ?? DEFAULT_PLAN_COUNT;
  const rng = opts.rng ?? Math.random;
  const today = opts.today ?? todayStr();
  const categories = opts.categories ?? QUICK_CATEGORIES.map((c) => c.id);
  const only = opts.onlyReasons;

  const typeIndex = questionTypeMap(pools);
  const weak = findWeakGroups(data, pools, typeIndex);
  const all: Classified[] = categories
    .flatMap((c) => toQuickItems(c, pools))
    .map((q) => classify(q, data, weak, typeIndex, today))
    .filter((c) => !only || only.includes(c.reason));

  // 種類ごとの候補（優先度順→同順位はランダム→カテゴリを順番に）
  const bucket = (reason: PlanReason): Classified[] => {
    const sorted = shuffle(
      all.filter((c) => c.reason === reason),
      rng
    ).sort((a, b) => a.key - b.key);
    return interleaveByCategory(sorted, rng);
  };
  const buckets = new Map(REASON_ORDER.map((r) => [r, bucket(r)]));

  const picked: Classified[] = [];
  const pickedIds = new Set<string>();
  let remaining = count;

  /** list から、合計の重みが budget に収まる範囲で取り出す */
  const take = (list: Classified[], budget: number) => {
    let left = Math.min(budget, remaining);
    for (const c of list) {
      if (left <= 0) break;
      if (pickedIds.has(c.q.item.id)) continue;
      const w = quickWeight(c.q);
      if (w > left) continue;
      picked.push(c);
      pickedIds.add(c.q.item.id);
      left -= w;
      remaining -= w;
    }
  };

  // 1周目：構成の目安どおりに取る（「だけ」の指定があるときは省く）
  if (!only) {
    for (const { reasons, ratio } of QUOTA) {
      const budget = Math.ceil(count * ratio);
      for (const r of reasons) {
        const used = picked.reduce((s, c) => s + (reasons.includes(c.reason) ? quickWeight(c.q) : 0), 0);
        take(buckets.get(r) ?? [], budget - used);
      }
    }
  }
  // 2周目：足りない分を、優先順位の順に埋める
  for (const r of REASON_ORDER) take(buckets.get(r) ?? [], remaining);

  // まだ足りない場合は、超過が不足より小さくなるときに限り、収まらなかった1つを足す（すきま時間モードと同じ考え方）
  if (remaining > 0) {
    for (const r of REASON_ORDER) {
      const over = (buckets.get(r) ?? []).find(
        (c) => !pickedIds.has(c.q.item.id) && quickWeight(c.q) - remaining < remaining
      );
      if (over) {
        picked.push(over);
        break;
      }
    }
  }

  return finalizePlan(shuffle(picked, rng).map((c) => ({ q: c.q, reason: c.reason })));
}

/** 出題の並び（順番どおり）から、理由の一覧・内訳・問題数・所要時間をまとめる */
export function finalizePlan(ordered: { q: QuickItem; reason: PlanReason }[]): DailyPlan {
  const breakdown: Record<PlanReason, number> = {
    leech: 0, dueWrong: 0, due: 0, weak: 0, new: 0, other: 0, bridge: 0,
  };
  const reasons: Record<string, PlanReason> = {};
  let seconds = 0;
  for (const { q, reason } of ordered) {
    breakdown[reason] += quickWeight(q);
    reasons[q.item.id] = reason;
    const perQuestion = QUICK_CATEGORIES.find((x) => x.id === q.kind)?.seconds ?? 40;
    seconds += perQuestion * quickWeight(q);
  }
  const queue = ordered.map((e) => e.q);
  const total = queue.reduce((s, q) => s + quickWeight(q), 0);
  return { queue, reasons, breakdown, total, minutes: Math.max(1, Math.round(seconds / 60)) };
}

/** ホームの案内用：復習日を迎えた（解いたことのある）問題の数と、何度も間違える問題の数 */
export function summarizeStudyNeeds(
  progress: Record<string, ProgressRecord>,
  today: string = todayStr()
): { reviewDue: number; leech: number } {
  let reviewDue = 0;
  let leech = 0;
  for (const r of Object.values(progress)) {
    if (r.nextReviewDate <= today) reviewDue += 1;
    if (isLeech(r)) leech += 1;
  }
  return { reviewDue, leech };
}

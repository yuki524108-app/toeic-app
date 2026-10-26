import { describe, it, expect } from "vitest";
import type { AppData, ProgressRecord } from "../../src/types";
import type { QuickPools } from "../../src/lib/quickQueue";
import { quickWeight } from "../../src/lib/quickQueue";
import { buildDailyPlan, findWeakGroups, summarizeStudyNeeds } from "../../src/lib/dailyPlan";
import { makeAnswerEvent } from "../../src/lib/history";

const TODAY = "2026-10-09";
const OLD = "2026-10-01T00:00:00.000Z";     // 今日より前に解いた
// 種が小さくても偏らない乱数（mulberry32）
const seq = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
function pools(o: { word?: number; grammar?: number; p34?: number; cats?: string[]; reading?: { id: string; qs: [string, string][] }[]; p2?: [string, string][] } = {}): QuickPools {
  const cats = o.cats ?? ["時制", "前置詞"];
  return {
    word: ids("w", o.word ?? 40).map((id) => ({ id, level: 600 })),
    grammar: ids("g", o.grammar ?? 40).map((id, i) => ({ id, level: 600, category: cats[i % cats.length] })),
    listeningPart1: [], listeningPart2: (o.p2 ?? []).map(([id, question]) => ({ id, level: 600, question })),
    listeningPart34: ids("s", o.p34 ?? 0).map((id) => ({ id, questions: [0, 1, 2].map((k) => ({ id: `${id}q${k}`, question: "What is mentioned?" })) })),
    part6: [],
    reading: (o.reading ?? []).map((p) => ({ id: p.id, level: 600, questions: p.qs.map(([id, question]) => ({ id, question })) })),
  } as unknown as QuickPools;
}
const rec = (id: string, o: Partial<ProgressRecord> = {}): ProgressRecord => ({
  itemId: id, itemType: id.startsWith("g") ? "grammar" : "word", itemLevel: 600, easeFactor: 2.5, interval: 3, repetitions: 1,
  nextReviewDate: "2026-12-01", lastAnsweredAt: OLD, isCorrect: true, attempts: 1, wrongCount: 0, ...o,
});
const leech = (id: string) => rec(id, { isCorrect: false, repetitions: 0, wrongCount: 4, attempts: 5, nextReviewDate: "2026-12-01" });
const dueWrong = (id: string) => rec(id, { isCorrect: false, repetitions: 0, wrongCount: 1, nextReviewDate: "2026-10-05" });
const dueOk = (id: string) => rec(id, { nextReviewDate: "2026-10-05" });
const data = (list: ProgressRecord[], history: AppData["answerHistory"] = []): AppData => ({
  progress: Object.fromEntries(list.map((r) => [r.itemId, r])), answerHistory: history, dailyLogs: {}, streak: 0,
  lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2,
});
const plan = (d: AppData, p: QuickPools, o = {}) => buildDailyPlan(d, p, { today: TODAY, rng: seq(), ...o });

describe("今日のおすすめセット: 構成", () => {
  it("何も解いていなければ、新しい問題で10問になる", () => {
    const r = plan(data([]), pools());
    expect(r.total).toBe(10);
    expect(r.breakdown.new).toBe(10);
  });
  it("苦手・復習・新規が十分にあれば、目安どおり（苦手2・復習4・弱点2・新規2）に混ざる", () => {
    // 弱点の分野：文法「時制」を5問以上、正答率60%未満で解いている状態にする
    const weakHistory = ids("g", 20).filter((_, i) => i % 2 === 0).map((id) => makeAnswerEvent(rec(id, { isCorrect: false })));
    const okHistory = Array.from({ length: 30 }, (_, i) => makeAnswerEvent(rec(`w${i}`, { isCorrect: true })));
    const records = [
      ...ids("w", 5).map(leech),                                             // 苦手 5
      ...ids("w", 15).slice(5).map((id, i) => (i % 2 ? dueOk(id) : dueWrong(id))),   // 復習 10
      ...["g0", "g2", "g4", "g6", "g8", "g10"].map((id) => rec(id, { isCorrect: false, nextReviewDate: "2026-12-01", repetitions: 1, wrongCount: 1 })),  // 弱点（復習日はまだ先）
    ];
    const r = plan(data(records, [...okHistory, ...weakHistory]), pools());
    expect(r.total).toBe(10);
    expect(r.breakdown.leech).toBe(2);
    expect(r.breakdown.dueWrong + r.breakdown.due).toBe(4);
    expect(r.breakdown.weak).toBe(2);
    expect(r.breakdown.new).toBe(2);
  });
  it("復習の枠が足りないときは、前回間違えた問題を先に出す", () => {
    const records = [...ids("w", 4).map(dueOk), ...ids("g", 4).map(dueWrong)];
    const r = plan(data(records), pools({ word: 4, grammar: 4 }), { count: 4 });
    expect(r.breakdown).toMatchObject({ dueWrong: 4, due: 0 });
  });
  it("目安の枠で埋まらなかった分は、優先順位の高い種類（苦手→復習→…）から埋める", () => {
    const r = plan(data(ids("w", 3).map(leech)), pools());
    expect(r.total).toBe(10);
    expect(r.breakdown.leech).toBe(3);   // 苦手の目安は2問だが、残りの枠は苦手を先に埋める
    expect(r.breakdown.new).toBe(7);
  });
});

describe("今日のおすすめセット: 除外と絞り込み", () => {
  it("今日すでに解いた問題は、他に出す問題があるかぎり出さない", () => {
    const solvedToday = (id: string) => rec(id, { lastAnsweredAt: "2026-10-09T01:00:00.000Z", isCorrect: false, repetitions: 0, wrongCount: 5 });
    const r = plan(data(ids("w", 10).map(solvedToday)), pools({ word: 10, grammar: 10 }), { count: 10 });
    expect(r.queue.every((q) => q.kind === "grammar")).toBe(true);
  });
  it("苦手な問題だけの指定では、苦手な問題だけで組み立てる。無ければ空", () => {
    const r = plan(data([...ids("w", 3).map(leech), ...ids("g", 5).map(dueWrong)]), pools(), { onlyReasons: ["leech"] });
    expect(r.queue.map((q) => q.item.id).sort()).toEqual(["w0", "w1", "w2"]);
    expect(plan(data([]), pools(), { onlyReasons: ["leech"] }).queue).toEqual([]);
  });
  it("categories で除いたカテゴリ（音声が使えない端末のリスニングなど）は出さない", () => {
    const r = plan(data([]), pools({ p34: 10 }), { categories: ["word", "grammar"] });
    expect(r.queue.every((q) => q.kind !== "listeningPart34")).toBe(true);
  });
  it("カテゴリが偏らず、単語と文法が混ざる", () => {
    const r = plan(data([]), pools());
    expect(new Set(r.queue.map((q) => q.kind))).toEqual(new Set(["word", "grammar"]));
  });
});

describe("今日のおすすめセット: セット型と理由", () => {
  it("Part 3・4は3問まとめて1つとして数え、合計は目安を大きく超えない", () => {
    const r = plan(data([]), pools({ word: 0, grammar: 0, p34: 10 }), { count: 10 });
    expect(r.queue.every((q) => q.kind === "listeningPart34")).toBe(true);
    expect(r.total).toBe(r.queue.reduce((s, q) => s + quickWeight(q), 0));
    expect(r.total).toBeGreaterThanOrEqual(9);
    expect(r.total).toBeLessThanOrEqual(12);
  });
  it("セットは、含まれる設問のうち最も優先度の高い理由になる", () => {
    const d = data([leech("s0q1"), rec("s1q0", { nextReviewDate: "2026-10-05" })]);
    const r = plan(d, pools({ word: 0, grammar: 0, p34: 2 }), { count: 6 });
    expect(r.reasons).toMatchObject({ s0: "leech", s1: "due" });
  });
  it("理由の内訳の合計は、問題数の合計と一致し、所要時間は1分以上", () => {
    const r = plan(data([leech("w1"), dueWrong("w2")]), pools());
    expect(Object.values(r.breakdown).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(r.minutes).toBeGreaterThanOrEqual(1);
    expect(Object.keys(r.reasons).length).toBe(r.queue.length);
  });
  it("同じ乱数なら同じセットになる（再現できる）", () => {
    const d = data([...ids("w", 6).map(dueWrong)]);
    const a = plan(d, pools(), { rng: seq(7) }).queue.map((q) => q.item.id);
    const b = plan(d, pools(), { rng: seq(7) }).queue.map((q) => q.item.id);
    expect(a).toEqual(b);
  });
});

describe("弱点の種別・文法の分野の判定", () => {
  it("解答が少ない分野は、正答率が低くても弱点にしない（最小件数に満たない）", () => {
    const h = ids("g", 4).map((id) => makeAnswerEvent(rec(id, { isCorrect: false })));
    const filler = Array.from({ length: 30 }, (_, i) => makeAnswerEvent(rec(`w${i}`)));
    const w = findWeakGroups(data([], [...filler, ...h]), pools());
    expect(w.grammarCategories.size).toBe(0);
  });
  it("正答率60%未満で、件数が足りていれば弱点になる", () => {
    const wrong = ["g0", "g2", "g4", "g6", "g8"].map((id) => makeAnswerEvent(rec(id, { isCorrect: false })));  // すべて「時制」
    const filler = Array.from({ length: 30 }, (_, i) => makeAnswerEvent(rec(`w${i}`)));
    const w = findWeakGroups(data([], [...filler, ...wrong]), pools());
    expect([...w.grammarCategories]).toEqual(["時制"]);
    expect(w.types.has("grammar")).toBe(false);   // 文法全体では5問しか間違えておらず、種別の判定件数（10件）に満たない
  });
  it("履歴が少ないうちは、進捗の最新の正誤から判定する", () => {
    const records = ids("w", 12).map((id) => rec(id, { isCorrect: false }));
    expect(findWeakGroups(data(records), pools()).types.has("word")).toBe(true);
  });
});

describe("弱点の問題タイプ（読解・Part 2。2.1.31）", () => {
  const reading = [
    { id: "rA", qs: [["rAq1", "What does the writer imply about the offer?"]] as [string, string][] },   // 推測
    { id: "rB", qs: [["rBq1", "When does the sale end?"]] as [string, string][] },                       // 詳細
  ];
  const p2 = [["p2a", "Who approved the budget?"], ["p2b", "When is the deadline?"]] as [string, string][];
  const history = (ids: string[], correct: boolean) => ids.map((id) => makeAnswerEvent({ ...rec(id), itemType: "reading", isCorrect: correct }));
  const filler = Array.from({ length: 30 }, (_, i) => makeAnswerEvent(rec(`w${i}`)));

  it("正答率60%未満で5問以上解いた問題タイプが弱点になる。少ないタイプは弱点にしない", () => {
    const inference = ["i1", "i2", "i3", "i4", "i5"];
    const typeMap = new Map(inference.map((id) => [id, "r:inference"]));
    const w = findWeakGroups(data([], [...filler, ...history(inference, false)]), pools({ reading }), typeMap);
    expect([...w.questionTypes]).toEqual(["r:inference"]);
    const few = findWeakGroups(data([], [...filler, ...history(inference.slice(0, 4), false)]), pools({ reading }), new Map(inference.map((id) => [id, "r:inference"])));
    expect(few.questionTypes.size).toBe(0);
  });
  it("問題文から判定し、弱点のタイプを含む出題単位が「弱点の補強」として優先される", () => {
    // 読解の「推測」の問題を5問間違えた履歴（IDは実在の設問に合わせ、rAq1 と同じタイプの別の問題として扱う）
    const extra = ["rX1", "rX2", "rX3", "rX4"].map((id) => ({ id: `rx${id}`, qs: [[id, "What is implied about the product?"]] as [string, string][] }));
    const all = [...reading, ...extra];
    const wrong = history(["rAq1", "rX1", "rX2", "rX3", "rX4"], false);
    // 解いた記録（復習日はまだ先）：推測の問題は弱点、詳細の rBq1 は普通
    const records = ["rAq1", "rX1", "rX2", "rX3", "rX4", "rBq1"].map((id) => rec(id, { itemType: "reading", isCorrect: id === "rBq1" } as never));
    const r = plan(data(records, [...filler, ...wrong]), pools({ word: 0, grammar: 0, reading: all }), { count: 3, categories: ["reading"] });
    const weakIds = Object.entries(r.reasons).filter(([, v]) => v === "weak").map(([k]) => k);
    expect(weakIds.length).toBeGreaterThan(0);
    expect(weakIds.every((id) => id !== "rB")).toBe(true);     // 詳細の文書は弱点として扱われない
  });
  it("Part 2は、発話の問題タイプで弱点を判定する", () => {
    const w = findWeakGroups(
      data([], [...filler, ...["p2a", "p2z1", "p2z2", "p2z3", "p2z4"].map((id) => makeAnswerEvent({ ...rec(id), itemType: "listeningPart2", isCorrect: false }))]),
      pools({ p2 }),
      new Map(["p2a", "p2z1", "p2z2", "p2z3", "p2z4"].map((id) => [id, "p2:who"]))
    );
    expect([...w.questionTypes]).toEqual(["p2:who"]);
  });
});

describe("ホームの案内用の集計", () => {
  it("復習日を迎えた（解いたことのある）問題と、何度も間違える問題の数", () => {
    const d = data([dueOk("w1"), dueWrong("w2"), leech("w3"), rec("w4")]);
    expect(summarizeStudyNeeds(d.progress, TODAY)).toEqual({ reviewDue: 2, leech: 1 });
  });
});

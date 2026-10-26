import { describe, it, expect } from "vitest";
import type { AppData, ProgressRecord } from "../../src/types";
import type { QuickPools } from "../../src/lib/quickQueue";
import { BRIDGE_COUNT, buildBridgePlan, isBridgeKind, levelOf } from "../../src/lib/bridge";
import { toQuickItems } from "../../src/lib/quickQueue";

const TODAY = "2026-10-09";
const seq = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
type G = [id: string, level: number, category: string];
const pools = (o: { grammar?: G[]; reading?: { id: string; qs: [string, string, number][] }[]; p2?: [string, string, number][]; p34?: { id: string; qs: [string, string, number][] }[] } = {}): QuickPools => ({
  word: [], listeningPart1: [], part6: [],
  grammar: (o.grammar ?? []).map(([id, level, category]) => ({ id, level, category })),
  listeningPart2: (o.p2 ?? []).map(([id, question, level]) => ({ id, question, level })),
  listeningPart34: (o.p34 ?? []).map((s) => ({ id: s.id, questions: s.qs.map(([id, question, level]) => ({ id, question, level })) })),
  reading: (o.reading ?? []).map((p) => ({ id: p.id, questions: p.qs.map(([id, question, level]) => ({ id, question, level })) })),
} as unknown as QuickPools);
const rec = (id: string, o: Partial<ProgressRecord> = {}): ProgressRecord => ({ itemId: id, itemType: "grammar", itemLevel: 600, easeFactor: 2.5, interval: 3, repetitions: 1, nextReviewDate: "2026-12-01", lastAnsweredAt: "2026-10-01T00:00:00.000Z", isCorrect: true, attempts: 1, wrongCount: 0, ...o });
const data = (list: ProgressRecord[] = []): AppData => ({ progress: Object.fromEntries(list.map((r) => [r.itemId, r])), answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 });
const build = (d: AppData, p: QuickPools, kind: "grammar" | "reading" | "listeningPart2" | "listeningPart34", id: string, o = {}) => buildBridgePlan(d, p, kind, id, { today: TODAY, rng: seq(), ...o });
const ids = (r: NonNullable<ReturnType<typeof build>>) => r.queue.map((q) => q.item.id);

describe("基礎固め（文法）", () => {
  const grammar: G[] = [["t", 800, "時制"], ["a", 400, "時制"], ["b", 500, "時制"], ["c", 600, "時制"], ["d", 700, "時制"], ["x", 450, "前置詞"], ["same", 800, "時制"]];
  it("同じ文法項目のやさしい問題を、元の問題に近い難易度から最大3問選び、やさしい順に並べ、最後に元の問題を置く", () => {
    const r = build(data(), pools({ grammar }), "grammar", "t")!;
    expect(ids(r)).toEqual(["b", "c", "d", "t"]);   // a(400) は4番目に近いので外れる
    expect(r.bridgeCount).toBe(BRIDGE_COUNT);
    expect(r.reasons).toMatchObject({ b: "bridge", c: "bridge", d: "bridge", t: "leech" });
    expect(r.total).toBe(4);
  });
  it("別の文法項目の問題は選ばない", () => {
    expect(ids(build(data(), pools({ grammar }), "grammar", "t")!)).not.toContain("x");
  });
  it("定着済み（確信ありで連続3回正解）の問題と、今日すでに解いた問題は選ばない", () => {
    const d = data([rec("d", { repetitions: 3 }), rec("c", { lastAnsweredAt: "2026-10-09T01:00:00.000Z" })]);
    // 残るやさしい問題は a・b の2問。足りない1問は、同じ難易度（800）の問題で補う
    expect(ids(build(d, pools({ grammar }), "grammar", "t")!)).toEqual(["a", "b", "same", "t"]);
  });
  it("同じ難易度の問題は、やさしい問題が足りないときだけ補う（やさしい問題を後回しにしない）", () => {
    const g: G[] = [["t", 800, "時制"], ["e1", 500, "時制"], ["e2", 400, "時制"], ["e3", 300, "時制"], ["s1", 800, "時制"]];
    expect(ids(build(data(), pools({ grammar: g }), "grammar", "t")!)).toEqual(["e3", "e2", "e1", "t"]);
  });
  it("まだ解いていない・不正解の問題を、定着していない順に先に選ぶ", () => {
    const d = data([rec("d"), rec("c"), rec("b", { isCorrect: false, repetitions: 0 })]);   // d・c は正解済み、b は不正解、a は未解答
    expect(ids(build(d, pools({ grammar }), "grammar", "t", { count: 2 })!)).toEqual(["a", "b", "t"]);
  });
  it("やさしい問題が足りなければ、同じ難易度の問題も含める", () => {
    const r = build(data(), pools({ grammar: [["t", 800, "時制"], ["same", 800, "時制"]] }), "grammar", "t")!;
    expect(ids(r)).toEqual(["same", "t"]);
  });
  it("同じ分野にほかの問題が無ければ、基礎固めは0問（呼び出し側が始めない判断をする）", () => {
    const r = build(data(), pools({ grammar: [["t", 800, "時制"], ["x", 400, "前置詞"]] }), "grammar", "t")!;
    expect(r.bridgeCount).toBe(0);
    expect(ids(r)).toEqual(["t"]);
  });
});

describe("基礎固め（読解・リスニング）", () => {
  it("読解は、同じ問題タイプ（例：推測）の設問を含む、やさしい文書を選ぶ", () => {
    const reading = [
      { id: "R-hard", qs: [["R-hard-q1", "What is implied about the offer?", 800] as [string, string, number]] },
      { id: "R-easy1", qs: [["R-easy1-q1", "What does the writer suggest?", 500] as [string, string, number]] },
      { id: "R-easy2", qs: [["R-easy2-q1", "What might happen to the price?", 600] as [string, string, number]] },
      { id: "R-detail", qs: [["R-detail-q1", "When does the sale end?", 400] as [string, string, number]] },   // 詳細：選ばない
    ];
    const r = build(data(), pools({ reading }), "reading", "R-hard-q1")!;
    expect(ids(r)).toEqual(["R-easy1", "R-easy2", "R-hard"]);
  });
  it("Part 2は、同じ応答のタイプ（例：Who）の問題を選ぶ", () => {
    const p2: [string, string, number][] = [["T", "Who approved the budget?", 800], ["w1", "Who is in charge?", 500], ["w2", "Who's covering the desk?", 600], ["x", "When is the deadline?", 400]];
    expect(ids(build(data(), pools({ p2 }), "listeningPart2", "T")!)).toEqual(["w1", "w2", "T"]);
  });
  it("Part 3/4は、会話の中の設問の問題タイプで探し、難易度は設問の平均で比べる", () => {
    const p34 = [
      { id: "S-hard", qs: [["S-hard-1", "What problem does the man mention?", 800], ["S-hard-2", "What will he do next?", 800]] as [string, string, number][] },
      { id: "S-easy", qs: [["S-easy-1", "What problem is the woman concerned about?", 500], ["S-easy-2", "Why is she calling?", 600]] as [string, string, number][] },
    ];
    expect(levelOf(toQuickItems("listeningPart34", pools({ p34 }))[1])).toBe(550);
    expect(ids(build(data(), pools({ p34 }), "listeningPart34", "S-hard-1")!)).toEqual(["S-easy", "S-hard"]);
  });
});

describe("基礎固めの対象外", () => {
  it("分野のない種別（単語・Part 1・Part 6）は対象外で null", () => {
    expect(isBridgeKind("word")).toBe(false);
    expect(isBridgeKind("part6")).toBe(false);
    expect(isBridgeKind("grammar")).toBe(true);
    expect(buildBridgePlan(data(), pools(), "word" as never, "w1")).toBeNull();
  });
  it("設問が見つからないときは null", () => {
    expect(build(data(), pools({ grammar: [["a", 500, "時制"]] }), "grammar", "nope")).toBeNull();
  });
  it("同じ乱数なら同じ結果になる", () => {
    const grammar: G[] = [["t", 800, "時制"], ...Array.from({ length: 8 }, (_, i): G => [`e${i}`, 500, "時制"])];
    const a = ids(build(data(), pools({ grammar }), "grammar", "t", { rng: seq(5) })!);
    const b = ids(build(data(), pools({ grammar }), "grammar", "t", { rng: seq(5) })!);
    expect(a).toEqual(b);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildMockTest, buildSeenIndex, findRepeatShortages, flattenListening, flattenReading, MOCK_TEST_COUNTS,
} from "../../src/lib/mockTest";
import part34 from "../../src/data/listeningPart34.json";
import readings from "../../src/data/readings.json";
import type { MockTestResult, ReadingPassage } from "../../src/types";

type Set34 = { id: string; partType: string; questions: { id: string }[] };
const SETS = part34 as unknown as Set34[];
const part3 = SETS.filter((s) => s.partType === "part3" && s.questions.length === 3);
const triple = (readings as ReadingPassage[]).filter((p) => p.type === "triple");

type Test = ReturnType<typeof buildMockTest>;
const atomic = (t: Test) => [...flattenListening(t.listeningSteps), ...flattenReading(t.readingSteps)];
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
const rec = (id: string, sel: number | null = 0) => ({ id, itemType: "x", level: 600, correctAnswer: 0, selectedAnswer: sel, qNumber: 1, partLabel: "x" });
const res = (i: number, ids: string[], sel: number | null = 0) =>
  ({ id: day(i), completedAt: day(i), listening: {}, reading: {}, totalScore: 0, answerRecords: ids.map((id) => rec(id, sel)) }) as unknown as MockTestResult;
const resultOf = (t: Test, i: number) => res(i, atomic(t).map((q) => q.id));
const qids = (sets: { questions?: { id: string }[] }[]) => sets.flatMap((s) => (s.questions ?? []).map((q) => q.id));
const shown = (t: Test) => [...new Set([...t.listeningSteps, ...t.readingSteps].map((s) => ("set" in s ? s.set.id : "passage" in s ? s.passage.id : s.item.id)))];
const tripleIds = (t: Test) => shown(t).filter((id) => triple.some((p) => p.id === id));
const overlap = (a: Test, b: Test) => { const s = new Set(atomic(a).map((q) => q.id)); return atomic(b).filter((q) => s.has(q.id)).length; };
const seeded = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

describe("模試の構成", () => {
  it("200問（リスニング100・リーディング100）で、設問IDに重複がなく、各パートの出題数が決まりどおり", () => {
    const t = buildMockTest();
    const a = atomic(t);
    expect([t.listeningTotal, t.readingTotal, a.length]).toEqual([100, 100, 200]);
    expect(new Set(a.map((q) => q.id)).size).toBe(200);
    const n = (k: string) => [...t.listeningSteps, ...t.readingSteps].filter((s) => s.kind === k).length;
    expect([n("part1"), n("part2"), n("part34"), n("grammar")]).toEqual([MOCK_TEST_COUNTS.part1, MOCK_TEST_COUNTS.part2, 69, MOCK_TEST_COUNTS.grammar]);
  });
});

describe("受験済み問題の回避", () => {
  const history: MockTestResult[] = [];
  const tests: Test[] = [];
  for (let i = 0; i < 8; i++) { const t = buildMockTest(history); tests.push(t); history.push(resultOf(t, i)); }

  it("最初の6回は、過去のどの模試とも1問も重ならない", () => {
    for (let i = 1; i < 6; i++) for (let j = 0; j < i; j++) expect(overlap(tests[j], tests[i])).toBe(0);
  });
  it("収録数の許す回数までは、区分ごとにも重ならない（Part 3は7回・3つの文書は6回）", () => {
    const part3Ids = tests.slice(0, 7).flatMap((t) => shown(t).filter((id) => part3.some((s) => s.id === id)));
    expect(new Set(part3Ids).size).toBe(13 * 7);
    expect(new Set(tests.slice(0, 6).flatMap(tripleIds)).size).toBe(4 * 6);
  });
  it("20回続けて受験しても、毎回200問・設問ID重複なしの構成が保たれる", () => {
    const h: MockTestResult[] = [];
    for (let i = 0; i < 20; i++) {
      const t = buildMockTest(h); const a = atomic(t);
      expect([a.length, new Set(a.map((q) => q.id)).size, t.listeningTotal]).toEqual([200, 200, 100]);
      h.push(resultOf(t, i));
    }
  });
  it("未出題が尽きたら、最後に出題された模試が古いものから補う", () => {
    const A = res(0, qids(triple.slice(0, 20))), B = res(1, qids(triple.slice(20, 27)));
    for (let i = 0; i < 20; i++) expect(tripleIds(buildMockTest([A, B])).every((id) => triple.slice(0, 20).some((p) => p.id === id))).toBe(true);
    const old2 = res(0, qids(triple.slice(0, 2))), new25 = res(1, qids(triple.slice(2, 27)));
    for (let i = 0; i < 20; i++) { const ids = tripleIds(buildMockTest([old2, new25])); expect(ids).toContain(triple[0].id); expect(ids).toContain(triple[1].id); }
  });
  it("最後に出題された模試が同じなら、出題回数の少ないものを先に補う", () => {
    const first = res(0, qids(part3.slice(0, 80))), second = res(1, qids(part3));
    for (let i = 0; i < 20; i++) {
      const ids = shown(buildMockTest([first, second])).filter((id) => part3.some((s) => s.id === id));
      expect(ids.length).toBe(13);
      expect(ids.every((id) => part3.slice(80).some((s) => s.id === id))).toBe(true);
    }
  });
  it("時間切れで未解答の設問は、出題済みとして扱わない", () => {
    const answered = res(0, qids(part3.slice(1))), unanswered = res(1, qids(part3.slice(0, 1)), null);
    for (let i = 0; i < 20; i++) expect(shown(buildMockTest([answered, unanswered]))).toContain(part3[0].id);
  });
  it("セットは1設問でも解答していれば出題済み（最新なので、補充でも最後になる）", () => {
    const old = res(0, qids(part3.slice(1))), partial = res(1, [part3[0].questions[1].id]);
    for (let i = 0; i < 20; i++) expect(shown(buildMockTest([old, partial]))).not.toContain(part3[0].id);
  });
  it("answerRecords を持たない旧い履歴は対象外。履歴の並び順にも依存しない", () => {
    const legacy = { id: day(0), completedAt: day(0), listening: {}, reading: {}, totalScore: 500 } as unknown as MockTestResult;
    expect(buildSeenIndex([legacy, legacy]).size).toBe(0);
    expect(findRepeatShortages([legacy])).toEqual([]);
    const a = buildSeenIndex([res(0, ["a"]), res(1, ["a", "b"]), res(2, ["b"])]);
    const b = buildSeenIndex([res(2, ["b"]), res(0, ["a"]), res(1, ["a", "b"])]);
    expect([...a]).toEqual([...b]);
    expect(a.get("a")).toEqual({ count: 2, lastIndex: 1 });
    expect(a.get("b")).toEqual({ count: 2, lastIndex: 2 });
  });
  it("重複が避けられない区分を、事前に検出できる（0回・5回・6回・7回後）", () => {
    const sh = (n: number) => findRepeatShortages(history.slice(0, n));
    expect(sh(0)).toEqual([]);
    expect(sh(5)).toEqual([]);
    expect(sh(6)).toEqual(["Part 7（3つの文書）"]);
    expect(sh(7)).toEqual(expect.arrayContaining(["Part 3", "Part 4", "Part 7（3つの文書）"]));
  });
  it("乱数と履歴が同じなら、同じ模試になる", () => {
    const ids = (t: Test) => atomic(t).map((q) => q.id).join(",");
    expect(ids(buildMockTest(history.slice(0, 3), seeded(7)))).toBe(ids(buildMockTest(history.slice(0, 3), seeded(7))));
    expect(ids(buildMockTest(history.slice(0, 3), seeded(7)))).not.toBe(ids(buildMockTest(history.slice(0, 3), seeded(8))));
  });
});

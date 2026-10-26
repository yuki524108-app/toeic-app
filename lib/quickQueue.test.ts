// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import words from "../../src/data/words.json";
import grammar from "../../src/data/grammar.json";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";
import {
  QUICK_CATEGORIES, buildQuickQueue, countReviewDue, estimateMinutes, loadQuickPrefs, questionIds,
  quickWeight, saveQuickPrefs, totalQuestions,
} from "../../src/lib/quickQueue";
import type { QuickCategory, QuickItem, QuickPools } from "../../src/lib/quickQueue";
import {
  clearQuickSession, firstUnansweredIndex, loadQuickSession, saveQuickSession,
} from "../../src/lib/quickSession";
import type { QuickResult } from "../../src/lib/quickSession";
import { addDaysLocal, localDateStr, todayStr } from "../../src/lib/date";
import type { AppData, ProgressRecord, ReadingPassage } from "../../src/types";

const POOLS = {
  word: words, grammar, listeningPart1: part1, listeningPart2: part2, listeningPart34: part34, part6,
  reading: (readings as ReadingPassage[]).filter((p) => p.type === undefined || p.type === "single"),
} as unknown as QuickPools;
const ALL = QUICK_CATEGORIES.map((c) => c.id);
const EMPTY = { progress: {} } as AppData;
const day = (n: number) => localDateStr(addDaysLocal(new Date(), n));
const rec = (id: string, next: string, ok: boolean): ProgressRecord => ({
  itemId: id, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1,
  nextReviewDate: next, lastAnsweredAt: "", isCorrect: ok,
});
const ids = (q: QuickItem[]) => q.map((x) => x.item.id);
beforeEach(() => localStorage.clear());

describe("設問ID", () => {
  it("すべての設問IDは重複しない（進捗は設問IDで引くため、衝突すると別の問題の進捗を上書きする）", () => {
    const all = ALL.flatMap((c) => (POOLS[c] as unknown as { id: string }[]).flatMap((it) => questionIds({ kind: c, item: it } as QuickItem)));
    expect(all.length).toBeGreaterThan(5000);
    expect(new Set(all).size).toBe(all.length);
  });
  it("セットの重み（設問数）: Part 3・4は3問（1セットのみ4問）、Part 6は4問、読解（単一文書）は3問", () => {
    const w = (c: QuickCategory) => (POOLS[c] as unknown as { id: string }[]).map((it) => quickWeight({ kind: c, item: it } as QuickItem));
    expect(new Set(w("listeningPart34"))).toEqual(new Set([3, 4]));
    expect(new Set(w("part6"))).toEqual(new Set([4]));
    expect(new Set(w("reading"))).toEqual(new Set([3]));
    expect(new Set(w("word"))).toEqual(new Set([1]));
  });
});

describe("buildQuickQueue（優先順位）", () => {
  it("復習日を迎えた問題（不正解・正解）が、未学習の問題より必ず先に出題される", () => {
    const w = (POOLS.word as { id: string }[]);
    const data = { progress: { [w[0].id]: rec(w[0].id, day(-2), false), [w[1].id]: rec(w[1].id, day(0), true), [w[2].id]: rec(w[2].id, day(5), true) } } as unknown as AppData;
    for (let i = 0; i < 30; i++) {
      const q = buildQuickQueue(data, 2, ["word", "grammar"], POOLS);
      expect(ids(q).sort()).toEqual([w[0].id, w[1].id].sort());   // 復習日前の w[2] は選ばれない
    }
  });
  it("1設問だけ要復習のセットも、そのセットが最優先になる", () => {
    const target = (POOLS.listeningPart34 as unknown as { id: string; questions: { id: string }[] }[])[7];
    const data = { progress: { [target.questions[1].id]: rec(target.questions[1].id, day(-2), false) } } as unknown as AppData;
    for (let i = 0; i < 20; i++) {
      const q = buildQuickQueue(data, 3, ["listeningPart34"], POOLS);
      expect(ids(q)).toEqual([target.id]);
    }
  });
  it("同じ優先度の中では、選んだカテゴリが均等に出題される", () => {
    const q = buildQuickQueue(EMPTY, 9, ["word", "grammar", "listeningPart2"], POOLS);
    const count = (k: string) => q.filter((x) => x.kind === k).length;
    expect([count("word"), count("grammar"), count("listeningPart2")]).toEqual([3, 3, 3]);
  });
});

describe("buildQuickQueue（セットと設問数）", () => {
  const sizes = (cats: QuickCategory[], n: number) => {
    const out = new Set<number>();
    for (let i = 0; i < 80; i++) out.add(totalQuestions(buildQuickQueue(EMPTY, n, cats, POOLS)));
    return [...out].sort((a, b) => a - b);
  };
  it("1問単位のカテゴリは、指定した問題数ちょうどになる", () => {
    expect(sizes(["word"], 5)).toEqual([5]);
    expect(sizes(["word", "grammar"], 10)).toEqual([10]);
  });
  it("セット型は分割せず、設問数が指定に最も近くなるよう調整される（超過は1セットまで）", () => {
    expect(sizes(["part6"], 3)).toEqual([4]);                  // 1セット(4問)
    expect(sizes(["part6"], 10)).toEqual([8]);                 // 2セット(8問)。3セット(12問)より10に近い
    expect(sizes(["reading"], 3)).toEqual([3]);
    expect(sizes(["listeningPart34"], 5).every((n) => n === 6 || n === 7 || n === 4 || n === 5 || n === 3 + 3)).toBe(true);
  });
  it("選んだ出題単位に重複はなく、セットの設問は丸ごと含まれる", () => {
    for (let i = 0; i < 30; i++) {
      const q = buildQuickQueue(EMPTY, 10, ALL, POOLS);
      expect(new Set(ids(q)).size).toBe(q.length);
    }
  });
  it("読解には、複数文書（ダブル・トリプル）が含まれない", () => {
    for (const q of (POOLS.reading as unknown as ReadingPassage[])) expect(q.type === undefined || q.type === "single").toBe(true);
  });
  it("カテゴリが空・問題数0なら空", () => {
    expect(buildQuickQueue(EMPTY, 5, [], POOLS)).toEqual([]);
    expect(buildQuickQueue(EMPTY, 0, ["word"], POOLS)).toEqual([]);
  });
  it("復習が必要な設問数は、設問単位で数える", () => {
    const set = (POOLS.listeningPart34 as unknown as { questions: { id: string }[] }[])[0];
    const data = { progress: { [set.questions[0].id]: rec(set.questions[0].id, day(-1), false), [set.questions[2].id]: rec(set.questions[2].id, day(0), true), [set.questions[1].id]: rec(set.questions[1].id, day(3), true) } } as unknown as AppData;
    expect(countReviewDue(data, ["listeningPart34"], POOLS)).toBe(2);
  });
});

describe("所要時間の目安と設定の記憶", () => {
  it("所要時間は、選択カテゴリの平均秒数×問題数（最低1分）", () => {
    expect(estimateMinutes(10, ["word"])).toBe(3);
    expect(estimateMinutes(10, ["word", "grammar"])).toBe(5);
    expect(estimateMinutes(3, ["word"])).toBe(1);
  });
  it("設定は保存・復元され、壊れた値や旧い値は既定に戻る", () => {
    expect(loadQuickPrefs()).toEqual({ count: 5, categories: ["word", "grammar"] });
    saveQuickPrefs({ count: 10, categories: ["part6", "reading"] });
    expect(loadQuickPrefs()).toEqual({ count: 10, categories: ["part6", "reading"] });
    localStorage.setItem("toeic-app:quick-study-prefs", JSON.stringify({ count: 7, categories: ["zzz"] }));
    expect(loadQuickPrefs()).toEqual({ count: 5, categories: ["word", "grammar"] });
    localStorage.setItem("toeic-app:quick-study-prefs", "{broken");
    expect(loadQuickPrefs().count).toBe(5);
  });
});

describe("中断／再開（quickSession）", () => {
  const KEY = "toeic-app:quick-study-session";
  const ans = (q: QuickItem, id: string, correct = true, selected = 0): QuickResult => ({ id, level: 600, correct, title: `t-${id}`, answer: `a-${id}`, selected, q });
  const makeQueue = () => {
    for (let t = 0; t < 300; t++) {
      const q = buildQuickQueue(EMPTY, 10, ["word", "listeningPart34", "part6", "reading"], POOLS);
      if (q.findIndex((x) => quickWeight(x) > 1) >= 2) return q;   // セット型の手前に、解答済みの問題がある並び
    }
    throw new Error("条件に合う出題リストを作れなかった");
  };

  it("往復: 出題リスト・解答（正誤・選んだ選択肢・表示文）・中断日時が復元される", () => {
    const queue = makeQueue(); const setIdx = queue.findIndex((x) => quickWeight(x) > 1);
    const results: QuickResult[] = [];
    for (let i = 0; i < setIdx; i++) for (const id of questionIds(queue[i])) results.push(ans(queue[i], id));
    results.push(ans(queue[setIdx], questionIds(queue[setIdx])[0], false, 2));
    saveQuickSession(queue, results, new Date("2026-10-02T09:30:00Z"));
    const r = loadQuickSession(POOLS)!;
    expect(r.queue.map((q) => [q.kind, q.item.id])).toEqual(queue.map((q) => [q.kind, q.item.id]));
    expect(r.results.map(({ q: _q, ...x }) => x)).toEqual(results.map(({ q: _q, ...x }) => x));
    expect(r.savedAt).toBe("2026-10-02T09:30:00.000Z");
    expect(firstUnansweredIndex(r.queue, r.results)).toBe(setIdx);   // 途中のセットから再開
  });
  it("再開位置: 先頭は0、セットは1問欠けても未完了、すべて解答済みなら -1", () => {
    const queue = makeQueue(); const setIdx = queue.findIndex((x) => quickWeight(x) > 1);
    const all = queue.flatMap((q) => questionIds(q).map((id) => ans(q, id)));
    expect(firstUnansweredIndex(queue, [])).toBe(0);
    expect(firstUnansweredIndex(queue, all)).toBe(-1);
    const lastOfSet = questionIds(queue[setIdx]).slice(-1)[0];
    expect(firstUnansweredIndex(queue, all.filter((x) => x.id !== lastOfSet))).toBe(setIdx);
  });
  it("解答が1つもない保存、壊れた保存、版違い、問題データの変更は、復元せず破棄する", () => {
    const queue = makeQueue(); const first = questionIds(queue[0])[0];
    saveQuickSession(queue, []); expect(loadQuickSession(POOLS)).toBeNull(); expect(localStorage.getItem(KEY)).toBeNull();
    localStorage.setItem(KEY, "{broken"); expect(loadQuickSession(POOLS)).toBeNull(); expect(localStorage.getItem(KEY)).toBeNull();
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: "x", queue: [], answers: [] })); expect(loadQuickSession(POOLS)).toBeNull();   // 版1は破棄
    saveQuickSession(queue, [ans(queue[0], first)]);
    const gone = queue[queue.length - 1];
    const drifted = { ...POOLS, [gone.kind]: (POOLS[gone.kind] as unknown as { id: string }[]).filter((x) => x.id !== gone.item.id) } as unknown as QuickPools;
    expect(loadQuickSession(drifted)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it("重複・無関係な解答は取り込まない。保存の削除もできる", () => {
    const queue = makeQueue(); const id = questionIds(queue[0])[0];
    saveQuickSession(queue, [ans(queue[0], id)]);
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    raw.answers.push({ ...raw.answers[0] }, { ...raw.answers[0], id: "zzz" }, { ...raw.answers[0], itemId: "no-such", id: "x" });
    localStorage.setItem(KEY, JSON.stringify(raw));
    expect(loadQuickSession(POOLS)!.results.length).toBe(1);
    clearQuickSession(); expect(localStorage.getItem(KEY)).toBeNull();
  });
  it("保存に失敗しても例外にならない", () => {
    const queue = makeQueue();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    try { expect(() => saveQuickSession(queue, [ans(queue[0], questionIds(queue[0])[0])])).not.toThrow(); }
    finally { Storage.prototype.setItem = orig; }
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

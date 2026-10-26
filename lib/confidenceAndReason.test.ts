// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import type { ProgressRecord } from "../../src/types";
import { updateProgress } from "../../src/lib/spacedRepetition";
import { isLeech } from "../../src/lib/history";
import { applyMissReason, reasonTotals } from "../../src/lib/missReason";
import { loadData, recordAnswer, setMissReason, parseImportedJSON, exportDataAsJSON } from "../../src/lib/storage";

const answered = (n: number, correct = true): ProgressRecord | undefined => {
  let r: ProgressRecord | undefined;
  for (let i = 0; i < n; i++) r = updateProgress("w1", "word", 600, correct, r);
  return r;
};

describe("確信のない正解（うろ覚え・あてずっぽう・ヒントを使った）", () => {
  it("正解として数えるが、翌日にもう一度出し、連続正解数と難しさの係数は進めない", () => {
    const base = answered(3)!;                                  // 3回連続正解：間隔は約8日
    expect(base.interval).toBeGreaterThan(3);
    const r = updateProgress("w1", "word", 600, true, base, "unsure");
    expect([r.isCorrect, r.interval, r.repetitions, r.easeFactor]).toEqual([true, 1, base.repetitions, base.easeFactor]);
    expect(r.attempts).toBe((base.attempts ?? 0) + 1);
    expect(r.wrongCount).toBe(base.wrongCount);
  });
  it("初めての解答がうろ覚えでも、翌日に出る（連続正解数は0のまま）", () => {
    const r = updateProgress("w1", "word", 600, true, undefined, "unsure");
    expect([r.isCorrect, r.interval, r.repetitions]).toEqual([true, 1, 0]);
  });
  it("確信ありの正解（既定）は、従来どおり間隔が延びる", () => {
    const a = updateProgress("w1", "word", 600, true, undefined);
    const b = updateProgress("w1", "word", 600, true, a);
    expect([a.interval, b.interval, b.repetitions]).toEqual([1, 3, 2]);
  });
  it("間違いは、確信度に関係なく不正解として扱う", () => {
    const r = updateProgress("w1", "word", 600, false, answered(3), "unsure");
    expect([r.isCorrect, r.repetitions, r.interval]).toEqual([false, 0, 1]);
  });
  it("うろ覚えの正解を重ねても、「何度も間違える問題」からは外れない（定着とみなさない）", () => {
    let r: ProgressRecord | undefined;
    for (let i = 0; i < 3; i++) r = updateProgress("w1", "word", 600, false, r);
    expect(isLeech(r)).toBe(true);
    for (let i = 0; i < 5; i++) r = updateProgress("w1", "word", 600, true, r, "unsure");
    expect(isLeech(r)).toBe(true);
    for (let i = 0; i < 3; i++) r = updateProgress("w1", "word", 600, true, r);   // 確信のある正解が3回連続で外れる
    expect(isLeech(r)).toBe(false);
  });
});

describe("間違えた理由の記録", () => {
  const base = answered(1, false)!;
  it("理由を選ぶと、その理由の件数が1増える。他の理由は変わらない", () => {
    const r = applyMissReason(base, "careless", null);
    expect(r.reasonCounts).toEqual({ careless: 1 });
    expect(applyMissReason(r, "unknown", null).reasonCounts).toEqual({ careless: 1, unknown: 1 });
  });
  it("選び直すと、前の理由の分が減り、新しい理由の分が増える。取り消すと減るだけ", () => {
    const a = applyMissReason(base, "careless", null);
    expect(applyMissReason(a, "unsure", "careless").reasonCounts).toEqual({ careless: 0, unsure: 1 });
    expect(applyMissReason(a, null, "careless").reasonCounts).toEqual({ careless: 0 });
  });
  it("0より小さくならない（記録が無い理由を取り消そうとしても）", () => {
    expect(applyMissReason(base, null, "unknown").reasonCounts?.unknown ?? 0).toBe(0);
  });
  it("元の記録は変更しない", () => {
    applyMissReason(base, "careless", null);
    expect(base.reasonCounts).toBeUndefined();
  });
  it("次に解答しても、それまでの理由の記録は引き継がれる", () => {
    const withReason = applyMissReason(base, "unknown", null);
    const next = updateProgress("w1", "word", 600, true, withReason);
    expect(next.reasonCounts).toEqual({ unknown: 1 });
    expect(next.reasonCounts).not.toBe(withReason.reasonCounts);   // 同じ参照を共有しない
  });
  it("全問題を通した内訳を数える。不正な値は無視する", () => {
    const a = applyMissReason(base, "unknown", null);
    const b = { ...applyMissReason({ ...base, itemId: "w2" }, "unknown", null), reasonCounts: { unknown: 2, careless: -1, unsure: Number.NaN } };
    expect(reasonTotals({ w1: a, w2: b })).toEqual({ unknown: 3, careless: 0, unsure: 0, timeout: 0 });
    expect(reasonTotals({})).toEqual({ unknown: 0, careless: 0, unsure: 0, timeout: 0 });
  });
});

describe("理由の保存（setMissReason）", () => {
  beforeEach(() => localStorage.clear());
  it("解答の記録に理由が反映され、端末に保存され、バックアップにも含まれる", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("g1", "grammar", 700, false, undefined));
    d = setMissReason(d, "g1", "careless", null);
    expect(d.progress.g1.reasonCounts).toEqual({ careless: 1 });
    expect(loadData().progress.g1.reasonCounts).toEqual({ careless: 1 });
    expect(parseImportedJSON(exportDataAsJSON(d))?.progress.g1.reasonCounts).toEqual({ careless: 1 });
  });
  it("理由の記録は、解答の履歴や日別の件数を増やさない", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("g1", "grammar", 700, false, undefined));
    const before = [d.answerHistory.length, JSON.stringify(d.dailyLogs)];
    d = setMissReason(d, "g1", "unknown", null);
    expect([d.answerHistory.length, JSON.stringify(d.dailyLogs)]).toEqual(before);
  });
  it("問題の記録が無いときは、何も変えない", () => {
    const d = loadData();
    expect(setMissReason(d, "nope", "unknown", null)).toBe(d);
  });
});

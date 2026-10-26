import { describe, it, expect } from "vitest";
import type { AppData, DailyLog, ProgressRecord } from "../../src/types";
import {
  ITEM_TYPE_ORDER, MAX_ANSWER_HISTORY, answerSamples, appendAnswerEvent, attemptsOf, isLeech,
  leechRecords, makeAnswerEvent, sanitizeAnswerHistory, weeklyStats, wrongCountOf,
} from "../../src/lib/history";
import { updateProgress } from "../../src/lib/spacedRepetition";

const rec = (o: Partial<ProgressRecord> = {}): ProgressRecord => ({
  itemId: "w1", itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0,
  nextReviewDate: "2026-10-10", lastAnsweredAt: "2026-10-09T01:00:00.000Z", isCorrect: false, ...o,
});

describe("解答の履歴の1件", () => {
  it("設問ID・種別の番号・難易度・解答時刻（秒）・正誤を配列にする", () => {
    const e = makeAnswerEvent(rec({ itemId: "g5", itemType: "grammar", itemLevel: 750, isCorrect: true, lastAnsweredAt: "2026-10-09T00:00:00.000Z" }));
    expect(e).toEqual(["g5", ITEM_TYPE_ORDER.indexOf("grammar"), 750, Date.parse("2026-10-09T00:00:00.000Z") / 1000, 1]);
  });
  it("上限を超えたら古いものから捨てる（元の配列は変えない）", () => {
    const base = Array.from({ length: MAX_ANSWER_HISTORY }, (_, i) => makeAnswerEvent(rec({ itemId: `x${i}` })));
    const next = appendAnswerEvent(base, rec({ itemId: "new" }));
    expect(next.length).toBe(MAX_ANSWER_HISTORY);
    expect(next[0][0]).toBe("x1");
    expect(next[next.length - 1][0]).toBe("new");
    expect(base.length).toBe(MAX_ANSWER_HISTORY);
    expect(base[0][0]).toBe("x0");
  });
  it("読み込み時は、形の崩れた件（型違い・範囲外の種別・正誤が0/1以外）だけを捨てる", () => {
    const ok = ["a", 0, 600, 1000, 1];
    const bad = [["b", 99, 600, 1000, 1], ["c", 0, "600", 1000, 1], ["d", 0, 600, 1000, 2], ["e"], "f", null, ["g", 0.5, 600, 1000, 1]];
    expect(sanitizeAnswerHistory([ok, ...bad, ok])).toEqual([ok, ok]);
    expect(sanitizeAnswerHistory(undefined)).toEqual([]);
    expect(sanitizeAnswerHistory({})).toEqual([]);
  });
});

describe("通算の挑戦回数・間違えた回数", () => {
  it("解答のたびに増える（正解でも挑戦回数は増え、間違えた回数は増えない）", () => {
    const a = updateProgress("w1", "word", 600, false, undefined);
    expect([a.attempts, a.wrongCount]).toEqual([1, 1]);
    const b = updateProgress("w1", "word", 600, true, a);
    expect([b.attempts, b.wrongCount]).toEqual([2, 1]);
    const c = updateProgress("w1", "word", 600, false, b);
    expect([c.attempts, c.wrongCount]).toEqual([3, 2]);
  });
  it("履歴機能より前の記録は、記録があれば1回挑戦・直近が不正解なら1回間違えた、として数え始める", () => {
    expect([attemptsOf(rec({ isCorrect: false })), wrongCountOf(rec({ isCorrect: false }))]).toEqual([1, 1]);
    expect([attemptsOf(rec({ isCorrect: true })), wrongCountOf(rec({ isCorrect: true }))]).toEqual([1, 0]);
    const next = updateProgress("w1", "word", 600, false, rec({ isCorrect: false }));
    expect([next.attempts, next.wrongCount]).toEqual([2, 2]);
  });
});

describe("何度も間違える問題", () => {
  it("通算3回以上間違えていて、連続正解が3回に届いていなければ該当する", () => {
    expect(isLeech(rec({ wrongCount: 3, repetitions: 0 }))).toBe(true);
    expect(isLeech(rec({ wrongCount: 3, repetitions: 2, isCorrect: true }))).toBe(true);
    expect(isLeech(rec({ wrongCount: 2, repetitions: 0 }))).toBe(false);          // まだ2回
    expect(isLeech(rec({ wrongCount: 5, repetitions: 3, isCorrect: true }))).toBe(false);  // 連続3回正解で外れる
    expect(isLeech(undefined)).toBe(false);
  });
  it("履歴機能より前の記録（直近が不正解で1回扱い）は、すぐには該当しない", () => {
    expect(isLeech(rec({ isCorrect: false }))).toBe(false);
  });
  it("実際に3回間違え、その後3回連続で正解すると外れる", () => {
    let r: ProgressRecord | undefined;
    for (let i = 0; i < 3; i++) r = updateProgress("w1", "word", 600, false, r);
    expect(isLeech(r)).toBe(true);
    for (let i = 0; i < 2; i++) r = updateProgress("w1", "word", 600, true, r);
    expect(isLeech(r)).toBe(true);
    r = updateProgress("w1", "word", 600, true, r);
    expect(isLeech(r)).toBe(false);
  });
  it("一覧は、間違えた回数の多い順", () => {
    const list = leechRecords({ a: rec({ itemId: "a", wrongCount: 3 }), b: rec({ itemId: "b", wrongCount: 7 }), c: rec({ itemId: "c", wrongCount: 1 }) });
    expect(list.map((r) => r.itemId)).toEqual(["b", "a"]);
  });
});

const log = (date: string, n: number, graded?: number, correct?: number): DailyLog => ({
  date, wordsStudied: n, grammarStudied: 0, readingsStudied: 0, part6Studied: 0, listeningPart1Studied: 0,
  listeningPart2Studied: 0, listeningPart34Studied: 0, gradedCount: graded, correctCount: correct,
});

describe("週ごとの正答率の推移", () => {
  // 2026-10-09 は金曜。この週の月曜は 10-05
  const logs = {
    "2026-10-05": log("2026-10-05", 10, 10, 7),
    "2026-10-09": log("2026-10-09", 10, 10, 9),       // 同じ週：合計20問中16問 = 80%
    "2026-09-30": log("2026-09-30", 5, 5, 1),         // 前の週（9/28〜）：20%
    "2026-09-22": log("2026-09-22", 8),               // 履歴機能より前：解答数のみで、正答率は出さない
  };
  it("週は月曜始まりで、古い週から新しい週の順に、今週を含めて返す", () => {
    const w = weeklyStats(logs, 4, "2026-10-09");
    expect(w.map((x) => x.weekStart)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
  });
  it("正答率は、正誤を記録した解答だけで計算する", () => {
    const w = weeklyStats(logs, 4, "2026-10-09");
    expect([w[3].answered, w[3].graded, w[3].correct, w[3].accuracy]).toEqual([20, 20, 16, 0.8]);
    expect(w[2].accuracy).toBeCloseTo(0.2);
    expect([w[1].weekStart, w[1].answered, w[1].accuracy]).toEqual(["2026-09-21", 8, null]);  // 解答はあるが正答率は出せない
    expect(w[0].answered).toBe(0);
  });
  it("月曜日当日・日曜日でも、その週に入る", () => {
    const l = { "2026-10-04": log("2026-10-04", 3, 3, 3), "2026-10-05": log("2026-10-05", 2, 2, 0) };
    const w = weeklyStats(l, 2, "2026-10-05");
    expect([w[0].weekStart, w[0].accuracy, w[1].weekStart, w[1].accuracy]).toEqual(["2026-09-28", 1, "2026-10-05", 0]);
  });
});

describe("弱点の判定に使う解答のサンプル", () => {
  const base: AppData = { progress: { w1: rec({ itemId: "w1", isCorrect: true }) }, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
  it("履歴が少ないうちは、進捗（問題ごとの最新の正誤）を使う", () => {
    expect(answerSamples(base)).toEqual([{ id: "w1", type: "word", correct: true }]);
  });
  it("履歴が30件以上あれば、直近400件の履歴を使う", () => {
    const history = Array.from({ length: 450 }, (_, i) => makeAnswerEvent(rec({ itemId: `x${i}`, isCorrect: i % 2 === 0 })));
    const s = answerSamples({ ...base, answerHistory: history });
    expect(s.length).toBe(400);
    expect(s[0].id).toBe("x50");
    expect(s[399]).toEqual({ id: "x449", type: "word", correct: false });
  });
});

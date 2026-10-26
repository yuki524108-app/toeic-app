// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { exportDataAsJSON, loadData, parseImportedJSON, recordAnswer } from "../../src/lib/storage";
import { MAX_ANSWER_HISTORY, ITEM_TYPE_ORDER } from "../../src/lib/history";
import { updateProgress } from "../../src/lib/spacedRepetition";
import { todayStr } from "../../src/lib/date";

const KEY = "toeic-drill-data-v1";
beforeEach(() => localStorage.clear());

describe("解答の記録（recordAnswer）と履歴", () => {
  it("解答するたびに、履歴に1件追加され、その日の解答数・正解数が増える", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("w1", "word", 600, true, d.progress.w1));
    d = recordAnswer(d, updateProgress("g1", "grammar", 700, false, d.progress.g1));
    d = recordAnswer(d, updateProgress("w2", "word", 600, true, d.progress.w2));
    expect(d.answerHistory.length).toBe(3);
    expect(d.answerHistory.map((e) => [e[0], ITEM_TYPE_ORDER[e[1]], e[2], e[4]])).toEqual([
      ["w1", "word", 600, 1], ["g1", "grammar", 700, 0], ["w2", "word", 600, 1],
    ]);
    const log = d.dailyLogs[todayStr()];
    expect([log.gradedCount, log.correctCount, log.wordsStudied, log.grammarStudied]).toEqual([3, 2, 2, 1]);
  });
  it("同じ問題を2回解いても、履歴には2件残り、問題ごとの通算が増える", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("w1", "word", 600, false, d.progress.w1));
    d = recordAnswer(d, updateProgress("w1", "word", 600, false, d.progress.w1));
    expect(d.answerHistory.length).toBe(2);
    expect([d.progress.w1.attempts, d.progress.w1.wrongCount]).toEqual([2, 2]);
  });
  it("端末に保存され、読み込み直しても残る", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("w1", "word", 600, true, undefined));
    const reloaded = loadData();
    expect(reloaded.answerHistory).toEqual(d.answerHistory);
    expect(reloaded.dailyLogs[todayStr()].correctCount).toBe(1);
  });
  it("履歴は上限（6000件）を超えず、古いものから捨てられる。問題ごとの通算は上限なしで残る", () => {
    let d = loadData();
    const first = updateProgress("w0", "word", 600, false, undefined);
    d = recordAnswer(d, first);
    for (let i = 0; i < MAX_ANSWER_HISTORY + 5; i++) d = recordAnswer(d, updateProgress("w1", "word", 600, true, d.progress.w1));
    expect(d.answerHistory.length).toBe(MAX_ANSWER_HISTORY);
    expect(d.answerHistory.some((e) => e[0] === "w0")).toBe(false);   // 最初の1件は押し出された
    expect(d.progress.w0.wrongCount).toBe(1);                         // 問題ごとの通算は残る
    expect(d.progress.w1.attempts).toBe(MAX_ANSWER_HISTORY + 5);
  }, 60000);
});

describe("旧いデータ・バックアップとの互換", () => {
  const oldData = { progress: { a: { itemId: "a", itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: "2026-10-10", lastAnsweredAt: "2026-10-09T01:00:00.000Z", isCorrect: false } }, dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
  it("履歴の無い保存データを読み込むと、履歴は空になり、記録済みの問題はそのまま使える", () => {
    localStorage.setItem(KEY, JSON.stringify(oldData));
    const d = loadData();
    expect(d.answerHistory).toEqual([]);
    expect(d.progress.a.isCorrect).toBe(false);
    expect(d.progress.a.attempts).toBeUndefined();
  });
  it("旧い問題に続けて解答すると、通算は「1回挑戦」から数え始める", () => {
    localStorage.setItem(KEY, JSON.stringify(oldData));
    let d = loadData();
    d = recordAnswer(d, updateProgress("a", "word", 600, false, d.progress.a));
    expect([d.progress.a.attempts, d.progress.a.wrongCount]).toEqual([2, 2]);
  });
  it("旧い形式のバックアップを読み込んでも、履歴は空で補完される", () => {
    const parsed = parseImportedJSON(JSON.stringify({ format: "toeic-drill-backup", version: 1, data: oldData }));
    expect(parsed?.answerHistory).toEqual([]);
  });
  it("バックアップの書き出し→読み込みで、履歴も復元される", () => {
    let d = loadData();
    d = recordAnswer(d, updateProgress("w1", "word", 600, true, undefined));
    const back = parseImportedJSON(exportDataAsJSON(d));
    expect(back?.answerHistory).toEqual(d.answerHistory);
  });
  it("壊れた履歴の件（形の崩れたもの）は、読み込み時に捨てられ、正しい件は残る", () => {
    const good = ["w1", 0, 600, 1700000000, 1];
    localStorage.setItem(KEY, JSON.stringify({ ...oldData, answerHistory: [good, ["x"], "y", ["z", 99, 1, 1, 1]] }));
    expect(loadData().answerHistory).toEqual([good]);
    expect(parseImportedJSON(JSON.stringify({ ...oldData, answerHistory: "壊れている" }))?.answerHistory).toEqual([]);
  });
});

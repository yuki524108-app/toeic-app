// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadData, parseImportedJSON, recordAnswer, setTargetGoal } from "../../src/lib/storage";
import { localDateStr, addDaysLocal } from "../../src/lib/date";
import type { AppData, ProgressRecord } from "../../src/types";

const KEY = "toeic-drill-data-v1";
const rec = (id: string, interval: number, lastAnsweredAt: string, next: string): ProgressRecord => ({
  itemId: id, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval, repetitions: 2,
  nextReviewDate: next, lastAnsweredAt, isCorrect: true,
});
// 日付キーがUTC基準だった旧データ（dataVersion なし）
const legacy = () => ({
  progress: {
    a: rec("a", 3, "2026-10-01T23:00:00.000Z", "2026-10-04"), // JST 10/2 08:00 に解答 → 3日後 10/5
    b: rec("b", 1, "2026-10-01T05:00:00.000Z", "2026-10-02"), // JST 10/1 14:00 に解答 → 翌日 10/2
  },
  dailyLogs: {}, streak: 4, lastStudyDate: "2026-10-01", bookmarks: [], placementTestCompletedAt: null,
  mockTestHistory: [], targetScore: null,
});
beforeEach(() => localStorage.clear());

describe("旧データ（UTC基準の日付）の移行", () => {
  it("復習日は、最終解答日時（ローカル）と間隔から再計算される", () => {
    localStorage.setItem(KEY, JSON.stringify(legacy()));
    const d = loadData();
    expect(d.progress.a.nextReviewDate).toBe("2026-10-05");
    expect(d.progress.b.nextReviewDate).toBe("2026-10-02");
  });
  it("最終学習日は最新の解答日時から再計算し、連続日数の値は変えない", () => {
    localStorage.setItem(KEY, JSON.stringify(legacy()));
    const d = loadData();
    expect(d.lastStudyDate).toBe("2026-10-02");
    expect(d.streak).toBe(4);
    expect(d.dataVersion).toBe(2);
  });
  it("移行結果は保存され、再読み込みしても二重に移行されない", () => {
    localStorage.setItem(KEY, JSON.stringify(legacy()));
    const first = loadData();
    expect(JSON.parse(localStorage.getItem(KEY)!).dataVersion).toBe(2);
    expect(loadData().progress).toEqual(first.progress);
  });
  it("旧形式のバックアップをインポートしても移行される。新形式はそのまま", () => {
    const imported = parseImportedJSON(JSON.stringify({ data: legacy() }))!;
    expect(imported.progress.a.nextReviewDate).toBe("2026-10-05");
    const modern = { ...(imported as AppData), progress: { a: { ...imported.progress.a, nextReviewDate: "2099-01-01" } } };
    expect(parseImportedJSON(JSON.stringify({ data: modern }))!.progress.a.nextReviewDate).toBe("2099-01-01");
  });
  it("不正な目標（範囲外・5点刻みでない・存在しない日付）はインポート時に未設定へ戻る", () => {
    const base = { ...(parseImportedJSON(JSON.stringify({ data: legacy() })) as AppData) };
    const bad1 = parseImportedJSON(JSON.stringify({ data: { ...base, targetScore: 733, targetDate: "2026-10-10" } }))!;
    expect([bad1.targetScore, bad1.targetDate]).toEqual([null, null]);
    const bad2 = parseImportedJSON(JSON.stringify({ data: { ...base, targetScore: 730, targetDate: "2026-02-30" } }))!;
    expect([bad2.targetScore, bad2.targetDate]).toEqual([730, null]);
  });
});

describe("連続学習日数の更新（recordAnswer）と目標の設定", () => {
  const today = () => localDateStr(new Date());
  const answer: ProgressRecord = { itemId: "w9", itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: "2099-01-01", lastAnsweredAt: new Date().toISOString(), isCorrect: true };
  const base = (streak: number, last: string | null): AppData => ({ progress: {}, answerHistory: [], dailyLogs: {}, streak, lastStudyDate: last, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 });

  it("昨日までの連続は、今日の学習で+1になる", () => {
    expect(recordAnswer(base(4, localDateStr(addDaysLocal(new Date(), -1))), answer).streak).toBe(5);
  });
  it("1日以上空いたら、1日目からやり直す", () => {
    expect(recordAnswer(base(12, localDateStr(addDaysLocal(new Date(), -2))), answer).streak).toBe(1);
  });
  it("同じ日の2回目の解答では変わらない", () => {
    expect(recordAnswer(base(3, today()), answer).streak).toBe(3);
  });
  it("目標を解除すると、目標日も一緒に解除される", () => {
    const set = setTargetGoal(base(0, null), 730, "2027-01-10");
    expect([set.targetScore, set.targetDate]).toEqual([730, "2027-01-10"]);
    const cleared = setTargetGoal(set, null, "2027-01-10");
    expect([cleared.targetScore, cleared.targetDate]).toEqual([null, null]);
  });
});

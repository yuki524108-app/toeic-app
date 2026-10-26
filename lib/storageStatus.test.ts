// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveData, recordAnswer } from "../../src/lib/storage";
import {
  STORAGE_LIMIT_CHARS, classifyStorageError, getStorageStatus, resetStorageStatus, subscribeStorageStatus,
} from "../../src/lib/storageStatus";
import type { AppData, ProgressRecord } from "../../src/types";

const EMPTY: AppData = {
  progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null,
  mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2,
};
const flush = () => new Promise<void>((r) => queueMicrotask(r)).then(() => new Promise<void>((r) => setTimeout(r, 0)));
const quotaError = () => new DOMException("full", "QuotaExceededError");

beforeEach(() => { localStorage.clear(); resetStorageStatus(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("saveData と保存状態", () => {
  it("保存に成功したら true を返し、失敗状態にはならない", () => {
    expect(saveData(EMPTY)).toBe(true);
    expect(getStorageStatus()).toMatchObject({ saveFailed: false, reason: null, nearLimit: false });
  });

  it("容量超過で失敗したら false を返し、原因を『容量超過』として記録する", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quotaError(); });
    expect(saveData(EMPTY)).toBe(false);
    expect(getStorageStatus()).toMatchObject({ saveFailed: true, reason: "quota" });
  });

  it("それ以外の失敗（保存が許可されていない等）は、原因を『利用不可』として記録する", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(saveData(EMPTY)).toBe(false);
    expect(getStorageStatus()).toMatchObject({ saveFailed: true, reason: "unavailable" });
  });

  it("失敗したあと、保存に成功すると失敗状態が解除される", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quotaError(); });
    saveData(EMPTY);
    expect(getStorageStatus().saveFailed).toBe(true);
    spy.mockRestore();
    expect(saveData(EMPTY)).toBe(true);
    expect(getStorageStatus()).toMatchObject({ saveFailed: false, reason: null });
  });

  it("保存が失敗しても、解答の記録はメモリ上の新しいデータとして返る（学習は続けられる）", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quotaError(); });
    const rec: ProgressRecord = { itemId: "w1", itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: "2099-01-01", lastAnsweredAt: new Date().toISOString(), isCorrect: true };
    const next = recordAnswer(EMPTY, rec);
    expect(next.progress["w1"]).toBeTruthy();
    expect(getStorageStatus().saveFailed).toBe(true);
  });

  it("使用量が目安の80%を超えると『残り少ない』状態になり、使用量（%）を記録する", () => {
    localStorage.setItem("other", "x".repeat(Math.floor(STORAGE_LIMIT_CHARS * 0.8)));
    saveData(EMPTY);
    const s = getStorageStatus();
    expect(s.nearLimit).toBe(true);
    expect(s.usagePercent).toBeGreaterThanOrEqual(80);
    expect(s.saveFailed).toBe(false);
  });

  it("使用量が80%未満なら『残り少ない』にならない", () => {
    localStorage.setItem("other", "x".repeat(Math.floor(STORAGE_LIMIT_CHARS * 0.5)));
    saveData(EMPTY);
    expect(getStorageStatus().nearLimit).toBe(false);
    expect(getStorageStatus().usagePercent).toBeGreaterThanOrEqual(50);
  });

  it("失敗しても、直前の使用量の情報は保たれる", () => {
    localStorage.setItem("other", "x".repeat(Math.floor(STORAGE_LIMIT_CHARS * 0.85)));
    saveData(EMPTY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quotaError(); });
    saveData(EMPTY);
    expect(getStorageStatus()).toMatchObject({ saveFailed: true, nearLimit: true });
  });
});

describe("保存状態の通知", () => {
  it("状態が変わったときだけ、描画のあと（非同期）に通知される。購読を解除すると通知されない", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStorageStatus(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quotaError(); });
    saveData(EMPTY);
    expect(listener).not.toHaveBeenCalled();          // 保存の呼び出し中（描画中になり得る）には通知しない
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    saveData(EMPTY); saveData(EMPTY);                 // 同じ失敗の繰り返しでは、状態が変わらないので通知しない
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    vi.restoreAllMocks(); saveData(EMPTY);            // 成功に戻る（状態は変わるが、購読解除済み）
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("classifyStorageError", () => {
  it.each([
    [{ name: "QuotaExceededError" }, "quota"],
    [{ name: "NS_ERROR_DOM_QUOTA_REACHED" }, "quota"],
    [{ code: 22 }, "quota"],
    [{ code: 1014 }, "quota"],
    [{ name: "SecurityError" }, "unavailable"],
    [new Error("x"), "unavailable"],
    [null, "unavailable"],
  ])("%j → %s", (err, expected) => {
    expect(classifyStorageError(err)).toBe(expected);
  });
});

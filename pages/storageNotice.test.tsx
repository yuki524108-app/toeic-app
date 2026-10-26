// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StorageNotice from "../../src/components/StorageNotice";
import Home from "../../src/pages/Home";
import App from "../../src/App";
import { reportSaveFailure, reportSaveSuccess, resetStorageStatus, STORAGE_LIMIT_CHARS } from "../../src/lib/storageStatus";
import type { AppData, ProgressRecord } from "../../src/types";

const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const quota = () => new DOMException("full", "QuotaExceededError");
let created = 0;
beforeEach(() => {
  localStorage.clear(); resetStorageStatus(); created = 0;
  // URL 全体は差し替えない（ルーターが new URL を使うため）。ダウンロード用の2つのメソッドだけを用意する
  Object.assign(URL, { createObjectURL: () => { created++; return "blob:x"; }, revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { cleanup(); Reflect.deleteProperty(URL, "createObjectURL"); Reflect.deleteProperty(URL, "revokeObjectURL"); vi.restoreAllMocks(); });

describe("StorageNotice（保存の警告）", () => {
  it("問題がなければ何も表示しない", () => {
    render(<StorageNotice data={EMPTY} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("容量超過で保存に失敗したら、原因と『記録が失われる恐れ』を警告し、その場でバックアップを保存できる", async () => {
    render(<StorageNotice data={EMPTY} />);
    await act(async () => { reportSaveFailure(quota()); await Promise.resolve(); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/保存できませんでした/);
    expect(alert.textContent).toMatch(/保存容量がいっぱい/);
    expect(alert.textContent).toMatch(/失われる恐れ/);
    await userEvent.click(screen.getByRole("button", { name: "バックアップを保存する" }));
    expect(created).toBe(1);   // ダウンロード用のファイルが作られた
  });

  it("保存が許可されていない場合は、そのことを知らせる", async () => {
    render(<StorageNotice data={EMPTY} />);
    await act(async () => { reportSaveFailure(new DOMException("x", "SecurityError")); await Promise.resolve(); });
    expect((await screen.findByRole("alert")).textContent).toMatch(/保存が許可されていません/);
  });

  it("保存の失敗の警告は閉じられない（解消するまで表示し続ける）。保存に成功すると消える", async () => {
    render(<StorageNotice data={EMPTY} />);
    await act(async () => { reportSaveFailure(quota()); await Promise.resolve(); });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "閉じる" })).toBeNull();
    await act(async () => { reportSaveSuccess(1000); await Promise.resolve(); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("保存容量が残り少ないときは、使用量を示してバックアップを促し、閉じられる", async () => {
    render(<StorageNotice data={EMPTY} />);
    await act(async () => { reportSaveSuccess(Math.floor(STORAGE_LIMIT_CHARS * 0.85)); await Promise.resolve(); });
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/残り少なくなっています/);
    expect(status.textContent).toMatch(/85%/);
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("ホーム: バックアップのおすすめ", () => {
  function homeWith(records: number) {
    const progress: Record<string, ProgressRecord> = {};
    for (let i = 0; i < records; i++) progress[`w${i}`] = { itemId: `w${i}`, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: "2099-01-01", lastAnsweredAt: new Date().toISOString(), isCorrect: true };
    render(<MemoryRouter><Home data={{ ...EMPTY, progress, placementTestCompletedAt: "2026-01-01T00:00:00.000Z" }} onSetTargetGoal={() => {}} /></MemoryRouter>);
  }
  it("使い始めは表示しない", () => { homeWith(10); expect(screen.queryByText("バックアップのおすすめ")).toBeNull(); });
  it("解答が多く、まだバックアップがなければ表示する。『今すぐバックアップ』を押すと消える", async () => {
    homeWith(80);
    expect(screen.getByText("バックアップのおすすめ")).toBeTruthy();
    expect(screen.getByText(/まだバックアップがありません/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "今すぐバックアップ" }));
    expect(created).toBe(1);
    expect(screen.queryByText("バックアップのおすすめ")).toBeNull();
  });
  it("『あとで』を押すと消える", async () => {
    homeWith(80);
    await userEvent.click(screen.getByRole("button", { name: "あとで" }));
    expect(screen.queryByText("バックアップのおすすめ")).toBeNull();
  });
});

describe("アプリ全体: 保存に失敗したら警告が出る", () => {
  it("学習記録の保存が失敗すると、画面上部に警告が表示される（通しの確認）", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw quota(); });
    render(<App />);
    expect(screen.queryByRole("alert")).toBeNull();
    // ホームの目標スコア設定は、保存（saveData）を行う操作
    await userEvent.click(screen.getByRole("button", { name: "730" }));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/学習データを端末に保存できませんでした/);
  });
});

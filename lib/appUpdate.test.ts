import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyUpdate, isUpdateAvailable, markUpdateAvailable, resetUpdateState, subscribeUpdate } from "../../src/lib/appUpdate";

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
beforeEach(() => resetUpdateState());

describe("appUpdate（新しい版の通知）", () => {
  it("初めは、更新はない", () => {
    expect(isUpdateAvailable()).toBe(false);
  });

  it("新しい版が用意できると、更新ありになり、購読者へ（描画のあとで）通知される", async () => {
    const listener = vi.fn();
    subscribeUpdate(listener);
    markUpdateAvailable(() => {});
    expect(isUpdateAvailable()).toBe(true);
    expect(listener).not.toHaveBeenCalled();   // 描画中の状態更新にならないよう、通知は非同期
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("購読を解除すると、通知されない", async () => {
    const listener = vi.fn();
    const off = subscribeUpdate(listener);
    off();
    markUpdateAvailable(() => {});
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it("applyUpdate は、登録された更新の処理を呼ぶ。更新がなければ何もしない（例外にならない）", () => {
    expect(() => applyUpdate()).not.toThrow();
    const apply = vi.fn();
    markUpdateAvailable(apply);
    applyUpdate();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("更新の処理が失敗（reject）しても、未処理のエラーにならず、失敗が記録される。案内は残り、もう一度試せる", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("failed");
    markUpdateAvailable(() => Promise.reject(failure));
    applyUpdate();
    await flush();
    expect(error).toHaveBeenCalledWith("アプリの更新に失敗しました", failure);
    expect(isUpdateAvailable()).toBe(true);
    error.mockRestore();
  });

  it("更新の処理が同期的に例外を投げても、同じように受け止める", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    markUpdateAvailable(() => { throw new Error("sync failure"); });
    expect(() => applyUpdate()).not.toThrow();
    await flush();
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// 復習画面だけが、描画中にエラーを起こす状況にする
vi.mock("../../src/pages/Review", () => ({
  default: () => { throw new Error("review crashed"); },
}));
import App from "../../src/App";

beforeEach(() => { localStorage.clear(); window.location.hash = "#/review"; vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.location.hash = ""; });

describe("アプリ全体: ある画面が壊れても、ほかの画面へ移動できる", () => {
  it("壊れた画面はエラー画面になり、下のナビゲーションは生きている。別の画面へ移動すると復帰する", async () => {
    render(<App />);
    // 復習画面は遅延読み込みなので、読み込みが終わって、描画でエラーになるまで待つ
    expect((await screen.findByRole("alert")).textContent).toMatch(/review crashed/);
    // ナビゲーション（ホーム）が表示されたまま
    const nav = screen.getByRole("navigation");
    expect(nav).toBeTruthy();
    await userEvent.click(screen.getByRole("link", { name: /ホーム/ }));
    expect(screen.queryByRole("alert")).toBeNull();              // エラー画面は解除された
    expect(screen.getAllByText(/初回模試を受ける/).length).toBeGreaterThan(0);   // ホームが表示されている
  });

  it("『ホームへ戻る』でも復帰できる", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));
    expect((await screen.findAllByText(/初回模試を受ける/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

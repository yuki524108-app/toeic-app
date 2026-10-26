// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";

beforeEach(() => { localStorage.clear(); window.location.hash = "#/"; });
afterEach(() => { cleanup(); window.location.hash = ""; });

describe("アプリ全体: 遅延読み込みの画面へ移動できる", () => {
  it("ホームから、ナビゲーションで進捗画面（遅延読み込み）へ移動して表示できる", async () => {
    render(<App />);
    expect(screen.getAllByText(/初回模試を受ける/).length).toBeGreaterThan(0);   // 最初はホーム（遅延読み込みなし）
    await userEvent.click(screen.getByRole("link", { name: /進捗/ }));
    expect(await screen.findByRole("heading", { name: /進捗/ })).toBeTruthy();   // 画面の読み込み後に表示される
  });

  it("URLで直接、遅延読み込みの学習画面を開いても表示できる", async () => {
    window.location.hash = "#/words";
    render(<App />);
    expect(screen.getAllByRole("status").some((el) => /読み込み中/.test(el.textContent ?? ""))).toBe(true); // 読み込み中の表示が出る（常設の読み上げ領域もstatusなので、文言で特定する）
    expect(await screen.findByRole("link", { name: /← ホーム/ })).toBeTruthy();   // 単語学習画面（遅延読み込み）が表示される
    expect(screen.queryByText(/読み込み中/)).toBeNull();                          // 読み込み中の表示は消える
    expect(screen.queryByRole("alert")).toBeNull();                                // エラー画面にはならない
  });
});

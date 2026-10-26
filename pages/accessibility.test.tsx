// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";

const liveText = () =>
  Array.from(document.querySelectorAll('[aria-live="polite"]'))
    .map((el) => el.textContent ?? "")
    .join("");

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "#/";
});
afterEach(() => cleanup());

describe("画面遷移", () => {
  it("初回表示ではフォーカスを動かさず、画面を移動するとメイン領域へフォーカスし題名を更新する", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.activeElement).toBe(document.body);
    expect(document.title).toBe("TOEIC Drill");

    await user.click(screen.getByRole("link", { name: "文法" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("main"));
    expect(document.title).toBe("文法問題 | TOEIC Drill");
  });
});

describe("文法の解答", () => {
  it("解答すると、解説の領域が現れ、正誤が読み上げ領域に通知される", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/grammar";
    render(<App />);
    await screen.findByRole("link", { name: /← ホーム/ }, { timeout: 8000 });
    expect(screen.queryByRole("region", { name: "解説" })).toBeNull();

    const choices = screen
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("aria-label") && !/次の問題|ホーム/.test(b.textContent ?? ""));
    await user.click(choices[0]);

    expect(screen.getByRole("region", { name: "解説" })).toBeTruthy();
    await waitFor(() => expect(liveText()).toMatch(/^(正解です。|不正解です。正解は [A-D]\. )/));
    expect(liveText()).toMatch(/解説。/);
  });

  it("次の問題へ進むと、フォーカスが進捗ラベルへ戻る（ボタンが消えても失われない）", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/grammar";
    render(<App />);
    await screen.findByRole("link", { name: /← ホーム/ }, { timeout: 8000 });
    const label = () => screen.getByText(/Q\d+ \/ \d+/);
    const first = label().textContent;

    const choices = screen
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("aria-label") && !/次の問題|ホーム/.test(b.textContent ?? ""));
    await user.click(choices[0]);
    await user.click(screen.getByRole("button", { name: "次の問題へ" }));

    await waitFor(() => expect(label().textContent).not.toBe(first));
    expect(document.activeElement).toBe(label());
  });
});

describe("単語カード", () => {
  it("カードをめくると、意味が読み上げ領域に通知される", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/words";
    render(<App />);
    await screen.findByRole("link", { name: /← ホーム/ }, { timeout: 8000 });
    expect(liveText()).toBe("");
    await user.click(screen.getByText("タップして意味を表示"));
    await waitFor(() => expect(liveText().length).toBeGreaterThan(0));
  });
});

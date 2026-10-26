// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdateNotice from "../../src/components/UpdateNotice";
import { markUpdateAvailable, resetUpdateState } from "../../src/lib/appUpdate";

beforeEach(() => resetUpdateState());
afterEach(() => cleanup());

describe("UpdateNotice（新しい版の案内）", () => {
  it("更新がなければ何も表示しない", () => {
    render(<UpdateNotice />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("新しい版が用意できると案内を表示する。模試の受験中は避けるよう注意し、学習記録は保たれることを伝える", async () => {
    render(<UpdateNotice />);
    await act(async () => { markUpdateAvailable(() => {}); await Promise.resolve(); });
    const notice = await screen.findByRole("status");
    expect(notice.textContent).toMatch(/新しい版のアプリがあります/);
    expect(notice.textContent).toMatch(/模試の受験中は、終わってから更新/);
    expect(notice.textContent).toMatch(/学習記録は保たれます/);
  });

  it("『更新する』を押すと、更新の処理が呼ばれる", async () => {
    const apply = vi.fn();
    render(<UpdateNotice />);
    await act(async () => { markUpdateAvailable(apply); await Promise.resolve(); });
    await userEvent.click(await screen.findByRole("button", { name: "更新する" }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("『あとで』を押すと、案内が閉じる（更新の処理は呼ばれない）", async () => {
    const apply = vi.fn();
    render(<UpdateNotice />);
    await act(async () => { markUpdateAvailable(apply); await Promise.resolve(); });
    await userEvent.click(await screen.findByRole("button", { name: "あとで" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});

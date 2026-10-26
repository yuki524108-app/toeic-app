// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Suspense } from "react";
import { lazyPage } from "../../src/lib/lazyPage";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const Page = () => <p>読み込めました</p>;

describe("lazyPage（画面の遅延読み込み）", () => {
  it("読み込み中は fallback を表示し、読み込めたら画面を表示する", async () => {
    let resolve!: (m: { default: typeof Page }) => void;
    const Lazy = lazyPage(() => new Promise<{ default: typeof Page }>((r) => { resolve = r; }));
    render(<Suspense fallback={<p>読み込み中…</p>}><Lazy /></Suspense>);
    expect(screen.getByText("読み込み中…")).toBeTruthy();
    resolve({ default: Page });
    expect(await screen.findByText("読み込めました")).toBeTruthy();
  });

  it("1回目の読み込みに失敗しても、自動で1度やり直して表示できる", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ default: Page });
    const Lazy = lazyPage(load);
    render(<Suspense fallback={<p>読み込み中…</p>}><Lazy /></Suspense>);
    expect(await screen.findByText("読み込めました")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("2回続けて失敗したら、エラー画面（ErrorBoundary）で受ける。真っ白にならない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn().mockRejectedValue(new Error("offline"));
    const Lazy = lazyPage(load);
    render(<ErrorBoundary><Suspense fallback={<p>読み込み中…</p>}><Lazy /></Suspense></ErrorBoundary>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/offline/);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

let throwing = true;
function Bomb() {
  if (throwing) throw new Error("boom: テスト用のエラー");
  return <p>復帰しました</p>;
}

let created: Blob[] = [];
let fileNames: string[] = [];
beforeEach(() => {
  throwing = true; created = []; fileNames = []; localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});   // React が出すエラーログを抑える
  Object.assign(URL, { createObjectURL: (b: Blob) => { created.push(b); return "blob:x"; }, revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { fileNames.push(this.download); });
});
afterEach(() => { cleanup(); Reflect.deleteProperty(URL, "createObjectURL"); Reflect.deleteProperty(URL, "revokeObjectURL"); vi.restoreAllMocks(); });

describe("ErrorBoundary", () => {
  it("正常なら子をそのまま表示する", () => {
    throwing = false;
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("復帰しました")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("描画中にエラーが起きても、真っ白にならず、案内とエラーの内容を表示する", () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/問題が発生しました/);
    expect(alert.textContent).toMatch(/学習記録は.*失われていません/);
    expect(alert.textContent).toMatch(/boom: テスト用のエラー/);
  });

  it("『もう一度試す』で、原因が解消していれば元の画面に戻る", async () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    throwing = false;
    await userEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(screen.getByText("復帰しました")).toBeTruthy();
  });

  it("原因が解消していなければ、『もう一度試す』を押しても、またエラー画面になる（無限ループしない）", async () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    await userEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("resetKey が変わると（画面を移動すると）、エラー状態が自動的に解除される", () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
    throwing = false;
    rerender(<ErrorBoundary resetKey="/a"><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();             // 同じ画面のままなら、エラーを保つ
    rerender(<ErrorBoundary resetKey="/b"><Bomb /></ErrorBoundary>);
    expect(screen.getByText("復帰しました")).toBeTruthy();       // 別の画面へ移動すると解除される
  });

  it("移動先の画面でもエラーなら、移動後もエラー画面になる", () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Bomb /></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="/b"><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("『ホームへ戻る』と『再読み込み』は、指定した動作を呼ぶ", async () => {
    const onGoHome = vi.fn(); const onReload = vi.fn();
    render(<ErrorBoundary onGoHome={onGoHome} onReload={onReload}><Bomb /></ErrorBoundary>);
    await userEvent.click(screen.getByRole("button", { name: "アプリを再読み込みする" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe("エラー画面からのバックアップ（保存されているデータをそのまま書き出す）", () => {
  const stored = { progress: { w1: { itemId: "w1" } }, streak: 3 };
  const backupButton = () => screen.queryByRole("button", { name: "学習データをバックアップする" });

  it("保存されたデータがなければ、バックアップのボタンは表示しない", () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(backupButton()).toBeNull();
  });

  it("正しいデータなら、通常のバックアップと同じ形式（あとでインポートできる）で書き出す", async () => {
    localStorage.setItem("toeic-drill-data-v1", JSON.stringify(stored));
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    await userEvent.click(backupButton()!);
    const parsed = JSON.parse(await created[0].text());
    expect(parsed).toMatchObject({ format: "toeic-drill-backup", version: 1, data: stored });
    expect(fileNames[0]).toMatch(/^toeic-drill-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("データが壊れていても、保存されている文字列をそのままテキストとして書き出す（取り出せる）", async () => {
    localStorage.setItem("toeic-drill-data-v1", '{"progress": {broken');
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    await userEvent.click(backupButton()!);
    expect(await created[0].text()).toBe('{"progress": {broken');
    expect(fileNames[0]).toMatch(/^toeic-drill-damaged-data-.*\.txt$/);
  });

  it("バックアップしたことは記録される（ホームのバックアップのおすすめに反映される）", async () => {
    localStorage.setItem("toeic-drill-data-v1", JSON.stringify(stored));
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    await userEvent.click(backupButton()!);
    expect(localStorage.getItem("toeic-app:last-backup-at")).not.toBeNull();
  });
});

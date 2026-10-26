// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TimedDrill from "../../src/pages/TimedDrill";
import Home from "../../src/pages/Home";
import ProgressPage from "../../src/pages/Progress";
import grammar from "../../src/data/grammar.json";
import type { AppData, GrammarQuestion, ProgressRecord } from "../../src/types";

const Q = grammar as GrammarQuestion[];
// 問題文が同じで選択肢・正解が違う問題が6組あるため、問題文だけでは特定できない（問題文 → 候補の一覧）
const byText = new Map<string, GrammarQuestion[]>();
for (const q of Q) byText.set(q.question.trim(), [...(byText.get(q.question.trim()) ?? []), q]);
const PACE_KEY = "toeic-app:drill-pace";
const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const answers: ProgressRecord[] = [];

function mount(data: AppData = EMPTY, advance?: (ms: number) => void) {
  render(<MemoryRouter><TimedDrill data={data} onAnswer={(r) => answers.push(r)} /></MemoryRouter>);
  return userEvent.setup(advance ? { advanceTimers: advance } : undefined);
}
/** いま表示されている問題（問題文から、データ上の問題を特定する） */
const currentQ = () => {
  const stem = screen.getByText((c, el) => el?.tagName === "P" && byText.has((c ?? "").trim())).textContent!.trim();
  const candidates = byText.get(stem)!;
  // 同じ問題文の候補があるときは、画面に並んでいる選択肢（語と並び順）で見分ける。語が同じで並び順だけが違う問題もある
  const shown = screen.getAllByRole("button").map((b) => (b.textContent ?? "").trim()).join("|");
  return candidates.find((q) => shown.includes(q.choices.join("|"))) ?? candidates[0];
};
const choice = (q: GrammarQuestion, i: number) => screen.getByRole("button", { name: q.choices[i] });
const startBtn = () => screen.getByRole("button", { name: /10問を始める/ });

beforeEach(() => { cleanup(); localStorage.clear(); answers.length = 0; });
afterEach(() => { cleanup(); vi.useRealTimers(); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });

describe("時間感覚トレーニング: 設定", () => {
  it("制限時間は15・20・30秒から選べ、既定は本番のペース（20秒）。選んだ値は記憶される", async () => {
    const user = mount();
    expect(screen.getByRole("button", { name: /^20秒/ }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: /^15秒/ }));
    expect(localStorage.getItem(PACE_KEY)).toBe("15");
    cleanup();
    mount();
    expect(screen.getByRole("button", { name: /^15秒/ }).getAttribute("aria-pressed")).toBe("true");
  });
  it("これまでの解答時間があれば、設定画面に出す", () => {
    mount({ ...EMPTY, answerHistory: Array.from({ length: 6 }, (_, i) => ["g", 1, 600, 1000 + i, 1, 12]) as AppData["answerHistory"] });
    expect(screen.getByText(/直近6問.*中央値 12秒/)).toBeTruthy();
  });
});

describe("時間感覚トレーニング: 出題と解答", () => {
  it("始めると1問目と残り時間が表示され、解答すると正誤・解説・かかった時間が記録される", async () => {
    const user = mount();
    await user.click(startBtn());
    expect(screen.getByText(/時間感覚トレーニング ・ 1 \/ 10/)).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toMatch(/残り \d+秒/);
    const q = currentQ();
    await user.click(choice(q, q.answer));
    expect(answers.length).toBe(1);
    expect([answers[0].itemId, answers[0].isCorrect, typeof answers[0].lastElapsedSec]).toEqual([q.id, true, "number"]);
    expect(answers[0].reasonCounts).toBeUndefined();
    expect(screen.getByRole("region", { name: "解説" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("—");   // 解答後は時間を止める
  });
  it("間違えたときは「なぜ間違えた？」が出て、時間切れの理由は付かない", async () => {
    const user = mount();
    await user.click(startBtn());
    const q = currentQ();
    // 理由の選択は、記録の仕組み（Appが提供）が無い場所では出ないので、ここでは出ないことと、時間切れでないことを確認する
    await user.click(choice(q, (q.answer + 1) % q.choices.length));
    expect(answers[0].isCorrect).toBe(false);
    expect(answers[0].reasonCounts?.timeout).toBeUndefined();
    expect(screen.getByText("不正解です")).toBeTruthy();
  });
  it("10問を解き終えると結果が出て、「もう一度やる」で設定に戻れる", async () => {
    const user = mount();
    await user.click(startBtn());
    for (let n = 0; n < 10; n++) {
      const q = currentQ();
      await user.click(choice(q, n % 2 === 0 ? q.answer : (q.answer + 1) % q.choices.length));   // 偶数番目は正解、奇数番目は不正解
      await user.click(screen.getByRole("button", { name: n === 9 ? "結果を見る" : "次の問題へ" }));
    }
    expect(answers.length).toBe(10);
    expect(screen.getByText("10問中 5問正解")).toBeTruthy();
    expect(screen.getAllByText(/^(正解|不正解)$/).length).toBe(10);   // 色だけでなく文字でも正誤を示す
    await user.click(screen.getByRole("button", { name: "もう一度やる" }));
    expect(startBtn()).toBeTruthy();
  });
});

// 偽の時計を使うテストでは、userEvent の内部の待機が進まなくなる（Testing Library が vitest の偽の時計を検知できない）ため、
// 同期的に動く fireEvent を使う
const mountFake = () => render(<MemoryRouter><TimedDrill data={EMPTY} onAnswer={(r) => answers.push(r)} /></MemoryRouter>);

describe("時間感覚トレーニング: 時間切れ", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  it("制限時間を過ぎると、時間切れ（不正解・理由は「時間切れ」）として記録され、正解と解説が表示される", async () => {
    vi.useFakeTimers();
    mountFake();
    fireEvent.click(startBtn());
    const q = currentQ();
    expect(answers.length).toBe(0);
    act(() => { vi.advanceTimersByTime(19_000); });
    expect(answers.length).toBe(0);                              // まだ時間内
    expect(screen.getByRole("timer").textContent).toMatch(/残り [12]秒/);
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(answers.length).toBe(1);
    expect([answers[0].itemId, answers[0].isCorrect, answers[0].lastElapsedSec, answers[0].reasonCounts]).toEqual([q.id, false, 20, { timeout: 1 }]);
    expect(screen.getByText("時間切れ")).toBeTruthy();
    expect((choice(q, 0) as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(answers.length).toBe(1);                              // 二重に記録されない
  });
  it("解答と時間切れが同じ瞬間に重なっても、記録は1回だけ（二重に記録されない）", () => {
    mountFake();
    fireEvent.click(startBtn());
    const q = currentQ();
    // 1回の処理の中で、解答（クリック）と、時間切れのタイマーを続けて起こす（画面の更新はまだ反映されない）
    act(() => {
      fireEvent.click(choice(q, q.answer));
      vi.advanceTimersByTime(25_000);
    });
    expect(answers.length).toBe(1);
    expect(answers[0].isCorrect).toBe(true);
    expect(answers[0].reasonCounts).toBeUndefined();
  });
  it("制限時間は選んだ値に従う（15秒）", async () => {
    vi.useFakeTimers();
    localStorage.setItem(PACE_KEY, "15");
    mountFake();
    fireEvent.click(startBtn());
    act(() => { vi.advanceTimersByTime(14_000); });
    expect(answers.length).toBe(0);
    act(() => { vi.advanceTimersByTime(1_500); });
    expect([answers.length, answers[0].lastElapsedSec]).toEqual([1, 15]);
  });
  it("画面が隠れている間（別のアプリに切り替えている間）は、時間を数えない", async () => {
    vi.useFakeTimers();
    mountFake();
    fireEvent.click(startBtn());
    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(answers.length).toBe(0);
    act(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { vi.advanceTimersByTime(14_000); });
    expect(answers.length).toBe(0);                              // 合計19秒
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(answers.length).toBe(1);
  });
  it("時間切れが続いた結果には、時間切れの数と助言が出る", async () => {
    vi.useFakeTimers();
    mountFake();
    fireEvent.click(startBtn());
    for (let n = 0; n < 10; n++) {
      act(() => { vi.advanceTimersByTime(21_000); });
      fireEvent.click(screen.getByRole("button", { name: n === 9 ? "結果を見る" : "次の問題へ" }));
    }
    expect(screen.getByText(/時間切れ 10問/)).toBeTruthy();
    expect(screen.getByText(/時間切れが多めです/)).toBeTruthy();
    expect(screen.getAllByText("時間切れ").length).toBe(10);
  });
});

describe("導線と進捗画面", () => {
  it("ホームに時間感覚トレーニングへのリンクがある", () => {
    render(<MemoryRouter><Home data={EMPTY} onSetTargetGoal={() => {}} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /時間感覚トレーニング/ }).getAttribute("href")).toBe("/timed-drill");
  });
  const prog = (d: AppData) => render(<MemoryRouter><ProgressPage data={d} onImportData={() => {}} /></MemoryRouter>);
  const rec = (id: string): ProgressRecord => ({ itemId: id, itemType: "grammar", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0, nextReviewDate: "2999-01-01", lastAnsweredAt: "2026-01-01T00:00:00.000Z", isCorrect: true });
  it("解答時間が5問未満なら、記録の仕方を案内する", () => {
    prog({ ...EMPTY, progress: { g1: rec("g1") } });
    expect(screen.getByText("Part 5（文法）の解答時間")).toBeTruthy();
    expect(screen.getByText(/5問以上たまると、ここに表示されます/)).toBeTruthy();
  });
  it("5問以上あれば、中央値・目安内の割合・「遅いが正解」・練習への導線が出る", () => {
    const history = [10, 12, 14, 30, 40].map((s, i) => [`g${i}`, 1, 600, 1000 + i, 1, s]) as AppData["answerHistory"];
    prog({ ...EMPTY, progress: { g1: rec("g1") }, answerHistory: history });
    expect(screen.getByText("14秒")).toBeTruthy();
    expect(screen.getByText(/20秒以内に解答できた割合：60%/)).toBeTruthy();
    expect(screen.getByText(/正解でも20秒を超えた問題：2問/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "時間感覚トレーニングをする" }).getAttribute("href")).toBe("/timed-drill");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import QuickStudy from "../../src/pages/QuickStudy";
import Home from "../../src/pages/Home";
import ProgressPage from "../../src/pages/Progress";
import words from "../../src/data/words.json";
import { todayStr } from "../../src/lib/date";
import type { AppData, ProgressRecord } from "../../src/types";

const KEY = "toeic-app:quick-study-session";
const wordIds = (words as { id: string }[]).map((w) => w.id);
const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const rec = (id: string, o: Partial<ProgressRecord> = {}): ProgressRecord => ({ itemId: id, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 3, repetitions: 1, nextReviewDate: "2999-01-01", lastAnsweredAt: "2026-01-01T00:00:00.000Z", isCorrect: true, attempts: 1, wrongCount: 0, ...o });
const leechRec = (id: string) => rec(id, { isCorrect: false, repetitions: 0, wrongCount: 4, attempts: 5 });
const withProgress = (list: ProgressRecord[]): AppData => ({ ...EMPTY, progress: Object.fromEntries(list.map((r) => [r.itemId, r])) });

const answers: ProgressRecord[] = [];
function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
function mount(data: AppData, url = "/quick-study") {
  render(<MemoryRouter initialEntries={[url]}><Where /><QuickStudy data={data} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>);
  return userEvent.setup();
}
async function knowWord(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("タップして意味を表示"));
  await user.click(screen.getByRole("button", { name: "わかる" }));
}
beforeEach(() => { cleanup(); localStorage.clear(); answers.length = 0; });
afterEach(() => cleanup());

describe("今日のおすすめセット: すきま時間モードの画面", () => {
  it("設定画面の先頭にカードがあり、押すとそのまま出題が始まり、出題の理由が表示される", async () => {
    const user = mount(EMPTY);
    expect(screen.getByText("今日のおすすめセット")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /何度も間違える問題だけ/ })).toBeNull();   // 苦手が無ければ出さない
    await user.click(screen.getByRole("button", { name: "おすすめセットを始める" }));
    expect(screen.getByText(/今日のおすすめ ・ 0 \/ \d+問 解答済み/)).toBeTruthy();
    expect(screen.getByText(/出題の理由：/).textContent).toMatch(/新しい問題/);
  });
  it("「/quick-study?plan=today」で開くと、設定画面を経ずに始まり、URLからは plan が消える", async () => {
    mount(EMPTY, "/quick-study?plan=today");
    await waitFor(() => expect(screen.getByText(/今日のおすすめ ・ 0 \/ \d+問/)).toBeTruthy());
    expect(screen.getByTestId("where").textContent).toBe("/quick-study");
  });
  it("中断中のセッションがあるときは、黙って破棄せず、設定画面を表示する", async () => {
    const user = mount(EMPTY);
    await user.click(screen.getByRole("button", { name: "文法" }));   // 単語だけにして、出題の種類を固定する
    await user.click(screen.getByRole("button", { name: /3問だけ/ }));
    await knowWord(user);
    cleanup();
    expect(localStorage.getItem(KEY)).not.toBeNull();
    const before = localStorage.getItem(KEY);
    mount(EMPTY, "/quick-study?plan=today");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/quick-study"));
    expect(screen.queryByText(/今日のおすすめ ・/)).toBeNull();
    expect(screen.getByText("おすすめセットを始める")).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe(before);   // 中断中のセッションは残っている
  });
  it("何度も間違える問題があるときは、その問題だけの練習ができ、結果に理由別の正解数が出る", async () => {
    const ids = wordIds.slice(0, 3);
    const user = mount(withProgress(ids.map(leechRec)));
    await user.click(screen.getByRole("button", { name: /何度も間違える問題だけ練習する（3問）/ }));
    expect(screen.getByText(/苦手な問題の練習 ・ 0 \/ 3問/)).toBeTruthy();
    expect(screen.getByText(/出題の理由：/).textContent).toMatch(/苦手/);
    for (let i = 0; i < 3; i++) await knowWord(user);
    expect(answers.map((a) => a.itemId).sort()).toEqual([...ids].sort());
    expect(screen.getByText("3問中 3問正解")).toBeTruthy();
    expect(screen.getByText("苦手 3/3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "苦手な問題をもう一度組む" })).toBeTruthy();
  });
  it("「/quick-study?plan=leech」で開くと、苦手な問題だけで始まる。苦手が無ければ設定画面のまま", async () => {
    mount(withProgress(wordIds.slice(0, 2).map(leechRec)), "/quick-study?plan=leech");
    await waitFor(() => expect(screen.getByText(/苦手な問題の練習 ・ 0 \/ 2問/)).toBeTruthy());
    cleanup();
    mount(EMPTY, "/quick-study?plan=leech");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/quick-study"));
    expect(screen.getByRole("button", { name: "おすすめセットを始める" })).toBeTruthy();
  });
  it("解答は、通常のすきま時間モードと同じく進捗（通算の回数つき）に記録される", async () => {
    const user = mount(withProgress([leechRec(wordIds[0])]));
    await user.click(screen.getByRole("button", { name: /何度も間違える問題だけ練習する（1問）/ }));
    await knowWord(user);
    expect([answers[0].attempts, answers[0].wrongCount, answers[0].isCorrect]).toEqual([6, 4, true]);
  });
});

describe("ホームの導線", () => {
  const home = (d: AppData) => render(<MemoryRouter><Home data={d} onSetTargetGoal={() => {}} /></MemoryRouter>);
  it("おすすめセットへのリンクがあり、復習日を迎えた問題と苦手な問題の件数が案内される", () => {
    home(withProgress([leechRec(wordIds[0]), rec(wordIds[1], { nextReviewDate: "2020-01-01" })]));
    const link = screen.getByRole("link", { name: /今日のおすすめセットを始める/ });
    expect(link.getAttribute("href")).toBe("/quick-study?plan=today");
    expect(link.textContent).toMatch(/復習 1問・苦手 1問/);
  });
  it("何も解いていなければ、件数なしの案内になる", () => {
    home(EMPTY);
    expect(screen.getByRole("link", { name: /今日のおすすめセットを始める/ }).textContent).toMatch(/迷わず始められる10問/);
  });
});

describe("進捗画面: 履歴にもとづく表示", () => {
  const prog = (d: AppData) => render(<MemoryRouter><ProgressPage data={d} onImportData={() => {}} /></MemoryRouter>);
  const log = (graded: number, correct: number) => ({ date: todayStr(), wordsStudied: graded, grammarStudied: 0, readingsStudied: 0, part6Studied: 0, listeningPart1Studied: 0, listeningPart2Studied: 0, listeningPart34Studied: 0, gradedCount: graded, correctCount: correct });
  it("正誤の記録がまだ無いうちは、これから表示される旨を伝える。苦手が無ければその旨を伝える", () => {
    prog(withProgress([rec(wordIds[0])]));
    expect(screen.getByText("正答率の推移（週ごと）")).toBeTruthy();
    expect(screen.getByText(/これからの学習の記録をもとに表示されます/)).toBeTruthy();
    expect(screen.getByText(/今のところ、何度も間違えている問題はありません/)).toBeTruthy();
  });
  it("今週の正答率と、何度も間違える問題の件数・練習へのリンクが出る", () => {
    prog({ ...withProgress([leechRec(wordIds[0]), leechRec(wordIds[1])]), dailyLogs: { [todayStr()]: log(20, 15) } });
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("（20問解答）")).toBeTruthy();
    expect(screen.getByText("2問")).toBeTruthy();
    expect(screen.getByText(/単語 2/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "この問題だけ練習する" }).getAttribute("href")).toBe("/quick-study?plan=leech");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import QuickStudy from "../../src/pages/QuickStudy";
import p34 from "../../src/data/listeningPart34.json";
import p6 from "../../src/data/part6.json";
import type { AppData, ProgressRecord } from "../../src/types";

const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const LABELS = ["単語", "文法", "Part 1 写真描写", "Part 2 応答", "Part 3・4 会話・トーク", "Part 6 長文穴埋め", "Part 7 読解"];
const KEY = "toeic-app:quick-study-session";
const answers: ProgressRecord[] = [];   // onAnswer の呼び出しを、マウントをまたいで通算して記録する

type User = ReturnType<typeof userEvent.setup>;
function mount() {
  const utils = render(<MemoryRouter><QuickStudy data={EMPTY} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>);
  return { ...utils, user: userEvent.setup() };
}
const chip = (l: string) => screen.getByRole("button", { name: l });
async function only(user: User, label: string) {
  if (chip(label).getAttribute("aria-pressed") !== "true") await user.click(chip(label));
  for (const l of LABELS) if (l !== label && chip(l).getAttribute("aria-pressed") === "true") await user.click(chip(l));
}
const start = (user: User, n: number) => user.click(screen.getByRole("button", { name: new RegExp(`${n}問だけ`) }));
const choiceBtn = (i = 0) => screen.getAllByRole("button").filter((b) => /^[A-D]/.test((b.textContent ?? "").trim()))[i];
const blankButtons = (n: number) => within(screen.getByText(`空欄 (${n})`).parentElement!).getAllByRole("button").filter((b) => !b.getAttribute("aria-label"));
/** 画面に出ている出題単位のID（保存された出題リストの先頭）。設問文やタイトルには重複があるため、画面の文字からは特定しない */
const shownItemId = (): string => JSON.parse(localStorage.getItem(KEY)!).queue[0].id;
async function knowWord(user: User, knew = true) {
  await user.click(screen.getByText("タップして意味を表示"));
  await user.click(screen.getByRole("button", { name: knew ? "わかる" : "わからない" }));
}
beforeEach(() => { cleanup(); localStorage.clear(); answers.length = 0; });
afterEach(() => cleanup());

describe("すきま時間モード: 設定画面", () => {
  it("7つのカテゴリが並び、既定は単語＋文法。最後の1つは外せない", async () => {
    const { user } = mount();
    for (const l of LABELS) expect(chip(l)).toBeTruthy();
    expect([chip("単語"), chip("文法"), chip("Part 2 応答")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true", "false"]);
    await user.click(chip("文法"));
    await user.click(chip("単語"));   // 最後の1つ → 無視される
    expect(chip("単語").getAttribute("aria-pressed")).toBe("true");
  });
  it("セット型を選ぶと、まとめて出題する旨の注意書きが出る", async () => {
    const { user } = mount();
    expect(screen.queryByText(/まとめて出題します/)).toBeNull();
    await user.click(chip("Part 6 長文穴埋め"));
    expect(screen.getByText(/まとめて出題します/)).toBeTruthy();
  });
  it("カテゴリと問題数は記憶される", async () => {
    const { user } = mount();
    await only(user, "Part 2 応答");
    await start(user, 3);
    expect(JSON.parse(localStorage.getItem("toeic-app:quick-study-prefs")!)).toEqual({ count: 3, categories: ["listeningPart2"] });
  });
});

describe("すきま時間モード: 出題と結果", () => {
  it("単語3問: 結果→間違えた問題だけ再挑戦→同じ設定で再開", async () => {
    const { user } = mount();
    await only(user, "単語");
    await start(user, 3);
    for (const knew of [true, false, false]) await knowWord(user, knew);
    expect(answers.length).toBe(3);
    expect(screen.getByText("3問中 1問正解")).toBeTruthy();
    expect(screen.getByText("間違えた問題（2問）")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /間違えた問題をもう一度（2問）/ }));
    for (let i = 0; i < 2; i++) await knowWord(user);
    expect(screen.getByText("全問正解です！")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /もう一度やる（3問）/ }));   // 設定画面を経由せず、同じ3問で再開
    expect(screen.getByText(/0 \/ 3問 解答済み/)).toBeTruthy();
  });
  it("セット型は1設問でも間違えると、セット全体を再出題する（再挑戦の問題数はセットの設問数）", async () => {
    const { user } = mount();
    await only(user, "Part 3・4 会話・トーク");
    await start(user, 3);
    await user.click(choiceBtn(0));
    const set = (p34 as { id: string; questions: { answer: number }[] }[]).find((s) => s.id === shownItemId())!;
    await user.click(screen.getByRole("button", { name: "次の設問へ" }));
    for (let i = 1; i < 3; i++) {
      await user.click(choiceBtn(set.questions[i].answer));      // 2問目・3問目は正解する
      await user.click(screen.getByRole("button", { name: i < 2 ? "次の設問へ" : "結果を見る" }));
    }
    // 1問目は A を選んだ。正解が A でなければ間違い（正解が A のセットなら、全問正解になるため判定を分ける）
    if (set.questions[0].answer !== 0) {
      expect(screen.getByText("間違えた問題（1問）")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /間違えた問題をもう一度（3問）/ }));
      expect(screen.getByText(/0 \/ 3問 解答済み/)).toBeTruthy();
    } else {
      expect(screen.getByText("全問正解です！")).toBeTruthy();
    }
  });
  it("複数カテゴリを出題すると、結果にカテゴリ別の正答数が出る", async () => {
    const { user } = mount();
    await start(user, 10);
    for (let i = 0; i < 10; i++) {
      if (screen.queryByText("タップして意味を表示")) await knowWord(user);
      else { await user.click(screen.getAllByRole("button").filter((b) => !/やめる|ブックマーク/.test((b.textContent ?? "") + (b.getAttribute("aria-label") ?? "")))[0]); await user.click(screen.getByRole("button", { name: /次の問題へ|結果を見る/ })); }
    }
    expect(screen.getByText(/10問中/)).toBeTruthy();
    expect(screen.getByText(/単語 \d+\/\d+ ・ 文法 \d+\/\d+|文法 \d+\/\d+ ・ 単語 \d+\/\d+/)).toBeTruthy();
  });
});

describe("すきま時間モード: 中断／再開", () => {
  it("Part 3・4: 1問目だけ解答→やめる→再開で、2問目から続き、1問目は二重に記録されない", async () => {
    const { user } = mount();
    await only(user, "Part 3・4 会話・トーク");
    await start(user, 3);
    await user.click(choiceBtn(0));
    const set = (p34 as { id: string; questions: { id: string; question: string }[] }[]).find((s) => s.id === shownItemId())!;
    await user.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.getByText("中断中のセッションがあります")).toBeTruthy();
    expect(screen.getByText(/1 \/ 3問 解答済み/)).toBeTruthy();
    expect(screen.getByText(/解答済みの設問を飛ばして、続きの設問から再開/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "続きから再開" }));
    expect(screen.getByText(/設問 2 \/ 3/)).toBeTruthy();
    expect(document.body.textContent).toContain(set.questions[1].question);
    await user.click(choiceBtn(0)); await user.click(screen.getByRole("button", { name: "次の設問へ" }));
    await user.click(choiceBtn(0)); await user.click(screen.getByRole("button", { name: "結果を見る" }));
    expect(answers.map((a) => a.itemId)).toEqual(set.questions.map((q) => q.id));   // 3問を1回ずつ
    expect(localStorage.getItem(KEY)).toBeNull();                                    // 終えたので保存は消える
  });
  it("Part 6: 空欄(1)と(3)だけ解答→中断→再開で、解答済みの空欄は解答済みの状態、残り2つだけ解答できる", async () => {
    const { user } = mount();
    await only(user, "Part 6 長文穴埋め");
    await start(user, 3);
    await user.click(blankButtons(1)[0]);
    await user.click(blankButtons(3)[2]);
    const passage = (p6 as { id: string; blanks: { id: string }[] }[]).find((p) => p.id === shownItemId())!;
    await user.click(screen.getByRole("button", { name: "やめる" }));
    await user.click(screen.getByRole("button", { name: "続きから再開" }));
    const disabled = screen.getAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled).length;
    expect(disabled).toBe(8);                                                         // 解答済み2空欄×選択肢4つ
    expect(screen.queryByRole("button", { name: /結果を見る|^次へ$/ })).toBeNull();   // 全部答えるまで次へ進めない
    await user.click(blankButtons(2)[0]); await user.click(blankButtons(4)[1]);
    await user.click(screen.getByRole("button", { name: "結果を見る" }));
    expect(answers.map((a) => a.itemId).sort()).toEqual(passage.blanks.map((b) => b.id).sort());   // 4問を1回ずつ
  });
  it("画面を閉じて開き直しても再開でき、単語は解答済みを飛ばして続きから", async () => {
    const first = mount();
    await only(first.user, "単語");
    await start(first.user, 5);
    for (let i = 0; i < 2; i++) await knowWord(first.user);
    first.unmount();
    const second = mount();
    expect(screen.getByText(/2 \/ 5問 解答済み/)).toBeTruthy();
    await second.user.click(screen.getByRole("button", { name: "続きから再開" }));
    for (let i = 0; i < 3; i++) await knowWord(second.user);
    expect(screen.getByText("5問中 5問正解")).toBeTruthy();
    expect(new Set(answers.map((a) => a.itemId)).size).toBe(5);                       // 5問すべて別の問題を1回ずつ
  });
  it("最後の問題に解答したあとで中断しても、再開すると結果画面に進む", async () => {
    const first = mount();
    await only(first.user, "文法");
    await start(first.user, 3);
    const pick = () => screen.getAllByRole("button").filter((b) => !/やめる|ブックマーク/.test((b.textContent ?? "") + (b.getAttribute("aria-label") ?? "")))[0];
    for (let i = 0; i < 2; i++) { await first.user.click(pick()); await first.user.click(screen.getByRole("button", { name: "次の問題へ" })); }
    await first.user.click(pick());                                                   // 3問目に解答（「結果を見る」は押さない）
    first.unmount();
    const again = mount();
    await again.user.click(screen.getByRole("button", { name: "続きから再開" }));
    expect(screen.getByText(/3問中 \d問正解/)).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it("破棄・解答0件でのやめる・新規開始・完了で、中断中のセッションは消える", async () => {
    let t = mount();
    await only(t.user, "単語"); await start(t.user, 3); await knowWord(t.user);
    await t.user.click(screen.getByRole("button", { name: "やめる" }));
    await t.user.click(screen.getByRole("button", { name: "破棄" }));                 // 破棄
    expect(localStorage.getItem(KEY)).toBeNull();
    await start(t.user, 3); await t.user.click(screen.getByRole("button", { name: "やめる" }));   // 解答0件でやめる
    expect(screen.queryByText("中断中のセッションがあります")).toBeNull();
    await start(t.user, 3); await knowWord(t.user); await t.user.click(screen.getByRole("button", { name: "やめる" }));
    await start(t.user, 5);                                                          // 再開せずに新規開始
    expect(localStorage.getItem(KEY)).toBeNull();
    t.unmount(); t = mount();                                                        // 1問も解答せずに閉じても、前の中断分は復活しない
    expect(screen.queryByText("中断中のセッションがあります")).toBeNull();
    await start(t.user, 3);                                                          // 最後までやり切る
    for (let i = 0; i < 3; i++) await knowWord(t.user);
    t.unmount(); mount();
    expect(screen.queryByText("中断中のセッションがあります")).toBeNull();
  });
  it("問題データが変わって復元できない保存や、旧い保存形式は、再開カードを出さずに破棄する", () => {
    const entry = { itemKind: "word", itemId: "no-such-word", id: "no-such-word", level: 600, correct: true, title: "x", answer: "y", selected: 1 };
    localStorage.setItem(KEY, JSON.stringify({ v: 2, savedAt: new Date().toISOString(), queue: [{ kind: "word", id: "no-such-word" }], answers: [entry] }));
    mount();
    expect(screen.queryByText("中断中のセッションがあります")).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: new Date().toISOString(), queue: [], answers: [] }));
    mount();
    expect(screen.queryByText("中断中のセッションがあります")).toBeNull();
  });
});

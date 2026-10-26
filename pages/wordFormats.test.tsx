// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import WordStudy from "../../src/pages/WordStudy";
import QuickStudy from "../../src/pages/QuickStudy";
import ProgressPage from "../../src/pages/Progress";
import App from "../../src/App";
import words from "../../src/data/words.json";
import grammar from "../../src/data/grammar.json";
import { MissReasonContext } from "../../src/lib/missReasonContext";
import type { MissReasonRecorder } from "../../src/lib/missReasonContext";
import type { AppData, ProgressRecord, Word } from "../../src/types";

const W = words as Word[];
const FIRST = W[0];                          // 「すべて」の出題順の先頭（accommodate）
const FORMAT_KEY = "toeic-app:word-format";
const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };

const answers: ProgressRecord[] = [];
const picks: [string, string | null, string | null][] = [];
const recorder: MissReasonRecorder = (id, next, prev) => picks.push([id, next, prev]);

function mount(withReasons = false) {
  const ui = <MemoryRouter initialEntries={["/words?mode=all"]}><WordStudy data={EMPTY} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>;
  render(withReasons ? <MissReasonContext.Provider value={recorder}>{ui}</MissReasonContext.Provider> : ui);
  return userEvent.setup();
}
type User = ReturnType<typeof userEvent.setup>;
const fmt = (user: User, label: string) => user.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
const optionBtn = (pred: (t: string) => boolean) => screen.getAllByRole("button").find((b) => /^[A-D]\./.test((b.textContent ?? "").trim()) && pred(b.textContent ?? ""))!;
const correctOption = () => optionBtn((t) => t.includes(FIRST.meaning));
const wrongOption = () => optionBtn((t) => !t.includes(FIRST.meaning));

beforeEach(() => { cleanup(); localStorage.clear(); answers.length = 0; picks.length = 0; });
afterEach(() => cleanup());

describe("単語: カード（3段階の自己判定）", () => {
  it("めくると「わからない／うろ覚え／わかる」が出て、うろ覚えは正解だが翌日に再出題される", async () => {
    const user = mount();
    await user.click(screen.getByText("タップして意味を表示"));
    for (const n of ["わからない", "うろ覚え", "わかる"]) expect(screen.getByRole("button", { name: n })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "うろ覚え" }));
    expect([answers[0].itemId, answers[0].isCorrect, answers[0].interval, answers[0].repetitions]).toEqual([FIRST.id, true, 1, 0]);
    expect(screen.getByText(/2 \/ \d+/)).toBeTruthy();   // 次の単語へ進んだ
  });
  it("「わかる」は確信ありの正解（連続正解が進む）、「わからない」は不正解", async () => {
    const user = mount();
    await user.click(screen.getByText("タップして意味を表示"));
    await user.click(screen.getByRole("button", { name: "わかる" }));
    expect([answers[0].isCorrect, answers[0].repetitions]).toEqual([true, 1]);
    await user.click(screen.getByText("タップして意味を表示"));
    await user.click(screen.getByRole("button", { name: "わからない" }));
    expect([answers[1].isCorrect, answers[1].repetitions]).toEqual([false, 0]);
  });
});

describe("単語: 出題形式", () => {
  it("形式は3つから選べ、選んだ形式は記憶される", async () => {
    const user = mount();
    expect(screen.getByRole("button", { name: /^カード/ }).getAttribute("aria-pressed")).toBe("true");
    await fmt(user, "4択");
    expect(screen.getByRole("button", { name: /^4択/ }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(FORMAT_KEY)).toBe("choice");
    cleanup();
    mount();
    expect(screen.getByRole("button", { name: /^4択/ }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("単語: 4択", () => {
  it("英単語に対して4つの意味が並び、どれにも答えるまでは記録されない", async () => {
    const user = mount();
    await fmt(user, "4択");
    expect(screen.getAllByRole("button").filter((b) => /^[A-D]\./.test((b.textContent ?? "").trim())).length).toBe(4);
    expect(screen.getByText(FIRST.word)).toBeTruthy();
    expect(answers.length).toBe(0);
  });
  it("間違えると、選んだ時点で不正解として記録され、解説と「なぜ間違えた？」が出る", async () => {
    const user = mount(true);
    await fmt(user, "4択");
    await user.click(wrongOption());
    expect([answers.length, answers[0].isCorrect, answers[0].itemId]).toEqual([1, false, FIRST.id]);
    expect(screen.getByRole("region", { name: "解説" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "間違えた理由（任意）" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /あてずっぽう/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect(answers.length).toBe(1);   // 次へで二重に記録されない
  });
  it("正解したときは、「次へ」を押すまで記録されない。次へなら確信ありの正解", async () => {
    const user = mount(true);
    await fmt(user, "4択");
    await user.click(correctOption());
    expect(answers.length).toBe(0);
    expect(screen.queryByRole("group", { name: "間違えた理由（任意）" })).toBeNull();   // 正解のときは理由を聞かない
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect([answers.length, answers[0].isCorrect, answers[0].repetitions]).toEqual([1, true, 1]);
  });
  it("「あてずっぽうだった」を押すと、正解でも翌日に再出題される形で記録される", async () => {
    const user = mount();
    await fmt(user, "4択");
    await user.click(correctOption());
    await user.click(screen.getByRole("button", { name: /あてずっぽうだった/ }));
    expect([answers.length, answers[0].isCorrect, answers[0].interval, answers[0].repetitions]).toEqual([1, true, 1, 0]);
  });
});

describe("単語: スペル入力", () => {
  const input = () => screen.getByLabelText("英単語を入力") as HTMLInputElement;
  async function setup(user: User) { await fmt(user, "スペル"); }
  it("意味と文字数の手がかりが出る。最初の文字は、ヒントを押すまで出ない", async () => {
    const user = mount();
    await setup(user);
    expect(screen.getByText(FIRST.meaning)).toBeTruthy();
    expect(screen.queryByText(/最初の文字/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "ヒントを見る" }));
    expect(screen.getByText(/最初の文字/).textContent).toContain(FIRST.word[0]);
  });
  it("大文字で打っても正解。ヒントなしなら確信ありの正解", async () => {
    const user = mount();
    await setup(user);
    await user.type(input(), FIRST.word.toUpperCase());
    await user.click(screen.getByRole("button", { name: "確認する" }));
    expect([answers[0].isCorrect, answers[0].repetitions, answers[0].interval]).toEqual([true, 1, 1]);
    expect(screen.getByText("正解です")).toBeTruthy();
  });
  it("Enterキーでも確認できる", async () => {
    const user = mount();
    await setup(user);
    await user.type(input(), `${FIRST.word}{Enter}`);
    expect(answers.length).toBe(1);
  });
  it("ヒントを使った正解は、正解だが翌日に再出題される", async () => {
    const user = mount();
    await setup(user);
    await user.click(screen.getByRole("button", { name: "ヒントを見る" }));
    await user.type(input(), FIRST.word);
    await user.click(screen.getByRole("button", { name: "確認する" }));
    expect([answers[0].isCorrect, answers[0].repetitions, answers[0].interval]).toEqual([true, 0, 1]);
    expect(screen.getByText(/ヒントを使ったので、明日もう一度出します/)).toBeTruthy();
  });
  it("1文字違いは「惜しい」と伝え、不正解として記録する。正しいつづりと理由の選択も出る", async () => {
    const user = mount(true);
    await setup(user);
    await user.type(input(), FIRST.word.slice(1));   // 先頭の1文字が抜けた
    await user.click(screen.getByRole("button", { name: "確認する" }));
    expect(answers[0].isCorrect).toBe(false);
    expect(screen.getByText(/惜しい/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "間違えた理由（任意）" })).toBeTruthy();
    expect(screen.getAllByText(FIRST.word).length).toBeGreaterThan(0);
  });
  it("「わからない」は不正解として記録し、答えを見せる。空の入力では確認できない", async () => {
    const user = mount();
    await setup(user);
    expect((screen.getByRole("button", { name: "確認する" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "わからない" }));
    expect([answers.length, answers[0].isCorrect]).toEqual([1, false]);
    expect(screen.getAllByText(FIRST.word).length).toBeGreaterThan(0);
  });
});

describe("間違えた理由の選択", () => {
  it("1タップで記録され、同じ理由をもう一度押すと取り消し、別の理由を押すと選び直せる", async () => {
    const user = mount(true);
    await fmt(user, "4択");
    await user.click(wrongOption());
    const chip = (n: string) => screen.getByRole("button", { name: n });
    await user.click(chip("うっかり"));
    await user.click(chip("うっかり"));
    await user.click(chip("知らなかった"));
    await user.click(chip("迷って外した"));
    expect(picks).toEqual([
      [FIRST.id, "careless", null],
      [FIRST.id, null, "careless"],
      [FIRST.id, "unknown", null],
      [FIRST.id, "unsure", "unknown"],
    ]);
    expect(chip("迷って外した").getAttribute("aria-pressed")).toBe("true");
  });
  it("記録する仕組みが無い場所では、理由の選択は出ない", async () => {
    const user = mount(false);
    await fmt(user, "4択");
    await user.click(wrongOption());
    expect(screen.queryByRole("group", { name: "間違えた理由（任意）" })).toBeNull();
  });
});

describe("すきま時間モードの単語カード", () => {
  it("「うろ覚え」は正解として記録され、翌日に再出題される", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><QuickStudy data={EMPTY} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "文法" }));   // 単語だけにする
    await user.click(screen.getByRole("button", { name: /3問だけ/ }));
    await user.click(screen.getByText("タップして意味を表示"));
    await user.click(screen.getByRole("button", { name: "うろ覚え" }));
    expect([answers[0].isCorrect, answers[0].interval, answers[0].repetitions]).toEqual([true, 1, 0]);
  });
});

describe("文法の画面と保存（App全体）", () => {
  it("間違えて理由を選ぶと、問題の記録に理由が保存される（Appの提供する記録の仕組みにつながっている）", async () => {
    const user = userEvent.setup();
    const q = (grammar as { id: string; choices: string[]; answer: number }[])[0];
    window.location.hash = "#/grammar?mode=all";
    render(<App />);
    const pick = (i: number) => screen.findByRole("button", { name: new RegExp(q.choices[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }, { timeout: 8000 });
    const wrong = (q.answer + 1) % q.choices.length;
    await user.click(await pick(wrong));
    await user.click(screen.getByRole("button", { name: "うっかり" }));
    const saved = JSON.parse(localStorage.getItem("toeic-drill-data-v1")!);
    expect(saved.progress[q.id].reasonCounts).toEqual({ careless: 1 });
    expect(saved.progress[q.id].isCorrect).toBe(false);
  });
});

describe("進捗画面: 間違えた理由の内訳", () => {
  const rec = (id: string, reasonCounts?: ProgressRecord["reasonCounts"]): ProgressRecord => ({ itemId: id, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0, nextReviewDate: "2999-01-01", lastAnsweredAt: "2026-01-01T00:00:00.000Z", isCorrect: false, reasonCounts });
  const prog = (list: ProgressRecord[]) => render(<MemoryRouter><ProgressPage data={{ ...EMPTY, progress: Object.fromEntries(list.map((r) => [r.itemId, r])) }} onImportData={() => {}} /></MemoryRouter>);
  it("理由の記録が無いうちは、記録の仕方を案内する", () => {
    prog([rec("w1")]);
    expect(screen.getByText("間違えた理由の内訳")).toBeTruthy();
    expect(screen.getByText(/「なぜ間違えた？」を選ぶと/)).toBeTruthy();
  });
  it("件数と割合、最も多い理由とその対策の目安が出る", () => {
    prog([rec("w1", { unknown: 1, careless: 3 }), rec("w2", { careless: 0, unsure: 0 })]);
    expect(screen.getByText("（3件）")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText(/最も多いのは「うっかり」/)).toBeTruthy();
  });
});

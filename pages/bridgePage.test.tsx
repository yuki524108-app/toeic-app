// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BridgePanel } from "../../src/components/BridgePanel";
import GrammarStudy from "../../src/pages/GrammarStudy";
import QuickStudy from "../../src/pages/QuickStudy";
import ProgressPage from "../../src/pages/Progress";
import grammar from "../../src/data/grammar.json";
import questionTypes from "../../src/data/questionTypes.json";
import type { AppData, GrammarQuestion, ProgressRecord } from "../../src/types";

const G = grammar as GrammarQuestion[];
const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const rec = (id: string, o: Partial<ProgressRecord> = {}): ProgressRecord => ({ itemId: id, itemType: "grammar", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0, nextReviewDate: "2999-01-01", lastAnsweredAt: "2026-01-01T00:00:00.000Z", isCorrect: false, attempts: 5, wrongCount: 4, ...o });
const withProgress = (list: ProgressRecord[]): AppData => ({ ...EMPTY, progress: Object.fromEntries(list.map((r) => [r.itemId, r])) });
const answers: ProgressRecord[] = [];

beforeEach(() => { cleanup(); localStorage.clear(); answers.length = 0; });
afterEach(() => cleanup());

describe("基礎固めの案内（BridgePanel）", () => {
  const show = (kind: Parameters<typeof BridgePanel>[0]["kind"], record: ProgressRecord | undefined) => render(<MemoryRouter><BridgePanel kind={kind} itemId="g001" record={record} /></MemoryRouter>);
  it("何度も間違えている問題には、間違えた回数と基礎固めへのリンクを出す", () => {
    show("grammar", rec("g001"));
    expect(screen.getByText("この問題は通算4回間違えています")).toBeTruthy();
    expect(screen.getByRole("link", { name: /基礎固めをする/ }).getAttribute("href")).toBe("/quick-study?plan=bridge&kind=grammar&item=g001");
  });
  it("設問IDは、URLに使えるよう符号化される", () => {
    render(<MemoryRouter><BridgePanel kind="reading" itemId="r 1&x" record={rec("r 1&x", { itemType: "reading" })} /></MemoryRouter>);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/quick-study?plan=bridge&kind=reading&item=r%201%26x");
  });
  it("何度も間違えていない問題・記録のない問題・分野のない種別（単語など）には出さない", () => {
    const cases: [Parameters<typeof BridgePanel>[0]["kind"], ProgressRecord | undefined][] = [
      ["grammar", rec("g001", { wrongCount: 2 })],                      // まだ2回
      ["grammar", rec("g001", { repetitions: 3, isCorrect: true })],    // 連続3回正解で定着
      ["grammar", undefined],
      ["word", rec("g001", { itemType: "word" })],
      ["part6", rec("g001", { itemType: "part6" })],
      ["listeningPart1", rec("g001", { itemType: "listeningPart1" })],
    ];
    for (const [kind, r] of cases) { cleanup(); const { container } = show(kind, r); expect(container.textContent).toBe(""); }
  });
});

describe("文法の学習画面での表示", () => {
  const q = G[0];
  const page = (d: AppData) => render(<MemoryRouter initialEntries={["/grammar?mode=all"]}><GrammarStudy data={d} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>);
  const choice = (i: number) => screen.getByRole("button", { name: new RegExp(q.choices[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  it("何度も間違えている問題をまた間違えると、解説に基礎固めの案内が出る", async () => {
    const user = userEvent.setup();
    page(withProgress([rec(q.id)]));
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(choice((q.answer + 1) % q.choices.length));
    expect(screen.getByRole("link", { name: /基礎固めをする/ }).getAttribute("href")).toBe(`/quick-study?plan=bridge&kind=grammar&item=${q.id}`);
  });
  it("解答すると、問題を表示してからかかった時間（秒）が記録される（時間感覚の分析に使う。2.1.33）", async () => {
    const user = userEvent.setup();
    page(EMPTY);
    await user.click(choice(q.answer));
    expect([answers[0].itemId, answers[0].isCorrect, Number.isInteger(answers[0].lastElapsedSec)]).toEqual([q.id, true, true]);
    expect(answers[0].lastElapsedSec).toBeLessThan(5);
  });
  it("正解したとき、または何度も間違えていない問題を間違えたときは出ない", async () => {
    const user = userEvent.setup();
    page(withProgress([rec(q.id)]));
    await user.click(choice(q.answer));
    expect(screen.queryByRole("link", { name: /基礎固めをする/ })).toBeNull();
    cleanup();
    page(withProgress([rec(q.id, { wrongCount: 1 })]));
    await user.click(choice((q.answer + 1) % q.choices.length));
    expect(screen.queryByRole("link", { name: /基礎固めをする/ })).toBeNull();
  });
});

describe("すきま時間モードでの基礎固め", () => {
  // 文法の中で、同じ項目に「やさしい問題」が3問以上ある、難易度の高い問題を対象にする
  const byCat = new Map<string, GrammarQuestion[]>();
  for (const g of G) byCat.set(g.category, [...(byCat.get(g.category) ?? []), g]);
  const [cat, items] = [...byCat.entries()].find(([, v]) => v.length > 10)!;
  const target = [...items].sort((a, b) => b.level - a.level)[0];
  const stems = new Map<string, GrammarQuestion[]>();
  for (const g of G) stems.set(g.question.trim(), [...(stems.get(g.question.trim()) ?? []), g]);
  /** 選択肢のボタン（先頭の「A.」などの記号を除いた文字が、選択肢と完全に一致するもの） */
  const choiceButton = (choice: string) => screen.queryAllByRole("button").find((b) => (b.textContent ?? "").replace(/^[A-D][.\s]*/, "").trim() === choice);
  /** いま出ている問題を、問題文と選択肢から特定する */
  const currentQ = () => {
    const stem = screen.getByText((c, el) => el?.tagName === "P" && stems.has((c ?? "").trim())).textContent!.trim();
    // 問題文が同じで、選択肢の語が同じ（並び順だけが違う）問題があるため、画面の選択肢の並び順まで照合する
    const shown = screen.getAllByRole("button").map((b) => (b.textContent ?? "").replace(/^[A-D][.\s]*/, "").trim()).join("|");
    return stems.get(stem)!.find((g) => shown.includes(g.choices.join("|"))) ?? stems.get(stem)![0];
  };
  const mount = (url: string, d: AppData = EMPTY) => { render(<MemoryRouter initialEntries={[url]}><QuickStudy data={d} onAnswer={(r) => answers.push(r)} onToggleBookmark={() => {}} /></MemoryRouter>); return userEvent.setup(); };

  it(`「基礎固め」のURL（${cat}）で始まり、やさしい問題3問のあとに、元の問題が最後に出る`, async () => {
    const user = mount(`/quick-study?plan=bridge&kind=grammar&item=${target.id}`, withProgress([rec(target.id)]));
    await waitFor(() => expect(screen.getByText(/基礎固め ・ 0 \/ 4問/)).toBeTruthy());
    const seen: string[] = [];
    for (let n = 0; n < 4; n++) {
      expect(screen.getByText(/出題の理由：/).textContent).toMatch(n < 3 ? /基礎固め（やさしい問題）/ : /苦手/);
      const g = currentQ();
      seen.push(g.id);
      await user.click(choiceButton(g.choices[0])!);
      if (n < 3) await user.click(screen.getByRole("button", { name: /次の問題|次へ/ }));
    }
    expect(seen[3]).toBe(target.id);
    expect(seen.slice(0, 3).every((id) => G.find((g) => g.id === id)!.category === cat && G.find((g) => g.id === id)!.level < target.level)).toBe(true);
    expect(answers.map((a) => a.itemId)).toEqual(seen);
  });
  it("基礎固めの問題が見つからないとき（設問がない・分野のない種別）は、始めずに理由を伝える", async () => {
    mount("/quick-study?plan=bridge&kind=grammar&item=nope");
    await waitFor(() => expect(screen.getByText(/先に解けるやさしい問題が見つかりませんでした/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "おすすめセットを始める" })).toBeTruthy();
    cleanup();
    mount("/quick-study?plan=bridge&kind=word&item=w001");
    await waitFor(() => expect(screen.getByText(/見つかりませんでした/)).toBeTruthy());
  });
});

describe("基礎固めの手がかりが無いとき", () => {
  it("同じ分野の問題がすべて定着済みなら、元の問題だけを出題せず、始めずに理由を伝える", async () => {
    const target = G[0];
    const mastered = G.filter((g) => g.category === target.category && g.id !== target.id)
      .map((g) => rec(g.id, { isCorrect: true, repetitions: 3, wrongCount: 0 }));
    render(<MemoryRouter initialEntries={[`/quick-study?plan=bridge&kind=grammar&item=${target.id}`]}><QuickStudy data={withProgress([rec(target.id), ...mastered])} onAnswer={() => {}} onToggleBookmark={() => {}} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/先に解けるやさしい問題が見つかりませんでした/)).toBeTruthy());
    expect(screen.queryByText(/基礎固め ・/)).toBeNull();
  });
});

describe("進捗画面: 問題タイプ別の正答率", () => {
  const inference = Object.entries(questionTypes).filter(([, v]) => v === "r:inference").map(([k]) => k);
  const prog = (d: AppData) => render(<MemoryRouter><ProgressPage data={d} onImportData={() => {}} /></MemoryRouter>);
  const readingRec = (id: string, ok: boolean): ProgressRecord => rec(id, { itemType: "reading", isCorrect: ok, wrongCount: ok ? 0 : 1 });
  it("読解の「推測」を5問以上、正答率60%未満で解いていると、弱点として表示される", () => {
    expect(inference.length).toBeGreaterThanOrEqual(6);
    prog(withProgress(inference.slice(0, 6).map((id, i) => readingRec(id, i < 2))));
    expect(screen.getByText("問題タイプ別の正答率（弱点分析）")).toBeTruthy();
    expect(screen.getByText("読解（Part 7）")).toBeTruthy();
    expect(screen.getByText("推測")).toBeTruthy();
    expect(screen.getByText("弱点")).toBeTruthy();
    expect(screen.getAllByText("33%").length).toBeGreaterThan(0);
  });
  it("解答が3問に満たないタイプしかなければ、この項目自体を出さない", () => {
    prog(withProgress(inference.slice(0, 2).map((id) => readingRec(id, false))));
    expect(screen.queryByText("問題タイプ別の正答率（弱点分析）")).toBeNull();
  });
});

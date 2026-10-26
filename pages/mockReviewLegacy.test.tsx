// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MockTestReview from "../../src/pages/MockTestReview";
import grammar from "../../src/data/grammar.json";
import { CHOICE_ORDER_VERSION } from "../../src/lib/choiceOrder";
import type { AppData, MockTestResult } from "../../src/types";

afterEach(() => cleanup());

const EMPTY: AppData = {
  progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [],
  placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2,
};

// 現在のデータの文法問題を使い、「並べ替え前の並び」を規則どおりに作って、旧い記録を組み立てる
const q = (grammar as { id: string; choices: string[]; answer: number }[]).find((g) => g.answer === 3)!;
const correctText = q.choices[q.answer];
const distractors = q.choices.filter((_, i) => i !== q.answer);
const OLD_CORRECT = 0; // 旧データでは正解がAだった
const oldChoices = [correctText, ...distractors]; // 正解を A に置き、ほかの相対順は保つ
const pickedText = distractors[1]; // ユーザーが選んだ誤答（旧データでは C）
const OLD_SELECTED = oldChoices.indexOf(pickedText);

function result(partial: Partial<MockTestResult>): MockTestResult {
  return {
    id: "r1", completedAt: "2026-01-01T00:00:00.000Z",
    listening: { correct: 0, total: 100, score: 5 }, reading: { correct: 0, total: 100, score: 5 }, totalScore: 10,
    ...partial,
  } as MockTestResult;
}

function renderReview(r: MockTestResult) {
  render(
    <MemoryRouter initialEntries={["/review/r1"]}>
      <Routes>
        <Route path="/review/:id" element={<MockTestReview data={{ ...EMPTY, mockTestHistory: [r] }} />} />
      </Routes>
    </MemoryRouter>
  );
}

/** 選択肢の行（文言のテキストを含む行）から、付いているラベルを取り出す */
function rowFor(text: string): HTMLElement {
  return screen.getByText(text).closest("div")!;
}

describe("模試の振り返り: 選択肢の並べ替え前に受験した履歴", () => {
  const record = (selectedAnswer: number, correctAnswer: number) => ({
    id: q.id, itemType: "grammar" as const, level: 600, correctAnswer, selectedAnswer, qNumber: 105, partLabel: "Part 5",
  });

  it("旧い並び順の番号で保存された履歴は、現在の並びに直して、選んだ選択肢に『あなたの解答』が付く", () => {
    expect(OLD_SELECTED).not.toBe(q.choices.indexOf(pickedText)); // 旧い番号と現在の番号は違う（変換が必要な状況）
    renderReview(result({ answerRecords: [record(OLD_SELECTED, OLD_CORRECT)] })); // choiceOrder なし＝旧い履歴
    expect(within(rowFor(pickedText)).getByText("あなたの解答")).toBeTruthy();
    expect(within(rowFor(correctText)).getByText("正解")).toBeTruthy();
    expect(screen.getAllByText("あなたの解答").length).toBe(1);   // 別の選択肢に誤って付かない
  });

  it("並べ替え後に受験した履歴（印あり）は、番号を変換せずにそのまま使う", () => {
    renderReview(result({ choiceOrder: CHOICE_ORDER_VERSION, answerRecords: [record(q.choices.indexOf(pickedText), q.answer)] }));
    expect(within(rowFor(pickedText)).getByText("あなたの解答")).toBeTruthy();
    expect(screen.getAllByText("あなたの解答").length).toBe(1);
  });

  it("未解答の履歴は、旧い履歴でも『未解答でした』と表示され、どの選択肢にも解答の印が付かない", () => {
    renderReview(result({ answerRecords: [record(null as unknown as number, OLD_CORRECT)] }));
    expect(screen.getByText("（未解答でした）")).toBeTruthy();
    expect(screen.queryByText("あなたの解答")).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../src/pages/Home";
import type { AppData, ItemType, ProgressRecord } from "../../src/types";

afterEach(() => cleanup());

let seq = 0;
function rec(itemType: ItemType, isCorrect: boolean): ProgressRecord {
  seq++;
  return { itemId: `${itemType}-${seq}`, itemType, itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1,
    nextReviewDate: "2099-01-01", lastAnsweredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(), isCorrect };
}
const many = (n: number, t: ItemType) => Array.from({ length: n }, () => rec(t, true));
function data(records: ProgressRecord[]): AppData {
  return {
    progress: Object.fromEntries(records.map((r) => [r.itemId, r])), answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [],
    placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2,
  };
}
const show = (d: AppData) => render(<MemoryRouter><Home data={d} onSetTargetGoal={() => {}} /></MemoryRouter>);

describe("ホーム: 予想スコアの『暫定』表示", () => {
  it("採点された問題が足りない間（初回模試の直後など）は、『暫定』と説明を表示する", () => {
    show(data([...many(15, "word"), ...many(15, "grammar"), ...many(25, "listeningPart1")]));
    expect(screen.getAllByText("暫定").length).toBeGreaterThan(0);
    expect(screen.getByText(/単語の自己判定を含む暫定値です/)).toBeTruthy();
  });

  it("採点された問題が20件以上たまると、『暫定』は表示されない", () => {
    show(data([...many(25, "grammar"), ...many(25, "listeningPart1")]));
    expect(screen.queryByText("暫定")).toBeNull();
    expect(screen.queryByText(/単語の自己判定を含む暫定値です/)).toBeNull();
  });
});

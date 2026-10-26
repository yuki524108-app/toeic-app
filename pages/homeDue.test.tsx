// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../../src/pages/Home";
import { isDueToday } from "../../src/lib/spacedRepetition";
import words from "../../src/data/words.json";
import grammar from "../../src/data/grammar.json";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";
import homeSource from "../../src/pages/Home.tsx?raw";
import appSource from "../../src/App.tsx?raw";
import type { AppData, ProgressRecord } from "../../src/types";

afterEach(() => cleanup());

const rec = (id: string, next: string): ProgressRecord => ({ itemId: id, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: next, lastAnsweredAt: "", isCorrect: true });
const base = (progress: Record<string, ProgressRecord>): AppData => ({ progress, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 });
const show = (d: AppData) => render(<MemoryRouter><Home data={d} onSetTargetGoal={() => {}} /></MemoryRouter>);

/** 問題データ全体から数えた「今日復習する」件数（以前のホームの数え方） */
function dueFromFullData(progress: Record<string, ProgressRecord>) {
  const due = (id: string) => isDueToday(progress[id]);
  return {
    words: (words as { id: string }[]).filter((x) => due(x.id)).length,
    grammar: (grammar as { id: string }[]).filter((x) => due(x.id)).length,
    part1: (part1 as { id: string }[]).filter((x) => due(x.id)).length,
    part2: (part2 as { id: string }[]).filter((x) => due(x.id)).length,
    part34: (part34 as { questions: { id: string }[] }[]).filter((s) => s.questions.some((q) => due(q.id))).length,
    part6: (part6 as { blanks: { id: string }[] }[]).filter((p) => p.blanks.some((b) => due(b.id))).length,
    reading: (readings as { questions: { id: string }[] }[]).filter((p) => p.questions.some((q) => due(q.id))).length,
  };
}

describe("ホームの『今日の復習』の件数（索引から数える）", () => {
  it("学習の記録が1つもなければ、全問題が『本日の分』になる（従来と同じ件数）", () => {
    const expected = dueFromFullData({});
    show(base({}));
    expect(screen.getByText(`本日 ${expected.words} 問`)).toBeTruthy();   // 単語・文法・Part 1・Part 2 は「問」
    expect(screen.getByText(`本日 ${expected.part34} セット`)).toBeTruthy();
    expect(screen.getByText(`本日 ${expected.part6} パッセージ`)).toBeTruthy();
  });

  it("一部を学習済み（復習日が先）にすると、その分だけ件数が減り、従来の数え方と一致する", () => {
    const progress: Record<string, ProgressRecord> = {};
    (words as { id: string }[]).slice(0, 120).forEach((w) => { progress[w.id] = rec(w.id, "2099-01-01"); });
    (part34 as { questions: { id: string }[] }[]).slice(0, 10).forEach((s) => s.questions.forEach((q) => { progress[q.id] = rec(q.id, "2099-01-01"); }));
    // 1設問だけ復習日が先のセットは、他の設問が未学習なので、まだ『本日の分』に数える
    const partialSet = (part34 as { questions: { id: string }[] }[])[20];
    progress[partialSet.questions[0].id] = rec(partialSet.questions[0].id, "2099-01-01");
    const expected = dueFromFullData(progress);
    expect(expected.words).toBe(2000 - 120);
    expect(expected.part34).toBe(169 - 10);
    show(base(progress));
    expect(screen.getByText(`本日 ${expected.words} 問`)).toBeTruthy();
    expect(screen.getByText(`本日 ${expected.part34} セット`)).toBeTruthy();
  });
});

describe("ホームは、問題データ本体を読み込まない（最初の読み込みを軽く保つためのガード）", () => {
  const DATA_IMPORT = /from\s+["'][^"']*data\/(words|grammar|readings|part6|listeningPart1|listeningPart2|listeningPart34)\.json["']/;
  it("Home.tsx は索引（itemIndex.json）だけを読み込む", () => {
    expect(homeSource).not.toMatch(DATA_IMPORT);
    expect(homeSource).toMatch(/data\/itemIndex\.json/);
  });
  it("App.tsx は問題データを読み込まない。ホーム以外の画面は遅延読み込みになっている", () => {
    expect(appSource).not.toMatch(DATA_IMPORT);
    for (const page of ["WordStudy", "GrammarStudy", "ReadingStudy", "Part6Study", "ListeningPart1Study", "ListeningPart2Study", "ListeningPart34Study", "Review", "Progress", "PlacementTest", "MockTest", "MockTestReview", "QuickStudy"]) {
      expect(appSource, `${page} が通常の import になっている`).not.toMatch(new RegExp(`import \\w+ from "\\./pages/${page}"`));
      expect(appSource).toMatch(new RegExp(`lazyPage\\(\\(\\) => import\\("\\./pages/${page}"\\)\\)`));
    }
  });
});

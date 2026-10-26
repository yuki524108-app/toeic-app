import { describe, it, expect } from "vitest";
import { calcGoalProgress, calcRequiredPace, isValidTargetScore, projectFromMocks } from "../../src/lib/goal";
import { buildMonthGrid, earliestLogMonth, heatLevel, summarizeMonth, totalStudied } from "../../src/lib/studyCalendar";
import type { DailyLog, MockTestResult } from "../../src/types";

describe("目標スコア", () => {
  it("有効な目標は10〜990点の5点刻みの整数", () => {
    expect([730, 10, 990, 855].map(isValidTargetScore)).toEqual([true, true, true, true]);
    expect([732, 5, 0, 995, 730.5, NaN].map(isValidTargetScore)).toEqual([false, false, false, false, false, false]);
  });
  it("達成度は最大100%、達成済みなら残り0", () => {
    expect(calcGoalProgress(640, 730)).toEqual({ percent: 88, remaining: 90, achieved: false });
    expect(calcGoalProgress(800, 730)).toEqual({ percent: 100, remaining: 0, achieved: true });
  });
  it("必要なペース: 残り7日以上は週あたり、60日以上は月あたりも。残り7日未満は日数のまま、達成済み・期限切れは null", () => {
    expect(calcRequiredPace(150, 100)).toEqual({ daysLeft: 100, perWeek: 11, perMonth: 45 });
    expect(calcRequiredPace(150, 5)).toEqual({ daysLeft: 5, perWeek: null, perMonth: null });
    expect(calcRequiredPace(150, 70)).toMatchObject({ perWeek: 15, perMonth: 65 });
    expect(calcRequiredPace(0, 10)).toBeNull();
    expect(calcRequiredPace(10, 0)).toBeNull();
  });
  describe("模試の伸びからのスコア見込み", () => {
    const mk = (t: string, s: number) => ({ id: t, completedAt: t, listening: {}, reading: {}, totalScore: s }) as unknown as MockTestResult;
    const h = [mk("2026-09-01T00:00:00Z", 500), mk("2026-09-15T00:00:00Z", 540)];
    it("2週間で+40点（+20点/週）が10週続くと740点。目標730なら届く見込み", () => {
      expect(projectFromMocks(h, 70, 730)).toEqual({ perWeek: 20, projectedScore: 740, reachesTarget: true });
      expect(projectFromMocks(h, 70, 900)?.reachesTarget).toBe(false);
    });
    it("模試が1回、または間隔が7日未満なら算出しない", () => {
      expect(projectFromMocks([h[0]], 30, 700)).toBeNull();
      expect(projectFromMocks([mk("2026-09-01T00:00:00Z", 500), mk("2026-09-04T00:00:00Z", 600)], 30, 700)).toBeNull();
    });
    it("下降の傾向もそのまま見込みに反映する。990点を超えない", () => {
      expect(projectFromMocks([mk("2026-09-01T00:00:00Z", 600), mk("2026-09-15T00:00:00Z", 560)], 70, 730)?.projectedScore).toBe(360);
      expect(projectFromMocks([mk("2026-09-01T00:00:00Z", 700), mk("2026-09-08T00:00:00Z", 900)], 700, 990)?.projectedScore).toBe(990);
    });
  });
});

describe("学習カレンダー", () => {
  const log = (date: string, words: number): DailyLog => ({ date, wordsStudied: words, grammarStudied: 0, readingsStudied: 0, part6Studied: 0, listeningPart1Studied: 0, listeningPart2Studied: 0, listeningPart34Studied: 0 });
  const logs = { "2026-10-01": log("2026-10-01", 12), "2026-10-15": log("2026-10-15", 60), "2026-09-30": log("2026-09-30", 3) };
  it("濃淡は 0 / 1〜9 / 10〜24 / 25〜49 / 50以上の5段階", () => {
    expect([0, 1, 9, 10, 24, 25, 49, 50].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
  it("2026年10月のカレンダーは、1日が木曜（日曜始まりで5列目）で、5週に収まる", () => {
    const g = buildMonthGrid(2026, 9, logs);
    expect(g.length).toBe(5);
    expect(g[0].findIndex((c) => c?.day === 1)).toBe(4);
    expect(g[4].map((c) => c?.day)).toEqual([25, 26, 27, 28, 29, 30, 31]);
    expect(g.flat().find((c) => c?.day === 15)).toMatchObject({ count: 60, level: 4 });
  });
  it("月の集計（学習日数・合計問題数）と、最初の学習月", () => {
    expect(summarizeMonth(2026, 9, logs)).toEqual({ studyDays: 2, totalQuestions: 72, daysInMonth: 31 });
    expect(summarizeMonth(2026, 1, {}).daysInMonth).toBe(28);
    expect(earliestLogMonth(logs)).toEqual({ year: 2026, month: 8 });
    expect(earliestLogMonth({})).toBeNull();
  });
  it("1日の学習量は全カテゴリの合計", () => {
    expect(totalStudied({ ...log("x", 1), grammarStudied: 2, part6Studied: 3, listeningPart34Studied: 4 })).toBe(10);
    expect(totalStudied(undefined)).toBe(0);
  });
});

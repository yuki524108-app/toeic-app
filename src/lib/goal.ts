import type { AppData, MockTestResult } from "../types";
import { estimateScore } from "./scoreEstimate";

export const MIN_TARGET_SCORE = 10;
export const MAX_TARGET_SCORE = 990;
/** 設定画面で選べる目標スコアのプリセット（よく使われる目安） */
export const TARGET_SCORE_PRESETS = [600, 730, 800, 860, 900] as const;

/** 目標スコアとして有効か（10〜990の5点刻みの整数。TOEICのスコアは5点刻み） */
export function isValidTargetScore(score: number): boolean {
  return (
    Number.isInteger(score) &&
    score >= MIN_TARGET_SCORE &&
    score <= MAX_TARGET_SCORE &&
    score % 5 === 0
  );
}

export type CurrentScore =
  | { status: "none" }
  | { status: "ok"; score: number; source: "estimate" | "mock" };

/**
 * 達成度の比較対象となる「現在のスコア」を決める。
 * 学習履歴からの予想スコア（リーディング・リスニング両方揃った場合）を優先し、
 * まだ揃っていなければ直近の模試の総合スコアで代用する。
 */
export function getCurrentScore(data: AppData): CurrentScore {
  const estimate = estimateScore(data.progress);
  if (estimate.total.status === "ok") {
    return { status: "ok", score: estimate.total.score, source: "estimate" };
  }
  const latestMock = data.mockTestHistory[data.mockTestHistory.length - 1];
  if (latestMock) {
    return { status: "ok", score: latestMock.totalScore, source: "mock" };
  }
  return { status: "none" };
}

export type GoalProgress = {
  /** 達成度（0〜100%。目標到達時は100） */
  percent: number;
  /** 目標までの残りポイント（達成済みなら0） */
  remaining: number;
  achieved: boolean;
};

export function calcGoalProgress(current: number, target: number): GoalProgress {
  const achieved = current >= target;
  return {
    percent: Math.min(100, Math.round((current / target) * 100)),
    remaining: Math.max(0, target - current),
    achieved,
  };
}

export type RequiredPace = {
  daysLeft: number;
  /** 1週間あたりに必要な伸び（点、切り上げ）。残り7日未満のときは null（残り日数でそのまま表示する） */
  perWeek: number | null;
  /** 1ヶ月（30日）あたりに必要な伸び（点、切り上げ）。残り60日未満のときは null */
  perMonth: number | null;
};

/** 目標日までに目標に届くために必要な伸びのペース。残り日数が1日以上ある場合のみ算出する */
export function calcRequiredPace(
  remaining: number,
  daysLeft: number
): RequiredPace | null {
  if (remaining <= 0 || daysLeft <= 0) return null;
  return {
    daysLeft,
    perWeek: daysLeft >= 7 ? Math.ceil((remaining * 7) / daysLeft) : null,
    perMonth: daysLeft >= 60 ? Math.ceil((remaining * 30) / daysLeft) : null,
  };
}

export type MockProjection = {
  /** 直近の模試から見たスコアの伸び（点/週。マイナスもあり得る） */
  perWeek: number;
  /** このペースが目標日まで続いた場合のスコア見込み（5〜990に丸める） */
  projectedScore: number;
  /** 見込みが目標スコアに届くか */
  reachesTarget: boolean;
};

const PROJECTION_WINDOW = 3; // 直近の模試何回分から伸びを求めるか
const PROJECTION_MIN_SPAN_DAYS = 7; // 模試の間隔がこれ未満だと伸びの推定が不安定なので算出しない

/**
 * 直近の模試（最大3回）の総合スコアの推移から、目標日時点のスコア見込みを求める。
 * 模試が2回未満、または最初と最後の間隔が7日未満の場合は null。
 * 学習履歴ベースの予想スコアは時系列で保持していないため、時点が明確な模試の結果のみを使う。
 */
export function projectFromMocks(
  history: MockTestResult[],
  daysLeft: number,
  target: number
): MockProjection | null {
  if (daysLeft <= 0 || history.length < 2) return null;
  const sorted = [...history].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt)
  );
  const recent = sorted.slice(-PROJECTION_WINDOW);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const spanDays =
    (new Date(last.completedAt).getTime() -
      new Date(first.completedAt).getTime()) /
    86_400_000;
  if (!(spanDays >= PROJECTION_MIN_SPAN_DAYS)) return null;

  const perWeek = ((last.totalScore - first.totalScore) / spanDays) * 7;
  const raw = last.totalScore + perWeek * (daysLeft / 7);
  const projectedScore = Math.round(Math.min(990, Math.max(5, raw)));
  return {
    perWeek: Math.round(perWeek * 10) / 10,
    projectedScore,
    reachesTarget: projectedScore >= target,
  };
}

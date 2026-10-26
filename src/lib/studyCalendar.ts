import type { DailyLog } from "../types";
import { todayStr } from "./date";

/** 1日分の総学習問題数（全種別の合計） */
export function totalStudied(log: DailyLog | undefined): number {
  if (!log) return 0;
  return (
    log.wordsStudied +
    log.grammarStudied +
    log.readingsStudied +
    log.part6Studied +
    log.listeningPart1Studied +
    log.listeningPart2Studied +
    log.listeningPart34Studied
  );
}

/** 今日の日付キー（ローカル日付、YYYY-MM-DD）。学習ログのキーと同じ方式 */
export function todayKey(): string {
  return todayStr();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 年・月(0-11)・日からタイムゾーンに依存せず YYYY-MM-DD を組み立てる */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** 学習量に応じた濃淡レベル（0=未学習 〜 4=たくさん学習） */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 25) return 2;
  if (count < 50) return 3;
  return 4;
}

export type CalendarCell = {
  key: string; // YYYY-MM-DD
  day: number;
  count: number;
  level: HeatLevel;
};

/**
 * 指定した月のカレンダーを「週ごとの配列（日曜始まり）」で返す。
 * 月初より前・月末より後の空きマスは null。
 */
export function buildMonthGrid(
  year: number,
  month: number,
  logs: Record<string, DailyLog>
): (CalendarCell | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (CalendarCell | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(year, month, day);
    const count = totalStudied(logs[key]);
    cells.push({ key, day, count, level: heatLevel(count) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type MonthSummary = {
  studyDays: number;
  totalQuestions: number;
  daysInMonth: number;
};

export function summarizeMonth(
  year: number,
  month: number,
  logs: Record<string, DailyLog>
): MonthSummary {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let studyDays = 0;
  let totalQuestions = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const count = totalStudied(logs[dateKey(year, month, day)]);
    if (count > 0) {
      studyDays += 1;
      totalQuestions += count;
    }
  }
  return { studyDays, totalQuestions, daysInMonth };
}

/** 学習ログが存在する最も古い月（{year, month}）。ログが無ければ null */
export function earliestLogMonth(
  logs: Record<string, DailyLog>
): { year: number; month: number } | null {
  const keys = Object.keys(logs)
    .filter((k) => totalStudied(logs[k]) > 0)
    .sort();
  if (keys.length === 0) return null;
  const [y, m] = keys[0].split("-").map(Number);
  return { year: y, month: m - 1 };
}

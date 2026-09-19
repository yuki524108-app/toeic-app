import type { AppData, StudyMode } from "../types";
import { isDueToday } from "./spacedRepetition";

type WithId = { id: string };

export function filterByMode<T extends WithId>(
  items: T[],
  data: AppData,
  mode: StudyMode
): T[] {
  switch (mode) {
    case "all":
      return items;
    case "incorrect":
      return items.filter((item) => {
        const record = data.progress[item.id];
        return record !== undefined && record.isCorrect === false;
      });
    case "bookmarked":
      return items.filter((item) => data.bookmarks.includes(item.id));
    case "due":
    default:
      return items.filter((item) => isDueToday(data.progress[item.id]));
  }
}

export function parseStudyMode(value: string | null): StudyMode {
  if (value === "all" || value === "incorrect" || value === "bookmarked") {
    return value;
  }
  return "due";
}

export const modeLabel: Record<StudyMode, string> = {
  due: "今日の復習",
  all: "すべて学習",
  incorrect: "間違えた問題を復習",
  bookmarked: "ブックマークを復習",
};

export const emptyMessage: Record<StudyMode, string> = {
  due: "今日出題する分はありません。よく学習しました。",
  all: "問題データがありません。",
  incorrect: "間違えた問題はありません。",
  bookmarked: "ブックマークした項目はありません。",
};

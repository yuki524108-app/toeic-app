import type { AppData, MockTestResult, ProgressRecord } from "../types";

const STORAGE_KEY = "toeic-drill-data-v1";

const EMPTY_DATA: AppData = {
  progress: {},
  dailyLogs: {},
  streak: 0,
  lastStudyDate: null,
  bookmarks: [],
  placementTestCompletedAt: null,
  mockTestHistory: [],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    const parsed = JSON.parse(raw) as AppData;
    return { ...structuredClone(EMPTY_DATA), ...parsed };
  } catch {
    return structuredClone(EMPTY_DATA);
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("学習データの保存に失敗しました", e);
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordAnswer(
  data: AppData,
  record: ProgressRecord
): AppData {
  const next: AppData = structuredClone(data);
  next.progress[record.itemId] = record;

  const date = todayStr();
  const log = next.dailyLogs[date] ?? {
    date,
    wordsStudied: 0,
    grammarStudied: 0,
    readingsStudied: 0,
    part6Studied: 0,
    listeningPart1Studied: 0,
    listeningPart2Studied: 0,
    listeningPart34Studied: 0,
  };
  if (record.itemType === "word") log.wordsStudied += 1;
  else if (record.itemType === "grammar") log.grammarStudied += 1;
  else if (record.itemType === "reading") log.readingsStudied += 1;
  else if (record.itemType === "part6") log.part6Studied += 1;
  else if (record.itemType === "listeningPart1") log.listeningPart1Studied += 1;
  else if (record.itemType === "listeningPart2") log.listeningPart2Studied += 1;
  else log.listeningPart34Studied += 1;
  next.dailyLogs[date] = log;

  // 連続学習日数の更新
  if (next.lastStudyDate !== date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    next.streak = next.lastStudyDate === yStr ? next.streak + 1 : 1;
    next.lastStudyDate = date;
  }

  saveData(next);
  return next;
}

export function toggleBookmark(data: AppData, itemId: string): AppData {
  const next: AppData = structuredClone(data);
  next.bookmarks = next.bookmarks.includes(itemId)
    ? next.bookmarks.filter((id) => id !== itemId)
    : [...next.bookmarks, itemId];
  saveData(next);
  return next;
}

export function completePlacementTest(data: AppData): AppData {
  const next: AppData = structuredClone(data);
  next.placementTestCompletedAt = new Date().toISOString();
  saveData(next);
  return next;
}

export function recordMockTestResult(
  data: AppData,
  result: MockTestResult
): AppData {
  const next: AppData = structuredClone(data);
  next.mockTestHistory = [...next.mockTestHistory, result];
  saveData(next);
  return next;
}

export function resetAllData(): AppData {
  const fresh = structuredClone(EMPTY_DATA);
  saveData(fresh);
  return fresh;
}

const EXPORT_FORMAT = "toeic-drill-backup";
const EXPORT_VERSION = 1;

/** 進捗データをバックアップ用のJSON文字列にシリアライズする */
export function exportDataAsJSON(data: AppData): string {
  const payload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * バックアップJSON文字列を読み込み、AppDataとして妥当な最低限の構造チェックを行う。
 * 不正な内容の場合は null を返す（呼び出し側でエラー表示する）。
 */
export function parseImportedJSON(text: string): AppData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const asRecord = (v: unknown): Record<string, unknown> | null =>
    v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;

  const parsedRecord = asRecord(parsed);
  if (!parsedRecord) return null;

  // { format, version, data: {...} } の形式、または AppData 自体が直接渡された場合の両方に対応する
  const candidate: Record<string, unknown> | null =
    "data" in parsedRecord ? asRecord(parsedRecord.data) : parsedRecord;

  if (!candidate || !("progress" in candidate) || !("dailyLogs" in candidate)) {
    return null;
  }

  return {
    ...structuredClone(EMPTY_DATA),
    ...(candidate as Partial<AppData>),
  };
}

/** インポートしたデータで学習データ全体を置き換える（エクスポート／インポート機能用） */
export function replaceAllData(newData: AppData): AppData {
  saveData(newData);
  return newData;
}

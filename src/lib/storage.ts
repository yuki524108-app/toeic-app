import type { AppData, MissReason, MockTestResult, ProgressRecord } from "../types";
import { addDaysLocal, localDateStr, parseLocalDate, todayStr } from "./date";
import { isValidTargetScore } from "./goal";
import { appendAnswerEvent, sanitizeAnswerHistory } from "./history";
import { applyMissReason } from "./missReason";
import { measureStorageChars, reportSaveFailure, reportSaveSuccess } from "./storageStatus";

const STORAGE_KEY = "toeic-drill-data-v1";

/** 2: 日付キーをローカル日付で保持する形式（それ以前はUTC基準） */
const CURRENT_DATA_VERSION = 2;

const EMPTY_DATA: AppData = {
  progress: {},
  answerHistory: [],
  dailyLogs: {},
  streak: 0,
  lastStudyDate: null,
  bookmarks: [],
  placementTestCompletedAt: null,
  mockTestHistory: [],
  targetScore: null,
  targetDate: null,
  dataVersion: CURRENT_DATA_VERSION,
};

/**
 * 日付キーがUTC基準だった旧データ（dataVersion < 2）をローカル日付基準へ移行する。
 * - 復習日（nextReviewDate）：各問題の最終解答日時（lastAnsweredAt）と間隔（interval）から再計算できるため正確に移行する
 * - 最終学習日（lastStudyDate）：最新の解答日時から再計算する（連続学習日数の判定がずれないようにするため）
 * - 日別の学習ログ（dailyLogs）：時刻を持たず日付ごとの件数のみのため再計算できず、過去分はそのまま残す
 *   （日本時間の0:00〜9:00に学習した分のみ、1日前のマスに入ったままになる）
 */
function migrateToLocalDates(data: AppData): AppData {
  const next: AppData = structuredClone(data);
  let latest: string | null = null;
  for (const r of Object.values(next.progress)) {
    const answered = new Date(r.lastAnsweredAt);
    if (Number.isNaN(answered.getTime())) continue;
    r.nextReviewDate = localDateStr(addDaysLocal(answered, r.interval));
    if (latest === null || r.lastAnsweredAt > latest) latest = r.lastAnsweredAt;
  }
  if (next.lastStudyDate && latest) {
    next.lastStudyDate = localDateStr(new Date(latest));
  }
  next.dataVersion = CURRENT_DATA_VERSION;
  return next;
}

/** 読み込んだ（またはインポートした）データを補完し、必要なら旧形式から移行する */
function normalizeLoaded(parsed: Partial<AppData>): AppData {
  const merged: AppData = { ...structuredClone(EMPTY_DATA), ...parsed };
  // 解答の履歴：旧いデータには無い。形の崩れた件は捨てる
  merged.answerHistory = sanitizeAnswerHistory(parsed.answerHistory);
  // 不正な目標値は未設定に戻す
  if (merged.targetScore !== null && !isValidTargetScore(merged.targetScore)) {
    merged.targetScore = null;
  }
  if (
    merged.targetScore === null ||
    typeof merged.targetDate !== "string" ||
    parseLocalDate(merged.targetDate) === null
  ) {
    merged.targetDate = null;
  }
  const version = typeof parsed.dataVersion === "number" ? parsed.dataVersion : 1;
  return version < CURRENT_DATA_VERSION ? migrateToLocalDates(merged) : merged;
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const data = normalizeLoaded(parsed);
    if (parsed.dataVersion !== data.dataVersion) saveData(data); // 移行結果を保存
    return data;
  } catch {
    return structuredClone(EMPTY_DATA);
  }
}

/** 端末に保存されているデータを、解釈せずにそのまま返す（壊れていても取り出せる）。なければ null */
export function readRawStoredData(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * 学習データを端末に保存する。成功なら true。
 * 失敗（容量超過・保存が許可されていない等）は storageStatus に報告し、画面が警告を出す。
 * 失敗しても、メモリ上の状態はそのまま使い続けられる（バックアップを書き出して残せる）。
 */
export function saveData(data: AppData): boolean {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    reportSaveSuccess(measureStorageChars(STORAGE_KEY, json.length));
    return true;
  } catch (e) {
    console.error("学習データの保存に失敗しました", e);
    reportSaveFailure(e);
    return false;
  }
}

export function recordAnswer(
  data: AppData,
  record: ProgressRecord
): AppData {
  const next: AppData = structuredClone(data);
  next.progress[record.itemId] = record;
  next.answerHistory = appendAnswerEvent(next.answerHistory, record);

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
  log.gradedCount = (log.gradedCount ?? 0) + 1;
  if (record.isCorrect) log.correctCount = (log.correctCount ?? 0) + 1;
  next.dailyLogs[date] = log;

  // 連続学習日数の更新
  if (next.lastStudyDate !== date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = localDateStr(yesterday);
    next.streak = next.lastStudyDate === yStr ? next.streak + 1 : 1;
    next.lastStudyDate = date;
  }

  saveData(next);
  return next;
}

/**
 * 間違えた理由を記録する（2.1.30）。解答の記録そのものは変えず、問題ごとの理由の通算だけを更新する。
 * 問題の記録が無いとき（想定外）は何もしない。
 */
export function setMissReason(
  data: AppData,
  itemId: string,
  next: MissReason | null,
  prev: MissReason | null
): AppData {
  const record = data.progress[itemId];
  if (!record) return data;
  const updated: AppData = {
    ...data,
    progress: { ...data.progress, [itemId]: applyMissReason(record, next, prev) },
  };
  saveData(updated);
  return updated;
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

/**
 * 目標（スコアと任意の目標日）を設定する。score が null なら目標を解除する（目標日も同時に解除）。
 * date は目標日（YYYY-MM-DD）。目標日を設けない場合は null。
 */
export function setTargetGoal(
  data: AppData,
  score: number | null,
  date: string | null
): AppData {
  const next: AppData = structuredClone(data);
  next.targetScore = score;
  next.targetDate = score === null ? null : date;
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

  // 旧バージョンのバックアップ（日付キーがUTC基準）もここで移行される
  return normalizeLoaded(candidate as Partial<AppData>);
}

/** インポートしたデータで学習データ全体を置き換える（エクスポート／インポート機能用） */
export function replaceAllData(newData: AppData): AppData {
  saveData(newData);
  return newData;
}

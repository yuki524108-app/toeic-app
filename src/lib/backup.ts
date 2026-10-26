import type { AppData } from "../types";
import { todayStr } from "./date";
import { exportDataAsJSON, readRawStoredData } from "./storage";

/**
 * バックアップ（学習データのJSON書き出し）まわり。
 * 学習データは端末のブラウザの中にしか保存されないため、定期的なバックアップを促す。
 */

const LAST_BACKUP_KEY = "toeic-app:last-backup-at";
const SNOOZE_KEY = "toeic-app:backup-snooze-until";

/** 最後のバックアップからこの日数がたったら促す */
export const BACKUP_REMIND_AFTER_DAYS = 30;
/** 促す対象とする最小の学習量（解答した問題の数）。使い始めたばかりのときは促さない */
export const BACKUP_REMIND_MIN_RECORDS = 50;
/** 「あとで」を選んだときに、促しを出さない日数 */
export const BACKUP_SNOOZE_DAYS = 7;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 補助的な記録なので、保存できなくても黙って無視する
  }
}

export function getLastBackupAt(): string | null {
  return read(LAST_BACKUP_KEY);
}

/** 学習データをJSONファイルとしてダウンロードし、バックアップした日時を記録する */
export function downloadBackup(data: AppData, now: Date = new Date()): void {
  const json = exportDataAsJSON(data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `toeic-drill-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  write(LAST_BACKUP_KEY, now.toISOString());
}

function triggerDownload(content: string, type: string, fileName: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 端末に保存されている学習データを、そのままバックアップとして書き出す（エラー画面から使う）。
 * アプリが壊れた状態でも使えるよう、画面の状態ではなく保存済みのデータを直接読む。
 * 正しいJSONなら通常のバックアップと同じ形式（あとでインポートできる）で、壊れていれば保存されている文字列をそのまま
 * テキストとして書き出す（あとから取り出せるように）。保存されたデータがなければ false。
 */
export function downloadStoredDataBackup(now: Date = new Date()): boolean {
  const raw = readRawStoredData();
  if (raw === null) return false;
  const stamp = todayStr();
  try {
    const parsed = JSON.parse(raw);
    triggerDownload(
      JSON.stringify(
        { format: "toeic-drill-backup", version: 1, exportedAt: now.toISOString(), data: parsed },
        null,
        2
      ),
      "application/json",
      `toeic-drill-backup-${stamp}.json`
    );
  } catch {
    triggerDownload(raw, "text/plain", `toeic-drill-damaged-data-${stamp}.txt`);
  }
  write(LAST_BACKUP_KEY, now.toISOString());
  return true;
}

/** 「あとで」：一定期間、バックアップの促しを出さない */
export function snoozeBackupReminder(now: Date = new Date()): void {
  const until = new Date(now.getTime() + BACKUP_SNOOZE_DAYS * 86_400_000);
  write(SNOOZE_KEY, until.toISOString());
}

export type BackupReminder = {
  show: boolean;
  /** 最後のバックアップからの日数。一度もバックアップしていなければ null */
  daysSince: number | null;
};

/**
 * バックアップを促すか。
 * - 解答が50問未満（使い始め）なら促さない
 * - 「あとで」を選んでから7日以内なら促さない
 * - 一度もバックアップしていない、または最後のバックアップから30日以上たっていれば促す
 */
export function backupReminder(
  data: AppData,
  now: Date = new Date(),
  lastBackupAt: string | null = getLastBackupAt(),
  snoozeUntil: string | null = read(SNOOZE_KEY)
): BackupReminder {
  const daysSince = lastBackupAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000))
    : null;
  if (Object.keys(data.progress).length < BACKUP_REMIND_MIN_RECORDS) return { show: false, daysSince };
  if (snoozeUntil && now.getTime() < new Date(snoozeUntil).getTime()) return { show: false, daysSince };
  const due = daysSince === null || daysSince >= BACKUP_REMIND_AFTER_DAYS;
  return { show: due, daysSince };
}

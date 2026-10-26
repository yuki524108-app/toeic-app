// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BACKUP_REMIND_MIN_RECORDS, backupReminder, downloadBackup, getLastBackupAt, snoozeBackupReminder,
} from "../../src/lib/backup";
import type { AppData, ProgressRecord } from "../../src/types";

const NOW = new Date("2026-10-04T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
function dataWith(records: number): AppData {
  const progress: Record<string, ProgressRecord> = {};
  for (let i = 0; i < records; i++) {
    progress[`w${i}`] = { itemId: `w${i}`, itemType: "word", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 1, nextReviewDate: "2099-01-01", lastAnsweredAt: NOW.toISOString(), isCorrect: true };
  }
  return { progress, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: null, mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
}

beforeEach(() => localStorage.clear());
afterEach(() => { Reflect.deleteProperty(URL, "createObjectURL"); Reflect.deleteProperty(URL, "revokeObjectURL"); vi.restoreAllMocks(); });

describe("backupReminder（バックアップを促すか）", () => {
  it("使い始め（解答が50問未満）なら促さない", () => {
    expect(backupReminder(dataWith(BACKUP_REMIND_MIN_RECORDS - 1), NOW, null, null).show).toBe(false);
  });
  it("一度もバックアップしていなければ促す（日数は null）", () => {
    expect(backupReminder(dataWith(BACKUP_REMIND_MIN_RECORDS), NOW, null, null)).toEqual({ show: true, daysSince: null });
  });
  it("最後のバックアップが29日前なら促さず、30日前なら促す", () => {
    const d = dataWith(100);
    expect(backupReminder(d, NOW, daysAgo(29), null)).toEqual({ show: false, daysSince: 29 });
    expect(backupReminder(d, NOW, daysAgo(30), null)).toEqual({ show: true, daysSince: 30 });
  });
  it("「あとで」から7日以内は促さず、期限が切れると再び促す", () => {
    const d = dataWith(100);
    const until = new Date(NOW.getTime() + 3 * 86_400_000).toISOString();
    expect(backupReminder(d, NOW, null, until).show).toBe(false);
    expect(backupReminder(d, new Date(NOW.getTime() + 4 * 86_400_000), null, until).show).toBe(true);
  });
  it("バックアップしたばかり（0日）なら促さない", () => {
    expect(backupReminder(dataWith(100), NOW, NOW.toISOString(), null)).toEqual({ show: false, daysSince: 0 });
  });
});

describe("downloadBackup / snoozeBackupReminder", () => {
  it("バックアップのJSONをダウンロードし、バックアップした日時を記録する", async () => {
    let blob: Blob | null = null;
    Object.assign(URL, { createObjectURL: (b: Blob) => { blob = b; return "blob:x"; }, revokeObjectURL: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const data = dataWith(3);
    downloadBackup(data, NOW);
    expect(click).toHaveBeenCalledTimes(1);
    expect(getLastBackupAt()).toBe(NOW.toISOString());
    const parsed = JSON.parse(await (blob as unknown as Blob).text());
    expect(parsed.data.progress).toEqual(data.progress);
  });

  it("「あとで」を押すと、7日後までの期限が記録され、その間は促されない", () => {
    snoozeBackupReminder(NOW);
    expect(backupReminder(dataWith(100), NOW).show).toBe(false);
    expect(backupReminder(dataWith(100), new Date(NOW.getTime() + 8 * 86_400_000)).show).toBe(true);
  });

  it("ダウンロード後は、すぐには促されない", () => {
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBackup(dataWith(100));
    expect(backupReminder(dataWith(100)).show).toBe(false);
  });
});

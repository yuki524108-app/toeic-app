import { useState } from "react";
import type { AppData } from "../types";
import { backupReminder, downloadBackup, snoozeBackupReminder } from "../lib/backup";

/**
 * ホーム画面のバックアップのおすすめ。
 * 学習データは端末のブラウザの中にしか保存されないため、一度もバックアップしていない、
 * または最後のバックアップから30日以上たっている場合に案内する（使い始めの間は出さない）。
 */
export default function BackupReminder({ data }: { data: AppData }) {
  // 「今すぐバックアップ」「あとで」を押したら、表示を判定し直す
  const [, setTick] = useState(0);
  const reminder = backupReminder(data);
  if (!reminder.show) return null;

  return (
    <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
      <p className="text-sm font-medium text-(--color-ink)">バックアップのおすすめ</p>
      <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
        学習記録は、この端末のブラウザの中にだけ保存されています。
        {reminder.daysSince === null
          ? "まだバックアップがありません。"
          : `最後のバックアップから${reminder.daysSince}日たっています。`}
        ブラウザのデータを消したり、端末を変えたりしたときのために、保存しておくと安心です。
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            downloadBackup(data);
            setTick((n) => n + 1);
          }}
          className="rounded-sm bg-(--color-ink) px-4 py-2 text-xs font-medium text-(--color-paper)"
        >
          今すぐバックアップ
        </button>
        <button
          onClick={() => {
            snoozeBackupReminder();
            setTick((n) => n + 1);
          }}
          className="rounded-sm border border-(--color-line) px-4 py-2 text-xs text-(--color-ink)"
        >
          あとで
        </button>
      </div>
    </div>
  );
}

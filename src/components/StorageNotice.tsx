import { useState, useSyncExternalStore } from "react";
import type { AppData } from "../types";
import { downloadBackup } from "../lib/backup";
import { getStorageStatus, subscribeStorageStatus } from "../lib/storageStatus";

/**
 * 学習データの保存に関する警告を、画面の上部に表示する。
 * - 保存に失敗している：学習記録が失われる恐れがあるため、バックアップの保存を強く促す（閉じられない）
 * - 保存容量が残り少ない：バックアップを促す（閉じられる）
 */
export default function StorageNotice({ data }: { data: AppData }) {
  const status = useSyncExternalStore(subscribeStorageStatus, getStorageStatus);
  const [dismissedNearLimit, setDismissedNearLimit] = useState(false);

  if (status.saveFailed) {
    return (
      <div
        role="alert"
        className="sticky top-0 z-30 border-b border-(--color-incorrect) bg-(--color-incorrect-soft) px-5 py-3"
      >
        <div className="mx-auto max-w-md">
          <p className="text-sm font-medium text-(--color-incorrect)">
            学習データを端末に保存できませんでした
          </p>
          <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
            {status.reason === "quota"
              ? "端末の保存容量がいっぱいです。"
              : "このブラウザでは保存が許可されていません（プライベートモードなど）。"}
            このままアプリを閉じると、直前までの学習記録が失われる恐れがあります。いまのうちにバックアップを保存してください。
          </p>
          <button
            onClick={() => downloadBackup(data)}
            className="mt-2 rounded-sm bg-(--color-ink) px-4 py-2 text-xs font-medium text-(--color-paper)"
          >
            バックアップを保存する
          </button>
        </div>
      </div>
    );
  }

  if (status.nearLimit && !dismissedNearLimit) {
    return (
      <div
        role="status"
        className="sticky top-0 z-30 border-b border-(--color-gold) bg-(--color-gold-soft) px-5 py-3"
      >
        <div className="mx-auto max-w-md">
          <p className="text-sm font-medium text-(--color-ink)">
            保存容量が残り少なくなっています（約{status.usagePercent}%使用）
          </p>
          <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
            容量がいっぱいになると、学習記録を保存できなくなります。バックアップを保存しておくと安心です。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => downloadBackup(data)}
              className="rounded-sm bg-(--color-ink) px-4 py-2 text-xs font-medium text-(--color-paper)"
            >
              バックアップを保存する
            </button>
            <button
              onClick={() => setDismissedNearLimit(true)}
              className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-2 text-xs text-(--color-ink)"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

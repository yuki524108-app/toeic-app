import { useState, useSyncExternalStore } from "react";
import { applyUpdate, isUpdateAvailable, subscribeUpdate } from "../lib/appUpdate";

/**
 * 新しい版のアプリが用意できたときの案内。
 * 更新すると画面が再読み込みされるため、タイミングは利用者が選べる（「あとで」で閉じられる）。
 */
export default function UpdateNotice() {
  const available = useSyncExternalStore(subscribeUpdate, isUpdateAvailable);
  const [dismissed, setDismissed] = useState(false);
  if (!available || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-4"
    >
      <div className="rounded-sm border border-(--color-gold) bg-(--color-paper-raised) p-4 shadow-lg">
        <p className="text-sm font-medium text-(--color-ink)">新しい版のアプリがあります</p>
        <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
          更新すると画面が再読み込みされます。模試の受験中は、終わってから更新してください。学習記録は保たれます。
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={applyUpdate}
            className="rounded-sm bg-(--color-ink) px-4 py-2 text-xs font-medium text-(--color-paper)"
          >
            更新する
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-sm border border-(--color-line) px-4 py-2 text-xs text-(--color-ink)"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}

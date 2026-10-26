/**
 * 学習データの保存状態（保存の失敗・保存容量）を、画面に伝えるための小さなストア。
 *
 * 保存（`saveData`）は、容量超過やプライベートモードなどで失敗することがある。以前は失敗しても
 * コンソールにエラーを出すだけで、利用者は気づかないまま学習記録を失っていた。
 * 保存のたびに結果をここへ報告し、画面（`StorageNotice`）が警告を出す。
 */

/** localStorage の容量の目安（文字数）。ブラウザによって異なるが、一般に約5MB（キーと値の文字数の合計） */
export const STORAGE_LIMIT_CHARS = 5_000_000;
/** 使用量がこの割合を超えたら「残り少ない」警告を出す */
export const STORAGE_WARN_RATIO = 0.8;

export type StorageFailureReason = "quota" | "unavailable";

export type StorageStatus = {
  /** 直近の保存が失敗している（次に保存が成功するまで true） */
  saveFailed: boolean;
  reason: StorageFailureReason | null;
  /** 保存容量が残り少ない（使用量が目安の80%以上） */
  nearLimit: boolean;
  /** 使用量の目安（%）。保存に成功したときだけ更新される */
  usagePercent: number;
};

const INITIAL: StorageStatus = { saveFailed: false, reason: null, nearLimit: false, usagePercent: 0 };

let status: StorageStatus = INITIAL;
const listeners = new Set<() => void>();

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 保存の失敗の原因を、容量超過とそれ以外（保存が許可されていない等）に分ける */
export function classifyStorageError(error: unknown): StorageFailureReason {
  const e = error as { name?: string; code?: number } | null;
  if (
    e?.name === "QuotaExceededError" ||
    e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || // Firefox
    e?.code === 22 ||
    e?.code === 1014
  ) {
    return "quota";
  }
  return "unavailable";
}

/**
 * このオリジンの localStorage の使用量（キーと値の文字数の合計）。
 * 主要なデータ（mainKey）は、いま保存した文字列の長さ（mainLength）を使い、読み直さない。
 */
export function measureStorageChars(mainKey: string, mainLength: number): number {
  let total = mainKey.length + mainLength;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null || key === mainKey) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    // 使用量が測れなくても、保存自体の成否には影響させない
  }
  return total;
}

function sameStatus(a: StorageStatus, b: StorageStatus): boolean {
  return (
    a.saveFailed === b.saveFailed &&
    a.reason === b.reason &&
    a.nearLimit === b.nearLimit &&
    a.usagePercent === b.usagePercent
  );
}

function update(next: StorageStatus): void {
  if (sameStatus(status, next)) return;
  status = next;
  // 保存は React の状態更新の中（描画中）から呼ばれるため、別コンポーネントを描画中に更新して
  // 警告にならないよう、通知は描画が終わってから行う
  queueMicrotask(() => listeners.forEach((l) => l()));
}

/** 保存に成功したことを報告する。usedChars は保存後の使用量（文字数） */
export function reportSaveSuccess(usedChars: number): void {
  const ratio = usedChars / STORAGE_LIMIT_CHARS;
  update({
    saveFailed: false,
    reason: null,
    nearLimit: ratio >= STORAGE_WARN_RATIO,
    usagePercent: Math.min(100, Math.round(ratio * 100)),
  });
}

/** 保存に失敗したことを報告する。容量の情報は直前の値を保つ */
export function reportSaveFailure(error: unknown): void {
  update({ ...status, saveFailed: true, reason: classifyStorageError(error) });
}

/** テスト用：状態を初期値に戻す */
export function resetStorageStatus(): void {
  status = INITIAL;
}

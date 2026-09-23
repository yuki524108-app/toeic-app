/**
 * 復習リマインド機能。
 *
 * このアプリはバックエンドを持たないフロントエンドのみの構成（要件定義書4節）のため、
 * アプリを閉じている間に届く「本当のプッシュ通知」は実現できない。
 * その代わりに、アプリを開いたタイミングで「今日まだ通知していない」かつ
 * 「復習すべき問題が残っている」場合にブラウザのNotification APIで
 * その場で通知を表示する、という軽量な方式を採用する。
 */

const ENABLED_KEY = "toeic-app:reminder-enabled";
const LAST_NOTIFIED_KEY = "toeic-app:reminder-last-notified";

export function isReminderSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isReminderEnabled(): boolean {
  if (!isReminderSupported()) return false;
  return (
    localStorage.getItem(ENABLED_KEY) === "1" &&
    Notification.permission === "granted"
  );
}

/** 通知の許可をリクエストし、許可されればリマインドを有効化する */
export async function enableReminder(): Promise<boolean> {
  if (!isReminderSupported()) return false;
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission === "granted") {
    localStorage.setItem(ENABLED_KEY, "1");
    return true;
  }
  return false;
}

export function disableReminder(): void {
  localStorage.setItem(ENABLED_KEY, "0");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * アプリ起動時に呼び出す。有効化済み・通知許可あり・本日まだ通知していない・
 * 復習すべき問題が1問以上ある、の4条件を満たす場合のみ通知を1回表示する。
 */
export function maybeShowDueReminder(dueCount: number): void {
  if (!isReminderEnabled()) return;
  if (dueCount <= 0) return;

  const today = todayIso();
  if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) return;

  try {
    new Notification("TOEIC学習アプリ", {
      body: `本日復習すべき問題が${dueCount}問あります。開いて学習を続けましょう。`,
      icon: "/favicon.svg",
      tag: "toeic-app-daily-reminder",
    });
    localStorage.setItem(LAST_NOTIFIED_KEY, today);
  } catch {
    // 一部のブラウザ・環境ではNotificationの生成に失敗することがあるが、
    // リマインドはあくまで補助機能なので黙って無視する。
  }
}

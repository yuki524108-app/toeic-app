/**
 * アプリの新しい版が用意できたことを、画面（UpdateNotice）に伝える小さなストア。
 *
 * Service Worker は、新しい版を取得しても、利用者が「更新する」を押すまでは適用せず待機する
 * （学習中・模試の受験中に、開いている画面の読み込み先が差し替わらないようにするため）。
 * 登録は src/main.tsx で行い、ここへ「新しい版がある」ことと「適用する処理」を渡す。
 */

type Applier = () => void | Promise<void>;

let available = false;
let applier: Applier | null = null;
const listeners = new Set<() => void>();

export function isUpdateAvailable(): boolean {
  return available;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 新しい版が用意できたときに呼ぶ。apply は、新しい版に切り替えて画面を再読み込みする処理 */
export function markUpdateAvailable(apply: Applier): void {
  applier = apply;
  available = true;
  queueMicrotask(() => listeners.forEach((l) => l()));
}

/**
 * 新しい版に切り替える（画面が再読み込みされる）。
 * 切り替えに失敗しても、未処理のエラーにせず記録する（案内は残るので、もう一度押せる）。
 */
export function applyUpdate(): void {
  const report = (error: unknown) => console.error("アプリの更新に失敗しました", error);
  try {
    // 更新の処理は、ボタンを押した時点でそのまま呼ぶ（同期）。失敗は、例外でも reject でも受け止める
    Promise.resolve(applier?.()).catch(report);
  } catch (error) {
    report(error);
  }
}

/** テスト用：状態を初期値に戻す */
export function resetUpdateState(): void {
  available = false;
  applier = null;
}

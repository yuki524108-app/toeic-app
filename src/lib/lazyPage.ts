import { lazy } from "react";
import type { ComponentType } from "react";

/**
 * 画面を、開いたときに読み込む（コード分割）ための `React.lazy` の包み。
 * 読み込みに失敗したときは、1度だけ自動でやり直す（電波が一瞬途切れた場合や、
 * 新しい版に切り替わった直後で古い読み込み先が見つからない場合に備える）。
 * それでも失敗したら、そのままエラーにして、エラー画面（ErrorBoundary）に任せる。
 */
// 画面ごとにプロパティの型が異なるため、ここでは具体的な型を決めない
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>
) {
  return lazy(() => load().catch(() => load()));
}

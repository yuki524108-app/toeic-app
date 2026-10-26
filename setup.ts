// テストはすべて日本時間（Asia/Tokyo）で実行する。
// 日付キー（学習ログ・復習日・連続学習日数など）は端末のローカル日付で扱うため、
// 実行する環境のタイムゾーンによって結果が変わらないようにする。
// （アプリ側の tsconfig には Node の型を入れていないため、globalThis 経由で環境変数を設定する）
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = "Asia/Tokyo";

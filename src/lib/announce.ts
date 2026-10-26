/**
 * スクリーンリーダー向けの読み上げ通知。
 * アプリに1つだけ常設した読み上げ領域（`Announcer`）へメッセージを送る。
 * 解説のように「後から画面に挿入される」内容は、挿入と同時に読み上げられないことがあるため、
 * 常に存在する領域の内容を書き換える方式にしている。
 */
type Listener = (message: string) => void;

let listener: Listener | null = null;

/** 読み上げ領域へメッセージを送る（領域がなければ何もしない） */
export function announce(message: string): void {
  listener?.(message);
}

/** 読み上げ領域の登録（`Announcer` が使う）。解除用の関数を返す */
export function subscribeAnnouncer(l: Listener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

/** 解答後の通知文。色だけに頼らず「正解／不正解」と正解の選択肢、解説を伝える */
export function verdictMessage(
  correct: boolean,
  answerText: string | null,
  explanation: string | null
): string {
  const head = correct ? "正解です。" : `不正解です。${answerText ? `正解は ${answerText}。` : ""}`;
  return explanation ? `${head}解説。${explanation.replace(/\s+/g, " ").trim()}` : head;
}

/** 「B. postponed」のような、正解の選択肢の表示文 */
export function answerLabel(choices: readonly string[], answer: number): string {
  return `${String.fromCharCode(65 + answer)}. ${choices[answer]}`;
}

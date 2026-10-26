import { useState } from "react";
import type { AnswerConfidence, Word } from "../../types";
import { checkSpelling, hasSharedMeaning, spellingPattern } from "../../lib/wordQuiz";
import type { SpellResult } from "../../lib/wordQuiz";
import { Announce } from "../Announce";
import { MissReasonPicker } from "../MissReasonPicker";
import { WordDetail } from "./WordDetail";

/**
 * 単語のスペル入力（日本語の意味を見て、英単語を打ち込む）。最も強い想起の練習。
 * - 文字数の手がかりは最初から表示する。「ヒントを見る」で最初の文字を表示する（ヒントを使った正解は、翌日にもう一度出す）
 * - 同じ意味の別の単語がある単語（achieve / accomplish など）は、最初の文字を最初から示す（この場合は不利にしない）
 * - 大文字小文字・アクセント記号（résumé）は区別しない。1文字違い・隣り合う文字の入れ替えは「惜しい」として不正解にする
 */
export function WordSpellCard({
  word,
  pool,
  onRecord,
  onNext,
}: {
  word: Word;
  pool: Word[];
  onRecord: (correct: boolean, confidence: AnswerConfidence) => void;
  onNext: () => void;
}) {
  const [shared] = useState(() => hasSharedMeaning(word, pool));
  const [hintShown, setHintShown] = useState(shared);
  const [hintUsed, setHintUsed] = useState(false);   // 自分で「ヒントを見る」を押したか
  const [input, setInput] = useState("");
  const [result, setResult] = useState<SpellResult | "gaveUp" | null>(null);

  function submit() {
    if (result || input.trim() === "") return;
    const r = checkSpelling(input, word.word);
    setResult(r);
    onRecord(r === "correct", r === "correct" && hintUsed ? "unsure" : "sure");
  }

  function giveUp() {
    if (result) return;
    setResult("gaveUp");
    onRecord(false, "sure");
  }

  const correct = result === "correct";
  const message =
    result === "correct"
      ? hintUsed
        ? "正解です（ヒントを使ったので、明日もう一度出します）"
        : "正解です"
      : result === "near"
        ? `惜しい！ 1文字の違いです（入力：${input.trim()}）`
        : result === "gaveUp"
          ? "正解を確認しましょう"
          : "不正解です";

  return (
    <div className="mt-6">
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 text-center">
        <p className="text-2xl font-medium text-(--color-ink)">{word.meaning}</p>
        {word.pos && <p className="mt-1 text-xs text-(--color-muted)">[{word.pos}]</p>}
        <p
          className="mt-4 font-mono text-lg tracking-widest text-(--color-ink-soft)"
          aria-label={`${Array.from(word.word).filter((c) => /[\p{L}\p{N}]/u.test(c)).length}文字`}
        >
          {spellingPattern(word.word)}
        </p>
        {hintShown && (
          <p className="mt-2 text-xs text-(--color-muted)">
            最初の文字：<span className="font-medium text-(--color-ink)">{Array.from(word.word)[0]}</span>
            {shared && "（同じ意味の別の単語があるため、最初から表示しています）"}
          </p>
        )}
      </div>

      {!result && (
        <div className="mt-4">
          <label htmlFor="spell-input" className="text-xs text-(--color-muted)">
            英単語を入力
          </label>
          <input
            id="spell-input"
            type="text"
            lang="en"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
            }}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-3 text-lg text-(--color-ink)"
          />
          <button
            onClick={submit}
            disabled={input.trim() === ""}
            className="mt-3 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper) disabled:opacity-40"
          >
            確認する
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setHintShown(true);
                setHintUsed(true);
              }}
              disabled={hintShown}
              className="rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-muted) disabled:opacity-40"
            >
              ヒントを見る
            </button>
            <button
              onClick={giveUp}
              className="rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-muted)"
            >
              わからない
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          role="region"
          aria-label="解説"
          className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4"
        >
          <Announce
            message={`${message}。${correct ? "" : `正解は ${word.word}。`}${word.meaning}`}
          />
          <p className={`text-sm font-medium ${correct ? "text-(--color-correct)" : "text-(--color-incorrect)"}`}>
            {message}
          </p>
          {!correct && <MissReasonPicker itemId={word.id} />}
          <WordDetail word={word} />
          <button
            onClick={onNext}
            className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

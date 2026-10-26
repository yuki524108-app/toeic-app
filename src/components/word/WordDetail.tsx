import type { Word } from "../../types";

/** 解答後に見せる、単語の意味・例文・補足 */
export function WordDetail({ word }: { word: Word }) {
  return (
    <div className="mt-3 border-t border-(--color-line) pt-3">
      <p className="font-(family-name:--font-display) text-xl font-medium text-(--color-ink)">
        {word.word}
      </p>
      <p className="mt-1 text-base text-(--color-ink-soft)">
        {word.pos && <span className="mr-2 text-xs text-(--color-muted)">[{word.pos}]</span>}
        {word.meaning}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-(--color-muted)">{word.example}</p>
      {word.exampleJa && (
        <p className="mt-1 text-sm leading-relaxed text-(--color-ink-soft)">{word.exampleJa}</p>
      )}
      {word.note && (
        <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-(--color-muted)">
          {word.note}
        </p>
      )}
    </div>
  );
}

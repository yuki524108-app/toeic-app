import type { ReactNode } from "react";

const LABELS = ["A", "B", "C", "D"];

/** 設問の和訳・選択肢の和訳・詳細解説（データがあるときだけ表示） */
export function QuestionDetail({
  questionJa,
  choices,
  choicesJa,
  answer,
  detail,
}: {
  questionJa?: string;
  choices: readonly string[];
  choicesJa?: string[];
  answer: number;
  detail?: string;
}) {
  if (!questionJa && !choicesJa && !detail) return null;
  return (
    <div className="mt-3 border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
      {questionJa && <p>{questionJa}</p>}
      {choicesJa && choicesJa.length === choices.length && (
        <ul className="mt-2 space-y-1 text-xs">
          {choicesJa.map((ja, i) => (
            <li
              key={i}
              className={i === answer ? "font-medium text-(--color-correct)" : "text-(--color-muted)"}
            >
              ({LABELS[i]}) {choices[i]} … {ja}
            </li>
          ))}
        </ul>
      )}
      {detail && <p className="mt-3 whitespace-pre-line">{detail}</p>}
    </div>
  );
}

/** 全訳・重要語句を折りたたみ表示（データがあるときだけ表示） */
export function PassageDetail({
  texts,
  vocab,
  children,
}: {
  texts: { label?: string; ja?: string | string[] }[];
  vocab?: string[];
  children?: ReactNode;
}) {
  const hasText = texts.some((t) => t.ja && t.ja.length > 0);
  if (!hasText && !(vocab && vocab.length > 0)) return null;
  return (
    <details className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
      <summary className="cursor-pointer text-sm font-medium text-(--color-ink)">
        全訳・重要語句
      </summary>
      {texts.map(
        (t, i) =>
          t.ja &&
          t.ja.length > 0 && (
            <div key={i} className="mt-3">
              {t.label && <p className="text-xs font-medium text-(--color-muted)">{t.label}</p>}
              {Array.isArray(t.ja) ? (
                <div className="mt-1 space-y-1 text-sm leading-relaxed text-(--color-ink-soft)">
                  {t.ja.map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
                  {t.ja}
                </p>
              )}
            </div>
          )
      )}
      {vocab && vocab.length > 0 && (
        <div className="mt-4 border-t border-(--color-line) pt-3">
          <p className="text-xs font-medium text-(--color-muted)">重要語句</p>
          <ul className="mt-1 space-y-0.5 text-sm text-(--color-ink-soft)">
            {vocab.map((v, i) => (
              <li key={i}>・{v}</li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </details>
  );
}

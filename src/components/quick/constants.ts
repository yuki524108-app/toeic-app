import type { QuickAnswerRecord } from "../../lib/quickSession";

export const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

/**
 * 1問解答するごとにカードから親へ渡す情報。親が進捗の記録と結果の集計を行う。
 * 中断／再開で保存する解答の記録（`QuickAnswerRecord`）と同じ形。
 */
export type QuizAnswer = QuickAnswerRecord;

/** すべてのカードが受け取る共通のプロパティ */
export type QuickCardProps = {
  bookmarks: string[];
  onToggleBookmark: (itemId: string) => void;
  /** セッション最後の出題単位か（最後のボタン表記を「結果を見る」にする） */
  isLast: boolean;
  /** 1問解答するたびに呼ぶ（セット型では設問ごとに複数回呼ばれる） */
  onAnswer: (answer: QuizAnswer) => void;
  /** この出題単位を終えて次へ進む */
  onNext: () => void;
};

export function choiceStyle(
  selected: number | null | undefined,
  index: number,
  answer: number
): string {
  if (selected === null || selected === undefined) {
    return "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
  }
  if (index === answer) {
    return "border-(--color-correct) bg-(--color-correct-soft) text-(--color-correct)";
  }
  if (index === selected) {
    return "border-(--color-incorrect) bg-(--color-incorrect-soft) text-(--color-incorrect)";
  }
  return "border-(--color-line) bg-(--color-paper-raised) text-(--color-muted)";
}

/**
 * 複数の設問を持つセット（Part 3・4、Part 6、Part 7）の、最初の未解答の設問の位置。
 * restored は再開時に復元した解答（設問ID → 選んだ選択肢）。すべて解答済みなら -1。
 */
export function firstUnansweredQuestion(
  questionIds: string[],
  restored: Record<string, number>
): number {
  return questionIds.findIndex((id) => restored[id] === undefined);
}

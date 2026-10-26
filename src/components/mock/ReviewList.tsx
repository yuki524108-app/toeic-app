import type { MockTest as MockTestData } from "../../lib/mockTest";
import { readingStepIds, readingStepLabel } from "./readingStep";

export function ReviewList({
  test,
  answers,
  flagged,
  onJump,
}: {
  test: MockTestData;
  answers: Record<string, number>;
  flagged: Record<number, boolean>;
  onJump: (index: number) => void;
}) {
  const unanswered: { index: number; label: string }[] = [];
  const flaggedList: { index: number; label: string }[] = [];
  test.readingSteps.forEach((step, i) => {
    const ids = readingStepIds(step);
    const label = readingStepLabel(step);
    if (!ids.every((id) => answers[id] !== undefined)) unanswered.push({ index: i, label });
    if (flagged[i]) flaggedList.push({ index: i, label });
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-(--color-muted)">
          未解答（{unanswered.length}問）
        </p>
        {unanswered.length === 0 ? (
          <p className="mt-1 text-xs text-(--color-ink-soft)">すべて解答済みです</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unanswered.map(({ index, label }) => (
              <button
                key={index}
                onClick={() => onJump(index)}
                className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) px-2 py-1 text-xs text-(--color-incorrect)"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-(--color-muted)">
          見直しマーク（{flaggedList.length}問）
        </p>
        {flaggedList.length === 0 ? (
          <p className="mt-1 text-xs text-(--color-ink-soft)">マークはありません</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {flaggedList.map(({ index, label }) => (
              <button
                key={index}
                onClick={() => onJump(index)}
                className="rounded-sm border border-(--color-gold) bg-(--color-gold-soft) px-2 py-1 text-xs text-(--color-ink)"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import grammarQuestions from "../data/grammar.json";
import type { AppData, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { filterByMode, parseStudyMode, modeLabel, emptyMessage } from "../lib/studyQueue";
import { estimateAbilityLevel, recommendItems } from "../lib/recommendation";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";

export default function GrammarStudy({
  data,
  onAnswer,
  onToggleBookmark,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
  onToggleBookmark: (itemId: string) => void;
}) {
  const [searchParams] = useSearchParams();
  const mode = parseStudyMode(searchParams.get("mode"));

  const queue = useMemo(() => {
    if (mode === "recommended") {
      const ability = estimateAbilityLevel(data.progress);
      if (ability.status !== "ok") return [];
      return recommendItems(grammarQuestions, data, ability.targetLevel);
    }
    return filterByMode(grammarQuestions, data, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const current = queue[index];
  const isDone = index >= queue.length;
  const isBookmarked = current ? data.bookmarks.includes(current.id) : false;

  function handleSelect(choiceIndex: number) {
    if (selected !== null || !current) return;
    setSelected(choiceIndex);
    const correct = choiceIndex === current.answer;
    const record = updateProgress(
      current.id,
      "grammar",
      current.level,
      correct,
      data.progress[current.id]
    );
    onAnswer(record);
    if (correct) setSessionCorrect((c) => c + 1);
  }

  function handleNext() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={queue.length} label="文法" />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <span className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ Q{index + 1} / {queue.length}
        </span>
      </div>

      <div className="relative mt-6">
        <button
          onClick={() => onToggleBookmark(current.id)}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>
        <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 pr-12">
          <p className="text-lg leading-relaxed text-(--color-ink)">
            {current.question}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {current.choices.map((choice, i) => {
          const isCorrectChoice = i === current.answer;
          const isSelected = i === selected;
          let style =
            "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          if (selected !== null) {
            if (isCorrectChoice) {
              style =
                "border-(--color-correct) bg-(--color-correct-soft) text-(--color-correct)";
            } else if (isSelected) {
              style =
                "border-(--color-incorrect) bg-(--color-incorrect-soft) text-(--color-incorrect)";
            } else {
              style = "border-(--color-line) bg-(--color-paper-raised) text-(--color-muted)";
            }
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selected !== null}
              className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <p className="text-sm leading-relaxed text-(--color-ink-soft)">
            {current.explanation}
          </p>
          <button
            onClick={handleNext}
            className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            次の問題へ
          </button>
        </div>
      )}
    </div>
  );
}

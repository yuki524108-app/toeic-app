import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import part6Data from "../data/part6.json";
import type { AppData, Part6Passage, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import {
  filterPassagesByMode,
  parseStudyMode,
  modeLabel,
  emptyMessage,
} from "../lib/studyQueue";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";

// filterPassagesByMode は questions フィールドを期待するため、blanks を questions として扱うラッパー
type PassageWithQuestions = Part6Passage & {
  questions: Part6Passage["blanks"];
};

const passages = (part6Data as Part6Passage[]).map((p) => ({
  ...p,
  questions: p.blanks,
})) as PassageWithQuestions[];

export default function Part6Study({
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

  const queue = useMemo(
    () => filterPassagesByMode(passages, data, mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  const [passageIndex, setPassageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const currentPassage = queue[passageIndex];
  const isDone = passageIndex >= queue.length;

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={sessionTotal} label="Part 6" />;
  }

  const allAnswered = currentPassage.blanks.every(
    (b) => answers[b.id] !== undefined
  );

  function handleSelect(blankId: string, choiceIndex: number) {
    if (answers[blankId] !== undefined) return;
    const blank = currentPassage.blanks.find((b) => b.id === blankId)!;
    const correct = choiceIndex === blank.answer;
    const record = updateProgress(
      blank.id,
      "part6",
      blank.level,
      correct,
      data.progress[blank.id]
    );
    onAnswer(record);
    setAnswers((prev) => ({ ...prev, [blankId]: choiceIndex }));
    setSessionTotal((t) => t + 1);
    if (correct) setSessionCorrect((c) => c + 1);
  }

  function handleNextPassage() {
    setAnswers({});
    setPassageIndex((i) => i + 1);
  }

  // 空欄を (1) (2) (3) (4) として表示するための分割
  const passageParts = currentPassage.passage.split(/(\(\d\))/);

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <span className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ {passageIndex + 1} / {queue.length}
        </span>
      </div>

      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-xs font-medium text-(--color-muted)">
          {currentPassage.title}
        </p>
        <div className="mt-3 whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passageParts.map((part, i) =>
            /^\(\d\)$/.test(part) ? (
              <span
                key={i}
                className="mx-0.5 rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 font-medium text-(--color-ink)"
              >
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {currentPassage.blanks.map((blank, bi) => {
          const selected = answers[blank.id];
          const isBookmarked = data.bookmarks.includes(blank.id);
          return (
            <div
              key={blank.id}
              className="relative rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4"
            >
              <button
                onClick={() => onToggleBookmark(blank.id)}
                aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
                className="absolute right-3 top-3 z-10 p-1"
              >
                <BookmarkIcon filled={isBookmarked} />
              </button>
              <p className="pr-6 text-sm font-medium text-(--color-ink)">
                空欄 ({bi + 1})
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {blank.choices.map((choice, i) => {
                  const isCorrectChoice = i === blank.answer;
                  const isSelected = i === selected;
                  let style =
                    "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
                  if (selected !== undefined) {
                    if (isCorrectChoice) {
                      style =
                        "border-(--color-correct) bg-(--color-correct-soft) text-(--color-correct)";
                    } else if (isSelected) {
                      style =
                        "border-(--color-incorrect) bg-(--color-incorrect-soft) text-(--color-incorrect)";
                    } else {
                      style =
                        "border-(--color-line) bg-(--color-paper-raised) text-(--color-muted)";
                    }
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(blank.id, i)}
                      disabled={selected !== undefined}
                      className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${style}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {selected !== undefined && (
                <p className="mt-3 border-t border-(--color-line) pt-2 text-xs leading-relaxed text-(--color-muted)">
                  {blank.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && (
        <button
          onClick={handleNextPassage}
          className="mt-5 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
        >
          次のパッセージへ
        </button>
      )}
    </div>
  );
}

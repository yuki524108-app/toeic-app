import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import readings from "../data/readings.json";
import type { AppData, ProgressRecord, ReadingPassage } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import {
  filterPassagesByMode,
  parseStudyMode,
  modeLabel,
  emptyMessage,
} from "../lib/studyQueue";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";

const passages = readings as ReadingPassage[];

export default function ReadingStudy({
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

  // パッセージ単位でモードに応じてフィルタ（内包するいずれかの設問が条件を満たせば対象）
  const queue = useMemo(
    () => filterPassagesByMode(passages, data, mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  const [passageIndex, setPassageIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const currentPassage = queue[passageIndex];
  const isDone = passageIndex >= queue.length;

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={sessionTotal} label="リーディング" />;
  }

  const currentQuestion = currentPassage.questions[questionIndex];
  const isBookmarked = data.bookmarks.includes(currentQuestion.id);

  function handleSelect(choiceIndex: number) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    const correct = choiceIndex === currentQuestion.answer;
    const record = updateProgress(
      currentQuestion.id,
      "reading",
      currentQuestion.level,
      correct,
      data.progress[currentQuestion.id]
    );
    onAnswer(record);
    setSessionTotal((t) => t + 1);
    if (correct) setSessionCorrect((c) => c + 1);
  }

  function handleNext() {
    setSelected(null);
    if (questionIndex + 1 < currentPassage.questions.length) {
      setQuestionIndex((i) => i + 1);
    } else {
      setQuestionIndex(0);
      setPassageIndex((i) => i + 1);
    }
  }

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
        {(currentPassage.type === "double" || currentPassage.type === "triple") && (
          <span className="mb-2 inline-block rounded-sm bg-(--color-paper) px-2 py-0.5 text-[10px] font-medium text-(--color-muted)">
            {currentPassage.type === "triple" ? "3つの文書" : "2つの文書"}
          </span>
        )}
        <p className="text-xs font-medium text-(--color-muted)">
          {currentPassage.title}
        </p>
        <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {currentPassage.passage}
        </div>
        {(currentPassage.type === "double" || currentPassage.type === "triple") &&
          currentPassage.passage2 && (
            <>
              <p className="mt-4 text-xs font-medium text-(--color-muted)">
                {currentPassage.title2}
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
                {currentPassage.passage2}
              </div>
            </>
          )}
        {currentPassage.type === "triple" && currentPassage.passage3 && (
          <>
            <p className="mt-4 text-xs font-medium text-(--color-muted)">
              {currentPassage.title3}
            </p>
            <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
              {currentPassage.passage3}
            </div>
          </>
        )}
      </div>

      <div className="relative mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <button
          onClick={() => onToggleBookmark(currentQuestion.id)}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>

        <p className="pr-8 text-base leading-relaxed text-(--color-ink)">
          {currentQuestion.question}
        </p>
        <div className="mt-4 space-y-2.5">
          {currentQuestion.choices.map((choice, i) => {
            const isCorrectChoice = i === currentQuestion.answer;
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
                style =
                  "border-(--color-line) bg-(--color-paper-raised) text-(--color-muted)";
              }
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
            <p className="text-sm leading-relaxed text-(--color-ink-soft)">
              {currentQuestion.explanation}
            </p>
            <button
              onClick={handleNext}
              className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

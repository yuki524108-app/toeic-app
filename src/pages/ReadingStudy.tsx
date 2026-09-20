import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import readings from "../data/readings.json";
import type { AppData, ProgressRecord, ReadingPassage } from "../types";
import { updateProgress, isDueToday } from "../lib/spacedRepetition";
import { EmptyState, DoneState } from "./WordStudy";

const passages = readings as ReadingPassage[];

export default function ReadingStudy({
  data,
  onAnswer,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
}) {
  // パッセージ単位で「今日出すべきか」を判定する（内包する設問のいずれかが due なら出題）
  const queue = useMemo(
    () =>
      passages.filter((p) =>
        p.questions.some((q) => isDueToday(data.progress[q.id]))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [passageIndex, setPassageIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const currentPassage = queue[passageIndex];
  const isDone = passageIndex >= queue.length;

  if (queue.length === 0) {
    return (
      <EmptyState message="今日出題するリーディング問題はありません。よく学習しました。" />
    );
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={sessionTotal} label="リーディング" />;
  }

  const currentQuestion = currentPassage.questions[questionIndex];

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
          パッセージ {passageIndex + 1} / {queue.length} ・ 設問{" "}
          {questionIndex + 1} / {currentPassage.questions.length}
        </span>
      </div>

      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-xs font-medium text-(--color-muted)">
          {currentPassage.title}
        </p>
        <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {currentPassage.passage}
        </div>
      </div>

      <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-base leading-relaxed text-(--color-ink)">
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

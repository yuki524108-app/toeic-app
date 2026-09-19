import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import words from "../data/words.json";
import type { AppData, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { filterByMode, parseStudyMode, modeLabel, emptyMessage } from "../lib/studyQueue";

export default function WordStudy({
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
    () => filterByMode(words, data, mode),
    [mode] // eslint-disable-line react-hooks/exhaustive-deps -- キュー確定後は途中でdata更新されても入れ替えない
  );

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const current = queue[index];
  const isDone = index >= queue.length;
  const isBookmarked = current ? data.bookmarks.includes(current.id) : false;

  function handleAnswer(knewIt: boolean) {
    if (!current) return;
    const record = updateProgress(
      current.id,
      "word",
      current.level,
      knewIt,
      data.progress[current.id]
    );
    onAnswer(record);
    if (knewIt) setSessionCorrect((c) => c + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={queue.length} label="単語" />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <span className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ {index + 1} / {queue.length}
        </span>
      </div>

      <div className="relative mt-8">
        <button
          onClick={() => onToggleBookmark(current.id)}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>

        <button
          onClick={() => setFlipped((f) => !f)}
          className="min-h-[280px] w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-8 text-left"
        >
          {!flipped ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <p className="font-(family-name:--font-display) text-4xl font-medium text-(--color-ink)">
                {current.word}
              </p>
              <p className="mt-6 text-xs text-(--color-muted)">
                タップして意味を表示
              </p>
            </div>
          ) : (
            <div>
              <p className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
                {current.word}
              </p>
              <p className="mt-3 text-lg text-(--color-ink-soft)">
                {current.meaning}
              </p>
              <div className="mt-5 border-t border-(--color-line) pt-4">
                <p className="text-sm leading-relaxed text-(--color-muted)">
                  {current.example}
                </p>
              </div>
            </div>
          )}
        </button>
      </div>

      {flipped && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAnswer(false)}
            className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) py-3.5 font-medium text-(--color-incorrect)"
          >
            わからない
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className="rounded-sm border border-(--color-correct) bg-(--color-correct-soft) py-3.5 font-medium text-(--color-correct)"
          >
            わかる
          </button>
        </div>
      )}
    </div>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "#C9932C" : "none"}
      stroke={filled ? "#C9932C" : "#8891AC"}
      strokeWidth="1.6"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-24 text-center">
      <p className="text-(--color-ink-soft)">{message}</p>
      <Link to="/" className="mt-6 text-sm font-medium text-(--color-gold)">
        ホームに戻る
      </Link>
    </div>
  );
}

export function DoneState({
  correct,
  total,
  label,
}: {
  correct: number;
  total: number;
  label: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-20 text-center">
      <p className="font-(family-name:--font-display) text-3xl font-medium text-(--color-ink)">
        お疲れさまでした
      </p>
      <p className="mt-3 text-(--color-ink-soft)">
        {label} {total}問中 {correct}問正解
      </p>
      <Link
        to="/"
        className="mt-8 rounded-sm bg-(--color-ink) px-6 py-3 text-sm font-medium text-(--color-paper)"
      >
        ホームに戻る
      </Link>
    </div>
  );
}

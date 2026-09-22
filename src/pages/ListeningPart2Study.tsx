import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import listeningPart2Questions from "../data/listeningPart2.json";
import type { AppData, ListeningPart2Question, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { filterByMode, parseStudyMode, modeLabel, emptyMessage } from "../lib/studyQueue";
import { isTTSSupported, speakSequence, stopSpeaking } from "../lib/tts";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";

const questions = listeningPart2Questions as ListeningPart2Question[];
const CHOICE_LABELS = ["A", "B", "C"] as const;
const RATES = [0.75, 1, 1.25] as const;

export default function ListeningPart2Study({
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
  const ttsSupported = isTTSSupported();

  const queue = useMemo(() => {
    return filterByMode(questions, data, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const stoppedRef = useRef({ current: false });

  const current = queue[index];
  const isDone = index >= queue.length;
  const isBookmarked = current ? data.bookmarks.includes(current.id) : false;

  // 問題が切り替わったら再生状態をリセットし、直前の音声を止める
  useEffect(() => {
    stopSpeaking();
    stoppedRef.current.current = true;
    setIsPlaying(false);
    setPlayingSegment(null);
    setHasPlayedOnce(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // ページ離脱時に音声を止める
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  async function handlePlay() {
    if (!current || isPlaying) return;
    stoppedRef.current.current = false;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await speakSequence([current.question, ...current.choices], rate, {
      pauseMs: 700,
      onSegmentStart: (i) => setPlayingSegment(i),
      stoppedRef: stoppedRef.current,
    });
    setIsPlaying(false);
    setPlayingSegment(null);
  }

  function handleStop() {
    stoppedRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingSegment(null);
  }

  function handleSelect(choiceIndex: number) {
    if (selected !== null || !current) return;
    handleStop();
    setSelected(choiceIndex);
    const correct = choiceIndex === current.answer;
    const record = updateProgress(
      current.id,
      "listeningPart2",
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
    return (
      <DoneState correct={sessionCorrect} total={queue.length} label="リスニング Part 2" />
    );
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

      {!ttsSupported && (
        <div className="mt-4 rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) p-3 text-xs leading-relaxed text-(--color-incorrect)">
          お使いのブラウザは音声読み上げ（Web Speech
          API）に対応していないため、代わりに問題文を表示しています。
        </div>
      )}

      <div className="relative mt-6">
        <button
          onClick={() => onToggleBookmark(current.id)}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>

        <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 pr-12">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            Part 2 ・ 応答問題
          </p>

          {ttsSupported ? (
            <div className="mt-5 flex flex-col items-center">
              <button
                onClick={isPlaying ? handleStop : handlePlay}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper) transition-colors active:opacity-80"
                aria-label={isPlaying ? "停止" : "再生する"}
              >
                {isPlaying ? <StopIcon /> : <PlayIcon />}
              </button>
              <p className="mt-3 text-xs text-(--color-muted)">
                {isPlaying
                  ? playingSegment === 0
                    ? "設問を再生中…"
                    : playingSegment !== null
                    ? `選択肢 ${CHOICE_LABELS[playingSegment - 1]} を再生中…`
                    : "再生中…"
                  : hasPlayedOnce
                  ? "もう一度再生する"
                  : "タップして再生"}
              </p>

              <div className="mt-4 flex gap-2">
                {RATES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRate(r)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      rate === r
                        ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                        : "border-(--color-line) text-(--color-muted)"
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2 text-sm leading-relaxed text-(--color-ink)">
              <p>{current.question}</p>
            </div>
          )}
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
              className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${style}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS[i]}
              </span>
              {(selected !== null || !ttsSupported) && (
                <span className="text-sm leading-relaxed">{choice}</span>
              )}
              {selected === null && ttsSupported && (
                <span className="text-sm text-(--color-muted)">選択肢 {CHOICE_LABELS[i]}</span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            設問（スクリプト）
          </p>
          <p className="mt-1 text-sm leading-relaxed text-(--color-ink)">
            {current.question}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-(--color-ink-soft)">
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

function PlayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.68-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

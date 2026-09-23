import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import listeningPart34Sets from "../data/listeningPart34.json";
import type { AppData, ListeningPart34Set, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import {
  filterPassagesByMode,
  parseStudyMode,
  modeLabel,
  emptyMessage,
} from "../lib/studyQueue";
import { isTTSSupported, speakScript, stopSpeaking } from "../lib/tts";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";

const sets = listeningPart34Sets as ListeningPart34Set[];
const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
const RATES = [0.75, 1, 1.25] as const;

export default function ListeningPart34Study({
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
    return filterPassagesByMode(sets, data, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const [setIndex, setSetIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const stoppedRef = useRef({ current: false });

  const currentSet = queue[setIndex];
  const isDone = setIndex >= queue.length;
  const currentQuestion = currentSet?.questions[questionIndex];
  const isLastQuestionOfSet =
    !!currentSet && questionIndex === currentSet.questions.length - 1;
  const isBookmarked = currentQuestion
    ? data.bookmarks.includes(currentQuestion.id)
    : false;

  // セットが切り替わったら再生状態をリセットし、直前の音声を止める
  useEffect(() => {
    stopSpeaking();
    stoppedRef.current.current = true;
    setIsPlaying(false);
    setPlayingLine(null);
    setHasPlayedOnce(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSet?.id]);

  // ページ離脱時に音声を止める
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  async function handlePlay() {
    if (!currentSet || isPlaying) return;
    stoppedRef.current.current = false;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await speakScript(currentSet.script, rate, {
      pauseMs: 400,
      onLineStart: (i) => setPlayingLine(i),
      stoppedRef: stoppedRef.current,
    });
    setIsPlaying(false);
    setPlayingLine(null);
  }

  function handleStop() {
    stoppedRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingLine(null);
  }

  function handleSelect(choiceIndex: number) {
    if (selected !== null || !currentQuestion) return;
    handleStop();
    setSelected(choiceIndex);
    const correct = choiceIndex === currentQuestion.answer;
    const record = updateProgress(
      currentQuestion.id,
      "listeningPart34",
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
    if (!isLastQuestionOfSet) {
      setQuestionIndex((i) => i + 1);
    } else {
      setQuestionIndex(0);
      setSetIndex((i) => i + 1);
    }
  }

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    const totalQuestions = queue.reduce((sum, s) => sum + s.questions.length, 0);
    return (
      <DoneState
        correct={sessionCorrect}
        total={sessionTotal || totalQuestions}
        label="リスニング Part 3・4"
      />
    );
  }

  const partLabel = currentSet.partType === "part3" ? "Part 3 ・ 会話問題" : "Part 4 ・ トーク問題";

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <span className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ {setIndex + 1} / {queue.length} セット ・ Q
          {questionIndex + 1}/{currentSet.questions.length}
        </span>
      </div>

      {!ttsSupported && (
        <div className="mt-4 rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) p-3 text-xs leading-relaxed text-(--color-incorrect)">
          お使いのブラウザは音声読み上げ（Web Speech
          API）に対応していないため、代わりに会話・トークのスクリプトを表示しています。
        </div>
      )}

      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            {partLabel}
          </p>
          <p className="text-xs text-(--color-muted)">{currentSet.title}</p>
        </div>

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
                ? playingLine !== null
                  ? `${currentSet.script[playingLine]?.speaker} の発言を再生中…`
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
          <div className="mt-4 space-y-2 border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
            {currentSet.script.map((l, i) => (
              <p key={i}>
                <span className="font-medium text-(--color-ink)">{l.speaker}: </span>
                {l.line}
              </p>
            ))}
          </div>
        )}
      </div>

      {currentQuestion && (
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
                  className={`flex w-full items-start gap-3 rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                    {CHOICE_LABELS[i]}
                  </span>
                  <span className="leading-relaxed">{choice}</span>
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
              <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                {currentQuestion.explanation}
              </p>

              {isLastQuestionOfSet && ttsSupported && (
                <div className="mt-4 border-t border-(--color-line) pt-3">
                  <p className="text-xs font-medium tracking-wide text-(--color-muted)">
                    音声スクリプト
                  </p>
                  <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-(--color-ink-soft)">
                    {currentSet.script.map((l, i) => (
                      <p key={i}>
                        <span className="font-medium text-(--color-ink)">
                          {l.speaker}:{" "}
                        </span>
                        {l.line}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleNext}
                className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
              >
                {isLastQuestionOfSet ? "次のセットへ" : "次の設問へ"}
              </button>
            </div>
          )}
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

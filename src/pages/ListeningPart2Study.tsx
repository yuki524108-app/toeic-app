import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import listeningPart2Questions from "../data/listeningPart2.json";
import type { AppData, ListeningPart2Question, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { filterByMode, parseStudyMode, modeLabel, emptyMessage } from "../lib/studyQueue";
import { isTTSSupported, speakSequence } from "../lib/tts";
import { useAudioPlayer } from "../lib/useAudioPlayer";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";
import { AudioControls } from "../components/AudioControls";
import { Announce } from "../components/Announce";
import { answerLabel, verdictMessage } from "../lib/announce";
import { FocusLabel } from "../components/FocusLabel";
import { MissReasonPicker } from "../components/MissReasonPicker";
import { BridgePanel } from "../components/BridgePanel";
import { ShadowingPanel } from "../components/ShadowingPanel";

const questions = listeningPart2Questions as ListeningPart2Question[];
const CHOICE_LABELS = ["A", "B", "C"] as const;

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
  const player = useAudioPlayer();
  const { reset, stop: handleStop } = player;

  const current = queue[index];
  const isDone = index >= queue.length;
  const isBookmarked = current ? data.bookmarks.includes(current.id) : false;

  // 問題が切り替わったら再生状態をリセットし、直前の音声を止める（離脱時の停止は useAudioPlayer が行う）
  useEffect(() => {
    reset();
  }, [current?.id, reset]);

  function handlePlay() {
    if (!current) return;
    player.play(({ rate: playRate, stoppedRef, onIndex }) =>
      speakSequence([current.question, ...current.choices], playRate, {
        pauseMs: 700,
        onSegmentStart: onIndex,
        stoppedRef,
      })
    );
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
        <FocusLabel changeKey={index} className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ Q{index + 1} / {queue.length}
        </FocusLabel>
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
            <AudioControls
 player={player}
 idleLabel="タップして再生"
 playingLabel={(i) => i === 0 ? "設問を再生中…" : i !== null ? `選択肢 ${CHOICE_LABELS[i - 1]} を再生中…` : null}
 onPlay={handlePlay}
 />
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
        <div role="region" aria-label="解説" className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <Announce
            message={verdictMessage(
              selected === current.answer,
              answerLabel(current.choices, current.answer),
              current.explanation
            )}
          />
          {selected !== current.answer && <MissReasonPicker itemId={current.id} />}
          {selected !== current.answer && (
            <BridgePanel kind="listeningPart2" itemId={current.id} record={data.progress[current.id]} />
          )}
          <ShadowingPanel
            lines={[
              { speaker: "Question", text: current.question },
              { speaker: "Answer", text: current.choices[current.answer] },
            ]}
          />
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            設問（スクリプト）
          </p>
          <p className="mt-1 text-sm leading-relaxed text-(--color-ink)">
            {current.question}
          </p>
          <p className="whitespace-pre-line mt-4 text-sm leading-relaxed text-(--color-ink-soft)">
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

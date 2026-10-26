import { useEffect, useMemo, useState } from "react";
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
import { isTTSSupported, speakScript } from "../lib/tts";
import { useAudioPlayer } from "../lib/useAudioPlayer";
import { EmptyState, DoneState, BookmarkIcon } from "./WordStudy";
import { QuestionDetail, PassageDetail } from "../components/StudyDetail";
import { AudioControls } from "../components/AudioControls";
import { Announce } from "../components/Announce";
import { answerLabel, verdictMessage } from "../lib/announce";
import { FocusLabel } from "../components/FocusLabel";
import { MissReasonPicker } from "../components/MissReasonPicker";
import { BridgePanel } from "../components/BridgePanel";
import { ShadowingPanel } from "../components/ShadowingPanel";

const sets = listeningPart34Sets as ListeningPart34Set[];
const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

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
  const player = useAudioPlayer();
  const { reset, stop: handleStop } = player;

  const currentSet = queue[setIndex];
  const isDone = setIndex >= queue.length;
  const currentQuestion = currentSet?.questions[questionIndex];
  const isLastQuestionOfSet =
    !!currentSet && questionIndex === currentSet.questions.length - 1;
  const isBookmarked = currentQuestion
    ? data.bookmarks.includes(currentQuestion.id)
    : false;

  // セットが切り替わったら再生状態をリセットし、直前の音声を止める（離脱時の停止は useAudioPlayer が行う）
  useEffect(() => {
    reset();
  }, [currentSet?.id, reset]);

  function handlePlay() {
    if (!currentSet) return;
    player.play(({ rate: playRate, stoppedRef, onIndex }) =>
      speakScript(currentSet.script, playRate, {
        pauseMs: 400,
        onLineStart: onIndex,
        stoppedRef,
      })
    );
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
        <FocusLabel changeKey={setIndex} className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ {setIndex + 1} / {queue.length} セット ・ Q
          {questionIndex + 1}/{currentSet.questions.length}
        </FocusLabel>
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
          <AudioControls
 player={player}
 idleLabel="タップして再生"
 playingLabel={(i) => i !== null ? `${currentSet.script[i]?.speaker} の発言を再生中…` : null}
 onPlay={handlePlay}
 />
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
            <div role="region" aria-label="解説" className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
              <Announce
                message={verdictMessage(
                  selected === currentQuestion.answer,
                  answerLabel(currentQuestion.choices, currentQuestion.answer),
                  currentQuestion.explanation
                )}
              />
              {selected !== currentQuestion.answer && <MissReasonPicker itemId={currentQuestion.id} />}
              {selected !== currentQuestion.answer && (
                <BridgePanel kind="listeningPart34" itemId={currentQuestion.id} record={data.progress[currentQuestion.id]} />
              )}
              <ShadowingPanel
                lines={currentSet.script.map((l, i) => ({ speaker: l.speaker, text: l.line, ja: currentSet.scriptJa?.[i] }))}
              />
              <p className="whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
                {currentQuestion.explanation}
              </p>
              <QuestionDetail
                questionJa={currentQuestion.questionJa}
                choices={currentQuestion.choices}
                choicesJa={currentQuestion.choicesJa}
                answer={currentQuestion.answer}
                detail={currentQuestion.explanationDetail}
              />
              {isLastQuestionOfSet && (
                <PassageDetail
                  texts={[{ label: "スクリプトの和訳", ja: currentSet.scriptJa }]}
                  vocab={currentSet.vocab}
                />
              )}

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

import { useState } from "react";
import type {
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
} from "../../types";
import { isTTSSupported, speakScript, speakSequence, stopSpeaking } from "../../lib/tts";
import { AudioControls } from "../AudioControls";
import { BookmarkToggle, NextButton, TtsNotice } from "./shared";
import { CHOICE_LABELS, choiceStyle, firstUnansweredQuestion } from "./constants";
import type { QuickCardProps } from "./constants";
import { useAudioPlayer } from "../../lib/useAudioPlayer";
import { Announce } from "../Announce";
import { answerLabel, verdictMessage } from "../../lib/announce";
import { MissReasonPicker } from "../MissReasonPicker";

/** Part 1（写真描写）：写真（SVG）を見て、音声で流れる4つの英文から最も適切なものを選ぶ */
export function Part1Card({
  question,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { question: ListeningPart1Item }) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(i: number) {
    if (selected !== null) return;
    player.stop();
    setSelected(i);
    onAnswer({
      id: question.id,
      level: question.level,
      correct: i === question.answer,
      title: "写真描写問題",
      answer: `${CHOICE_LABELS[question.answer]}. ${question.choices[question.answer]}`,
      selected: i,
    });
  }

  return (
    <>
      {!ttsSupported && <TtsNotice what="4つの英文をすべて" />}

      <div className="relative mt-6">
        <BookmarkToggle
          id={question.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
          className="absolute right-3 top-3 z-10 rounded-full bg-(--color-paper-raised) p-1.5 shadow-sm"
        />
        <div className="overflow-hidden rounded-sm border border-(--color-line) bg-(--color-paper-raised)">
          <p className="px-4 pt-4 text-xs font-medium tracking-wide text-(--color-muted)">
            Part 1 ・ 写真描写問題
          </p>
          <div
            className="mt-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: question.image }}
          />
        </div>
      </div>

      {ttsSupported && (
        <AudioControls
          player={player}
          idleLabel="タップして4つの英文を再生"
          playingLabel={(i) => (i !== null ? `選択肢 ${CHOICE_LABELS[i]} を再生中…` : null)}
          onPlay={() =>
            player.play(({ rate, stoppedRef, onIndex }) =>
              speakSequence(question.choices, rate, {
                pauseMs: 700,
                onSegmentStart: onIndex,
                stoppedRef,
              })
            )
          }
        />
      )}

      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={selected !== null}
            className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${choiceStyle(
              selected,
              i,
              question.answer
            )}`}
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
              {CHOICE_LABELS[i]}
            </span>
            <span
              className={`text-sm leading-relaxed ${
                selected === null && ttsSupported ? "text-(--color-muted)" : ""
              }`}
            >
              {selected !== null || !ttsSupported ? choice : `選択肢 ${CHOICE_LABELS[i]}`}
            </span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <div role="region" aria-label="解説" className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <Announce
            message={verdictMessage(
              selected === question.answer,
              answerLabel(question.choices, question.answer),
              question.explanation
            )}
          />
          {selected !== question.answer && <MissReasonPicker itemId={question.id} />}
          <p className="whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
            {question.explanation}
          </p>
          <NextButton onClick={onNext}>{isLast ? "結果を見る" : "次の問題へ"}</NextButton>
        </div>
      )}
    </>
  );
}

/** Part 2（応答問題）：設問と選択肢A〜Cを音声のみで流し、解答後にスクリプトを開示する */
export function Part2Card({
  question,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { question: ListeningPart2Question }) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(i: number) {
    if (selected !== null) return;
    player.stop();
    setSelected(i);
    onAnswer({
      id: question.id,
      level: question.level,
      correct: i === question.answer,
      title: `🎧 ${question.question}`,
      answer: `${CHOICE_LABELS[question.answer]}. ${question.choices[question.answer]}`,
      selected: i,
    });
  }

  return (
    <>
      {!ttsSupported && <TtsNotice what="問題文" />}

      <div className="relative mt-6">
        <BookmarkToggle
          id={question.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
        />
        <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 pr-12">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            リスニング Part 2 ・ 応答問題
          </p>
          {ttsSupported ? (
            <AudioControls
              player={player}
              idleLabel="タップして再生"
              playingLabel={(i) =>
                i === 0
                  ? "設問を再生中…"
                  : i !== null
                    ? `選択肢 ${CHOICE_LABELS[i - 1]} を再生中…`
                    : null
              }
              onPlay={() =>
                player.play(({ rate, stoppedRef, onIndex }) =>
                  speakSequence([question.question, ...question.choices], rate, {
                    pauseMs: 700,
                    onSegmentStart: onIndex,
                    stoppedRef,
                  })
                )
              }
            />
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-(--color-ink)">{question.question}</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={selected !== null}
            className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${choiceStyle(
              selected,
              i,
              question.answer
            )}`}
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
              {CHOICE_LABELS[i]}
            </span>
            <span
              className={`text-sm leading-relaxed ${
                selected === null && ttsSupported ? "text-(--color-muted)" : ""
              }`}
            >
              {selected !== null || !ttsSupported ? choice : `選択肢 ${CHOICE_LABELS[i]}`}
            </span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <div role="region" aria-label="解説" className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <Announce
            message={verdictMessage(
              selected === question.answer,
              answerLabel(question.choices, question.answer),
              question.explanation
            )}
          />
          {selected !== question.answer && <MissReasonPicker itemId={question.id} />}
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            設問（スクリプト）
          </p>
          <p className="mt-1 text-sm leading-relaxed text-(--color-ink)">{question.question}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
            {question.explanation}
          </p>
          <NextButton onClick={onNext}>{isLast ? "結果を見る" : "次の問題へ"}</NextButton>
        </div>
      )}
    </>
  );
}

/**
 * Part 3・4（会話・トーク）：1セット（通常3問）を丸ごと出題する。
 * 音声は設問ごとに聞き直せる。最後の設問の解答後にスクリプトを開示する。
 * 途中で中断したセットを再開するときは、解答済みの設問を飛ばして最初の未解答の設問から続ける
 * （すべて解答済みの場合は最後の設問を解答済みの状態で表示する）。
 */
export function Part34Card({
  set,
  restored,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { set: ListeningPart34Set; restored: Record<string, number> }) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  const firstOpen = firstUnansweredQuestion(
    set.questions.map((x) => x.id),
    restored
  );
  const [qIndex, setQIndex] = useState(firstOpen === -1 ? set.questions.length - 1 : firstOpen);
  const [selected, setSelected] = useState<number | null>(
    firstOpen === -1 ? (restored[set.questions[set.questions.length - 1].id] ?? null) : null
  );

  const question = set.questions[qIndex];
  const isLastQuestion = qIndex === set.questions.length - 1;
  const partLabel = set.partType === "part3" ? "Part 3 ・ 会話問題" : "Part 4 ・ トーク問題";

  function handleSelect(i: number) {
    if (selected !== null) return;
    player.stop();
    setSelected(i);
    onAnswer({
      id: question.id,
      level: question.level,
      correct: i === question.answer,
      title: question.question,
      answer: question.choices[question.answer],
      selected: i,
    });
  }

  function handleNextQuestion() {
    if (isLastQuestion) {
      stopSpeaking();
      onNext();
    } else {
      setSelected(null);
      setQIndex((n) => n + 1);
    }
  }

  return (
    <>
      {!ttsSupported && <TtsNotice what="会話・トークのスクリプト" />}

      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">{partLabel}</p>
          <p className="text-xs text-(--color-muted)">{set.title}</p>
        </div>
        {ttsSupported ? (
          <AudioControls
            player={player}
            idleLabel="タップして再生"
            playingLabel={(i) =>
              i !== null ? `${set.script[i]?.speaker} の発言を再生中…` : null
            }
            onPlay={() =>
              player.play(({ rate, stoppedRef, onIndex }) =>
                speakScript(set.script, rate, {
                  pauseMs: 400,
                  onLineStart: onIndex,
                  stoppedRef,
                })
              )
            }
          />
        ) : (
          <div className="mt-4 space-y-2 border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
            {set.script.map((l, i) => (
              <p key={i}>
                <span className="font-medium text-(--color-ink)">{l.speaker}: </span>
                {l.line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <BookmarkToggle
          id={question.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
        />
        <p className="text-xs text-(--color-muted)">
          設問 {qIndex + 1} / {set.questions.length}
        </p>
        <p className="mt-1 pr-8 text-base leading-relaxed text-(--color-ink)">
          {question.question}
        </p>
        <div className="mt-4 space-y-2.5">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={selected !== null}
              className={`flex w-full items-start gap-3 rounded-sm border px-4 py-3 text-left text-sm transition-colors ${choiceStyle(
                selected,
                i,
                question.answer
              )}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS[i]}
              </span>
              <span className="leading-relaxed">{choice}</span>
            </button>
          ))}
        </div>

        {selected !== null && (
          <div role="region" aria-label="解説" className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
            <Announce
              message={verdictMessage(
                selected === question.answer,
                answerLabel(question.choices, question.answer),
                question.explanation
              )}
            />
            {selected !== question.answer && <MissReasonPicker itemId={question.id} />}
            <p className="whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
              {question.explanation}
            </p>
            {isLastQuestion && ttsSupported && (
              <div className="mt-4 border-t border-(--color-line) pt-3">
                <p className="text-xs font-medium tracking-wide text-(--color-muted)">
                  音声スクリプト
                </p>
                <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-(--color-ink-soft)">
                  {set.script.map((l, i) => (
                    <p key={i}>
                      <span className="font-medium text-(--color-ink)">{l.speaker}: </span>
                      {l.line}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <NextButton onClick={handleNextQuestion}>
              {isLastQuestion ? (isLast ? "結果を見る" : "次へ") : "次の設問へ"}
            </NextButton>
          </div>
        )}
      </div>
    </>
  );
}

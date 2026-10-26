import type { ListeningPart1Item, ListeningPart2Question, ListeningPart34Set } from "../../types";
import { isTTSSupported, speakScript, speakSequence } from "../../lib/tts";
import { useAudioPlayer } from "../../lib/useAudioPlayer";
import { AudioControls } from "../AudioControls";

const CHOICE_LABELS4 = ["A", "B", "C", "D"] as const;
const CHOICE_LABELS3 = ["A", "B", "C"] as const;

export function ListeningPart1View({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: ListeningPart1Item;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  
  function handlePlay() {
    player.play(({ rate: playRate, stoppedRef, onIndex }) =>
      speakSequence(item.choices, playRate, {
        pauseMs: 700,
        onSegmentStart: onIndex,
        stoppedRef,
      })
    );
  }

  const revealed = selectedAnswer !== undefined || !ttsSupported;

  return (
    <>
      <div className="overflow-hidden rounded-sm border border-(--color-line) bg-(--color-paper-raised)">
        <p className="px-4 pt-4 text-xs font-medium tracking-wide text-(--color-muted)">
          Part 1 ・ 写真描写問題
        </p>
        <div
          className="mt-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: item.image }}
        />
      </div>

      {ttsSupported ? (
        <AudioControls player={player} idleLabel="タップして4つの英文を再生" playingLabel={(i) => i !== null ? `選択肢 ${CHOICE_LABELS4[i]} を再生中…` : null} onPlay={handlePlay} />
      ) : (
        <div className="mt-4 space-y-2 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4 text-sm leading-relaxed text-(--color-ink)">
          {item.choices.map((c, i) => (
            <p key={i}>
              <span className="font-medium">{CHOICE_LABELS4[i]}.</span> {c}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {item.choices.map((choice, i) => {
          const isSelected = i === selectedAnswer;
          const style = isSelected
            ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
            : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${style}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS4[i]}
              </span>
              {revealed ? (
                <span className="text-sm leading-relaxed">{choice}</span>
              ) : (
                <span className="text-sm text-(--color-muted)">
                  選択肢 {CHOICE_LABELS4[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function ListeningPart2View({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: ListeningPart2Question;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  
  function handlePlay() {
    player.play(({ rate: playRate, stoppedRef, onIndex }) =>
      speakSequence([item.question, ...item.choices], playRate, {
        pauseMs: 700,
        onSegmentStart: onIndex,
        stoppedRef,
      })
    );
  }

  const revealed = selectedAnswer !== undefined || !ttsSupported;

  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 2 ・ 応答問題
        </p>
        {ttsSupported ? (
          <AudioControls player={player} idleLabel="タップして再生" playingLabel={(i) => i === 0 ? "設問を再生中…" : i !== null ? `選択肢 ${CHOICE_LABELS3[i - 1]} を再生中…` : null} onPlay={handlePlay} />
        ) : (
          <div className="mt-4 text-sm leading-relaxed text-(--color-ink)">
            <p>{item.question}</p>
          </div>
        )}
      </div>
      <div className="mt-5 space-y-2.5">
        {item.choices.map((choice, i) => {
          const isSelected = i === selectedAnswer;
          const style = isSelected
            ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
            : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${style}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS3[i]}
              </span>
              {revealed ? (
                <span className="text-sm leading-relaxed">{choice}</span>
              ) : (
                <span className="text-sm text-(--color-muted)">
                  選択肢 {CHOICE_LABELS3[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function ListeningPart34View({
  set,
  question,
  selectedAnswer,
  onSelect,
}: {
  set: ListeningPart34Set;
  question: ListeningPart34Set["questions"][number];
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const player = useAudioPlayer();
  
  function handlePlay() {
    player.play(({ rate: playRate, stoppedRef, onIndex }) =>
      speakScript(set.script, playRate, {
        pauseMs: 400,
        onLineStart: onIndex,
        stoppedRef,
      })
    );
  }

  const partLabel = set.partType === "part3" ? "Part 3 ・ 会話問題" : "Part 4 ・ トーク問題";

  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            {partLabel}
          </p>
          <p className="text-xs text-(--color-muted)">{set.title}</p>
        </div>

        {ttsSupported ? (
          <AudioControls player={player} idleLabel="タップして再生" playingLabel={(i) => i !== null ? `${set.script[i]?.speaker} の発言を再生中…` : null} onPlay={handlePlay} />
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

      <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-base leading-relaxed text-(--color-ink)">{question.question}</p>
        <div className="mt-4 space-y-2.5">
          {question.choices.map((choice, i) => {
            const isSelected = i === selectedAnswer;
            const style = isSelected
              ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
              : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={`flex w-full items-start gap-3 rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                  {CHOICE_LABELS4[i]}
                </span>
                <span className="leading-relaxed">{choice}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

import { useState } from "react";
import type { AnswerConfidence, Word } from "../../types";
import { buildMeaningChoices } from "../../lib/wordQuiz";
import { answerLabel, verdictMessage } from "../../lib/announce";
import { Announce } from "../Announce";
import { MissReasonPicker } from "../MissReasonPicker";
import { choiceStyle } from "../quick/constants";
import { WordDetail } from "./WordDetail";

/**
 * 単語の4択（英単語を見て、意味を選ぶ）。
 * 間違えたときは、選んだ時点で記録する。正解のときは、あてずっぽうで当たった場合に「あてずっぽうだった」を
 * 押せるように、「次へ」または「あてずっぽうだった」を押した時点で記録する（あてずっぽうの正解は、翌日にもう一度出す）。
 */
export function WordChoiceCard({
  word,
  pool,
  onRecord,
  onNext,
}: {
  word: Word;
  pool: Word[];
  onRecord: (correct: boolean, confidence: AnswerConfidence) => void;
  onNext: () => void;
}) {
  const [{ choices, answer }] = useState(() => buildMeaningChoices(word, pool));
  const [selected, setSelected] = useState<number | null>(null);
  const [recorded, setRecorded] = useState(false);

  function pick(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i !== answer) {
      onRecord(false, "sure");
      setRecorded(true);
    }
  }

  function finish(confidence: AnswerConfidence) {
    if (!recorded) onRecord(true, confidence);
    setRecorded(true);
    onNext();
  }

  const correct = selected === answer;

  return (
    <div className="mt-6">
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 text-center">
        <p className="font-(family-name:--font-display) text-4xl font-medium text-(--color-ink)">
          {word.word}
        </p>
        <p className="mt-3 text-xs text-(--color-muted)">
          {word.pos && `[${word.pos}] `}意味を選んでください
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            disabled={selected !== null}
            className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition-colors ${choiceStyle(selected, i, answer)}`}
          >
            <span className="mr-2 font-medium">{String.fromCharCode(65 + i)}.</span>
            {c}
          </button>
        ))}
      </div>

      {selected !== null && (
        <div
          role="region"
          aria-label="解説"
          className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4"
        >
          <Announce
            message={verdictMessage(correct, answerLabel(choices, answer), `${word.word}。${word.meaning}`)}
          />
          <p className={`text-sm font-medium ${correct ? "text-(--color-correct)" : "text-(--color-incorrect)"}`}>
            {correct ? "正解です" : "不正解です"}
          </p>
          {!correct && <MissReasonPicker itemId={word.id} />}
          <WordDetail word={word} />
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => finish("sure")}
              className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
            >
              次へ
            </button>
            {correct && !recorded && (
              <button
                onClick={() => finish("unsure")}
                className="rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-muted)"
              >
                あてずっぽうだった（明日もう一度出す）
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

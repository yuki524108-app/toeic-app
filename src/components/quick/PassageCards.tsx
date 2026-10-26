import { useState } from "react";
import type { Part6Passage, ReadingPassage } from "../../types";
import { BookmarkToggle, NextButton } from "./shared";
import { CHOICE_LABELS, choiceStyle, firstUnansweredQuestion } from "./constants";
import type { QuickCardProps } from "./constants";
import { Announce } from "../Announce";
import { answerLabel, verdictMessage } from "../../lib/announce";
import { MissReasonPicker } from "../MissReasonPicker";

/**
 * Part 6（長文穴埋め）：1文書の空欄(1)〜(4)を丸ごと出題する。空欄は好きな順に解答できる。
 * 途中で中断した文書を再開するときは、解答済みの空欄を解答済みの状態で表示し、残りの空欄から続ける。
 */
export function Part6Card({
  passage,
  restored,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { passage: Part6Passage; restored: Record<string, number> }) {
  const [answers, setAnswers] = useState<Record<string, number>>(restored);
  const allAnswered = passage.blanks.every((b) => answers[b.id] !== undefined);

  function handleSelect(blankIndex: number, choiceIndex: number) {
    const blank = passage.blanks[blankIndex];
    if (answers[blank.id] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [blank.id]: choiceIndex }));
    onAnswer({
      id: blank.id,
      level: blank.level,
      correct: choiceIndex === blank.answer,
      title: `${passage.title} 空欄(${blankIndex + 1})`,
      answer: blank.choices[blank.answer],
      selected: choiceIndex,
    });
  }

  // 空欄を (1) (2) (3) (4) として強調表示するための分割
  const parts = passage.passage.split(/(\(\d\))/);

  return (
    <>
      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-xs font-medium text-(--color-muted)">Part 6 ・ {passage.title}</p>
        <div className="mt-3 whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {parts.map((part, i) =>
            /^\(\d\)$/.test(part) ? (
              <span
                key={i}
                className="mx-0.5 rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 font-medium text-(--color-ink)"
              >
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {passage.blanks.map((blank, bi) => {
          const selected = answers[blank.id];
          return (
            <div
              key={blank.id}
              className="relative rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4"
            >
              <BookmarkToggle
                id={blank.id}
                bookmarks={bookmarks}
                onToggleBookmark={onToggleBookmark}
                className="absolute right-3 top-3 z-10 p-1"
              />
              <p className="pr-6 text-sm font-medium text-(--color-ink)">空欄 ({bi + 1})</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {blank.choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(bi, i)}
                    disabled={selected !== undefined}
                    className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${choiceStyle(
                      selected,
                      i,
                      blank.answer
                    )}`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {selected !== undefined && (
                <div role="region" aria-label="解説">
                  <Announce
                    message={`空欄 (${bi + 1})。${verdictMessage(
                      selected === blank.answer,
                      answerLabel(blank.choices, blank.answer),
                      blank.explanation
                    )}`}
                  />
                  {selected !== blank.answer && <MissReasonPicker itemId={blank.id} />}
                  <p className="mt-3 whitespace-pre-line border-t border-(--color-line) pt-2 text-xs leading-relaxed text-(--color-muted)">
                    {blank.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && <NextButton onClick={onNext}>{isLast ? "結果を見る" : "次へ"}</NextButton>}
    </>
  );
}

/**
 * Part 7（読解）：1文書の設問を順に出題する（すきま時間モードでは1つの文書のみの問題を対象とする）。
 * 本文は設問に答える間も画面上部に表示し続ける。
 * 途中で中断した文書を再開するときは、解答済みの設問を飛ばして最初の未解答の設問から続ける
 * （すべて解答済みの場合は最後の設問を解答済みの状態で表示する）。
 */
export function ReadingCard({
  passage,
  restored,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { passage: ReadingPassage; restored: Record<string, number> }) {
  const firstOpen = firstUnansweredQuestion(
    passage.questions.map((x) => x.id),
    restored
  );
  const [qIndex, setQIndex] = useState(
    firstOpen === -1 ? passage.questions.length - 1 : firstOpen
  );
  const [selected, setSelected] = useState<number | null>(
    firstOpen === -1
      ? (restored[passage.questions[passage.questions.length - 1].id] ?? null)
      : null
  );

  const question = passage.questions[qIndex];
  const isLastQuestion = qIndex === passage.questions.length - 1;

  function handleSelect(i: number) {
    if (selected !== null) return;
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
      onNext();
    } else {
      setSelected(null);
      setQIndex((n) => n + 1);
    }
  }

  return (
    <>
      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-xs font-medium text-(--color-muted)">Part 7 ・ {passage.title}</p>
        <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passage.passage}
        </div>
      </div>

      <div className="relative mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <BookmarkToggle
          id={question.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
        />
        <p className="text-xs text-(--color-muted)">
          設問 {qIndex + 1} / {passage.questions.length}
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
              aria-label={`${CHOICE_LABELS[i]}. ${choice}`}
              className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition-colors ${choiceStyle(
                selected,
                i,
                question.answer
              )}`}
            >
              {choice}
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
            <NextButton onClick={handleNextQuestion}>
              {isLastQuestion ? (isLast ? "結果を見る" : "次へ") : "次の設問へ"}
            </NextButton>
          </div>
        )}
      </div>
    </>
  );
}

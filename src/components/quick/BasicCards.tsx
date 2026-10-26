import { useState } from "react";
import type { GrammarQuestion, Word } from "../../types";
import { BookmarkToggle, NextButton } from "./shared";
import { choiceStyle } from "./constants";
import type { QuickCardProps } from "./constants";
import { Announce } from "../Announce";
import { answerLabel, verdictMessage } from "../../lib/announce";
import { MissReasonPicker } from "../MissReasonPicker";

/** 単語：フラッシュカード（タップで意味を表示→「わかる／わからない」） */
export function WordCard({
  word,
  bookmarks,
  onToggleBookmark,
  onAnswer,
  onNext,
}: QuickCardProps & { word: Word }) {
  const [flipped, setFlipped] = useState(false);

  function answer(knewIt: boolean, confidence?: "unsure") {
    onAnswer({
      id: word.id,
      level: word.level,
      correct: knewIt,
      title: word.word,
      answer: word.meaning,
      selected: knewIt ? 1 : 0,
      ...(confidence ? { confidence } : {}),
    });
    onNext();
  }

  return (
    <>
      <div className="relative mt-8">
        <BookmarkToggle
          id={word.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
        />
        <button
          onClick={() => setFlipped((f) => !f)}
          className="min-h-[240px] w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-8 text-left"
        >
          {!flipped ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
              <p className="font-(family-name:--font-display) text-4xl font-medium text-(--color-ink)">
                {word.word}
              </p>
              <p className="mt-6 text-xs text-(--color-muted)">タップして意味を表示</p>
            </div>
          ) : (
            <div>
              <p className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
                {word.word}
              </p>
              <p className="mt-3 text-lg text-(--color-ink-soft)">{word.meaning}</p>
              <div className="mt-5 border-t border-(--color-line) pt-4">
                <p className="text-sm leading-relaxed text-(--color-muted)">{word.example}</p>
              </div>
            </div>
          )}
        </button>
      </div>

      {flipped && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button
            onClick={() => answer(false)}
            className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) py-3.5 text-sm font-medium text-(--color-incorrect)"
          >
            わからない
          </button>
          <button
            onClick={() => answer(true, "unsure")}
            className="rounded-sm border border-(--color-gold) bg-(--color-gold-soft) py-3.5 text-sm font-medium text-(--color-ink)"
          >
            うろ覚え
          </button>
          <button
            onClick={() => answer(true)}
            className="rounded-sm border border-(--color-correct) bg-(--color-correct-soft) py-3.5 text-sm font-medium text-(--color-correct)"
          >
            わかる
          </button>
        </div>
      )}
    </>
  );
}

/** 文法（Part 5）：4択。選択後に正誤と解説を表示 */
export function GrammarCard({
  question,
  bookmarks,
  onToggleBookmark,
  isLast,
  onAnswer,
  onNext,
}: QuickCardProps & { question: GrammarQuestion }) {
  const [selected, setSelected] = useState<number | null>(null);

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

  return (
    <>
      <div className="relative mt-6">
        <BookmarkToggle
          id={question.id}
          bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark}
        />
        <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 pr-12">
          <p className="text-lg leading-relaxed text-(--color-ink)">{question.question}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={selected !== null}
            className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${choiceStyle(
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

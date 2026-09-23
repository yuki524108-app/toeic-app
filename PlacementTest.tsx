import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import type { AppData, GrammarQuestion, ProgressRecord, Word } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { estimateScore } from "../lib/scoreEstimate";

const WORD_SAMPLE_SIZE = 15;
const GRAMMAR_SAMPLE_SIZE = 15;

type TestItem =
  | { kind: "word"; data: Word }
  | { kind: "grammar"; data: GrammarQuestion };

/** レベル帯を満遍なくカバーするように、レベル順に並べて等間隔で抜き出す */
function pickSpread<T extends { level: number }>(items: T[], count: number): T[] {
  const sorted = [...items].sort((a, b) => a.level - b.level);
  if (sorted.length <= count) return sorted;
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (count - 1));
    picked.push(sorted[idx]);
  }
  return picked;
}

function buildTestItems(): TestItem[] {
  const wordSample = pickSpread(words, WORD_SAMPLE_SIZE).map(
    (w): TestItem => ({ kind: "word", data: w })
  );
  const grammarSample = pickSpread(grammarQuestions, GRAMMAR_SAMPLE_SIZE).map(
    (g): TestItem => ({ kind: "grammar", data: g })
  );
  // 単語と文法を交互に並べて飽きさせない
  const merged: TestItem[] = [];
  const max = Math.max(wordSample.length, grammarSample.length);
  for (let i = 0; i < max; i++) {
    if (wordSample[i]) merged.push(wordSample[i]);
    if (grammarSample[i]) merged.push(grammarSample[i]);
  }
  return merged;
}

export default function PlacementTest({
  data,
  onAnswer,
  onComplete,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
  onComplete: () => void;
}) {
  const testItems = useMemo(() => buildTestItems(), []);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const current = testItems[index];
  const isDone = index >= testItems.length;

  useEffect(() => {
    if (isDone && !data.placementTestCompletedAt) {
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

  function answerWord(knewIt: boolean, word: Word) {
    const record = updateProgress(
      word.id,
      "word",
      word.level,
      knewIt,
      data.progress[word.id]
    );
    onAnswer(record);
    if (knewIt) setCorrectCount((c) => c + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function answerGrammar(choiceIndex: number, q: GrammarQuestion) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    const correct = choiceIndex === q.answer;
    const record = updateProgress(
      q.id,
      "grammar",
      q.level,
      correct,
      data.progress[q.id]
    );
    onAnswer(record);
    if (correct) setCorrectCount((c) => c + 1);
  }

  function nextAfterGrammar() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (isDone) {
    const estimate = estimateScore(data.progress);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-20 text-center">
        <p className="text-sm text-(--color-muted)">模試が完了しました</p>
        <p className="mt-2 font-(family-name:--font-display) text-3xl font-medium text-(--color-ink)">
          {correctCount} / {testItems.length} 問正解
        </p>

        {estimate.status === "ok" && (
          <div className="mt-6 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
            <p className="text-xs text-(--color-muted)">現時点の目安スコア</p>
            <p className="mt-1 font-(family-name:--font-display) text-4xl font-semibold text-(--color-gold)">
              {estimate.score}
              <span className="ml-1 text-sm font-normal text-(--color-muted)">
                / 495点
              </span>
            </p>
          </div>
        )}

        <p className="mt-6 text-sm leading-relaxed text-(--color-ink-soft)">
          これからは、今の実力に合わせた「おすすめ問題」で効率よく学習できます。
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

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-(--color-ink)">初回模試</p>
        <span className="text-xs text-(--color-muted)">
          {index + 1} / {testItems.length}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-(--color-line)">
        <div
          className="h-full bg-(--color-gold) transition-all"
          style={{ width: `${(index / testItems.length) * 100}%` }}
        />
      </div>

      {current.kind === "word" ? (
        <WordQuestion
          key={current.data.id}
          word={current.data}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          onAnswer={(knewIt) => answerWord(knewIt, current.data)}
        />
      ) : (
        <GrammarQuestionBlock
          key={current.data.id}
          question={current.data}
          selected={selected}
          onSelect={(i) => answerGrammar(i, current.data)}
          onNext={nextAfterGrammar}
        />
      )}
    </div>
  );
}

function WordQuestion({
  word,
  flipped,
  onFlip,
  onAnswer,
}: {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
  onAnswer: (knewIt: boolean) => void;
}) {
  return (
    <>
      <button
        onClick={onFlip}
        className="mt-8 min-h-[260px] w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-8 text-left"
      >
        {!flipped ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="font-(family-name:--font-display) text-4xl font-medium text-(--color-ink)">
              {word.word}
            </p>
            <p className="mt-6 text-xs text-(--color-muted)">
              タップして意味を表示
            </p>
          </div>
        ) : (
          <div>
            <p className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
              {word.word}
            </p>
            <p className="mt-3 text-lg text-(--color-ink-soft)">{word.meaning}</p>
          </div>
        )}
      </button>
      {flipped && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => onAnswer(false)}
            className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) py-3.5 font-medium text-(--color-incorrect)"
          >
            わからない
          </button>
          <button
            onClick={() => onAnswer(true)}
            className="rounded-sm border border-(--color-correct) bg-(--color-correct-soft) py-3.5 font-medium text-(--color-correct)"
          >
            わかる
          </button>
        </div>
      )}
    </>
  );
}

function GrammarQuestionBlock({
  question,
  selected,
  onSelect,
  onNext,
}: {
  question: GrammarQuestion;
  selected: number | null;
  onSelect: (choiceIndex: number) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="mt-8 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-lg leading-relaxed text-(--color-ink)">
          {question.question}
        </p>
      </div>
      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => {
          const isCorrectChoice = i === question.answer;
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
              onClick={() => onSelect(i)}
              disabled={selected !== null}
              className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <p className="text-sm leading-relaxed text-(--color-ink-soft)">
            {question.explanation}
          </p>
          <button
            onClick={onNext}
            className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            次の問題へ
          </button>
        </div>
      )}
    </>
  );
}

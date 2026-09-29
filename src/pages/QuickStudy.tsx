import { useState } from "react";
import { Link } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import type { AppData, GrammarQuestion, ProgressRecord, Word } from "../types";
import { updateProgress, isDueToday } from "../lib/spacedRepetition";
import { BookmarkIcon } from "./WordStudy";

const wordPool = words as Word[];
const grammarPool = grammarQuestions as GrammarQuestion[];

const COUNT_OPTIONS = [3, 5, 10] as const;

type QuickItem =
  | { kind: "word"; item: Word }
  | { kind: "grammar"; item: GrammarQuestion };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 単語・文法の両プールから、今日出題すべき項目（間隔反復で復習日を迎えているもの）を
 * 優先しつつ、足りない分はランダムに補って count 件のミニセッションを組み立てる。
 */
function buildQuickQueue(data: AppData, count: number): QuickItem[] {
  const dueWords = wordPool.filter((w) => isDueToday(data.progress[w.id]));
  const dueGrammar = grammarPool.filter((g) => isDueToday(data.progress[g.id]));
  const due: QuickItem[] = shuffle([
    ...dueWords.map((item) => ({ kind: "word" as const, item })),
    ...dueGrammar.map((item) => ({ kind: "grammar" as const, item })),
  ]);

  if (due.length >= count) return due.slice(0, count);

  const dueIds = new Set(due.map((q) => q.item.id));
  const rest: QuickItem[] = shuffle([
    ...wordPool
      .filter((w) => !dueIds.has(w.id))
      .map((item) => ({ kind: "word" as const, item })),
    ...grammarPool
      .filter((g) => !dueIds.has(g.id))
      .map((item) => ({ kind: "grammar" as const, item })),
  ]);

  return [...due, ...rest].slice(0, count);
}

export default function QuickStudy({
  data,
  onAnswer,
  onToggleBookmark,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
  onToggleBookmark: (itemId: string) => void;
}) {
  const [queue, setQueue] = useState<QuickItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  function handleStart(count: number) {
    setQueue(buildQuickQueue(data, count));
    setIndex(0);
    setSessionCorrect(0);
  }

  // ---------- セッション開始前：問題数の選択画面 ----------
  if (!queue) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          すきま時間モード
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
          単語と文法問題をランダムに混ぜて、短時間でサクッと復習できます。今日復習すべき問題があれば優先的に出題されます。
        </p>

        <div className="mt-6 space-y-3">
          {COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              onClick={() => handleStart(count)}
              className="flex w-full items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-5 py-4 text-left transition-colors active:bg-(--color-gold-soft)"
            >
              <span className="font-medium text-(--color-ink)">{count}問だけ</span>
              <span className="text-xs text-(--color-muted)">
                約{Math.max(1, Math.round(count * 0.5))}分
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = queue[index];
  const isDone = index >= queue.length;

  if (isDone) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-20 text-center">
        <p className="font-(family-name:--font-display) text-3xl font-medium text-(--color-ink)">
          お疲れさまでした
        </p>
        <p className="mt-3 text-(--color-ink-soft)">
          {queue.length}問中 {sessionCorrect}問正解
        </p>
        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            onClick={() => setQueue(null)}
            className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            もう一度やる
          </button>
          <Link
            to="/"
            className="rounded-sm border border-(--color-line) py-3 text-sm font-medium text-(--color-ink)"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <button onClick={() => setQueue(null)} className="text-sm text-(--color-muted)">
          やめる
        </button>
        <span className="text-xs text-(--color-muted)">
          すきま時間モード ・ {index + 1} / {queue.length}
        </span>
      </div>

      {current.kind === "word" ? (
        <QuickWordCard
          key={current.item.id}
          word={current.item}
          isBookmarked={data.bookmarks.includes(current.item.id)}
          onToggleBookmark={() => onToggleBookmark(current.item.id)}
          onAnswer={(knewIt) => {
            const record = updateProgress(
              current.item.id,
              "word",
              current.item.level,
              knewIt,
              data.progress[current.item.id]
            );
            onAnswer(record);
            if (knewIt) setSessionCorrect((c) => c + 1);
            setIndex((i) => i + 1);
          }}
        />
      ) : (
        <QuickGrammarCard
          key={current.item.id}
          question={current.item}
          isBookmarked={data.bookmarks.includes(current.item.id)}
          onToggleBookmark={() => onToggleBookmark(current.item.id)}
          onAnswered={(correct) => {
            const record = updateProgress(
              current.item.id,
              "grammar",
              current.item.level,
              correct,
              data.progress[current.item.id]
            );
            onAnswer(record);
            if (correct) setSessionCorrect((c) => c + 1);
          }}
          onNext={() => setIndex((i) => i + 1)}
        />
      )}
    </div>
  );
}

function QuickWordCard({
  word,
  isBookmarked,
  onToggleBookmark,
  onAnswer,
}: {
  word: Word;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onAnswer: (knewIt: boolean) => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <div className="relative mt-8">
        <button
          onClick={onToggleBookmark}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>

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

function QuickGrammarCard({
  question,
  isBookmarked,
  onToggleBookmark,
  onAnswered,
  onNext,
}: {
  question: GrammarQuestion;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(choiceIndex: number) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    onAnswered(choiceIndex === question.answer);
  }

  return (
    <>
      <div className="relative mt-6">
        <button
          onClick={onToggleBookmark}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>
        <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 pr-12">
          <p className="text-lg leading-relaxed text-(--color-ink)">{question.question}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {question.choices.map((choice, i) => {
          const isCorrectChoice = i === question.answer;
          const isSelected = i === selected;
          let style = "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
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
              className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
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

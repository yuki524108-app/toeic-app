import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import words from "../data/words.json";
import type { AnswerConfidence, AppData, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { filterByMode, parseStudyMode, modeLabel, emptyMessage } from "../lib/studyQueue";
import { estimateAbilityLevel, recommendItems } from "../lib/recommendation";
import { Announce } from "../components/Announce";
import { FocusLabel } from "../components/FocusLabel";
import { WordChoiceCard } from "../components/word/WordChoiceCard";
import { WordSpellCard } from "../components/word/WordSpellCard";
import { WORD_FORMATS, loadWordFormat, saveWordFormat } from "../lib/wordQuiz";
import type { WordFormat } from "../lib/wordQuiz";

export default function WordStudy({
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

  const queue = useMemo(() => {
    if (mode === "recommended") {
      const ability = estimateAbilityLevel(data.progress);
      if (ability.status !== "ok") return [];
      return recommendItems(words, data, ability.targetLevel);
    }
    return filterByMode(words, data, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- キュー確定後は途中でdata更新されても入れ替えない
  }, [mode]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [format, setFormat] = useState<WordFormat>(loadWordFormat);

  const current = queue[index];
  const isDone = index >= queue.length;
  const isBookmarked = current ? data.bookmarks.includes(current.id) : false;

  /** 解答を記録する。確信のない正解（うろ覚え・あてずっぽう・ヒントを使った）は、翌日にもう一度出す */
  function record(knewIt: boolean, confidence: AnswerConfidence = "sure") {
    if (!current) return;
    onAnswer(
      updateProgress(current.id, "word", current.level, knewIt, data.progress[current.id], confidence)
    );
    if (knewIt) setSessionCorrect((c) => c + 1);
  }

  function next() {
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  /** カード形式：自己判定の3段階 */
  function handleSelfRating(knewIt: boolean, confidence: AnswerConfidence = "sure") {
    record(knewIt, confidence);
    next();
  }

  function changeFormat(f: WordFormat) {
    setFormat(f);
    saveWordFormat(f);
    setFlipped(false);
  }

  if (queue.length === 0) {
    return <EmptyState message={emptyMessage[mode]} />;
  }

  if (isDone) {
    return <DoneState correct={sessionCorrect} total={queue.length} label="単語" />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <FocusLabel changeKey={index} className="text-xs text-(--color-muted)">
          {modeLabel[mode]} ・ {index + 1} / {queue.length}
        </FocusLabel>
      </div>

      <div role="group" aria-label="出題形式" className="mt-4 grid grid-cols-3 gap-2">
        {WORD_FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => changeFormat(f.id)}
            aria-pressed={format === f.id}
            className={`rounded-sm border px-2 py-2 text-center ${
              format === f.id
                ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                : "border-(--color-line) text-(--color-muted)"
            }`}
          >
            <span className="block text-sm font-medium">{f.label}</span>
            <span className="block text-[10px]">{f.hint}</span>
          </button>
        ))}
      </div>

      {format !== "card" && (
        <div className="relative">
          <div className="absolute right-2 top-2 z-10">
            <button
              onClick={() => onToggleBookmark(current.id)}
              aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
              className="p-1.5"
            >
              <BookmarkIcon filled={isBookmarked} />
            </button>
          </div>
          {format === "choice" ? (
            <WordChoiceCard
              key={`c-${current.id}`}
              word={current}
              pool={words}
              onRecord={record}
              onNext={next}
            />
          ) : (
            <WordSpellCard
              key={`s-${current.id}`}
              word={current}
              pool={words}
              onRecord={record}
              onNext={next}
            />
          )}
        </div>
      )}

      {format === "card" && (
      <div className="relative mt-8">
        <button
          onClick={() => onToggleBookmark(current.id)}
          aria-label={isBookmarked ? "ブックマークを外す" : "ブックマークする"}
          className="absolute right-3 top-3 z-10 p-1.5"
        >
          <BookmarkIcon filled={isBookmarked} />
        </button>

        <button
          onClick={() => setFlipped((f) => !f)}
          className="min-h-[280px] w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-8 text-left"
        >
          {!flipped ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <p className="font-(family-name:--font-display) text-4xl font-medium text-(--color-ink)">
                {current.word}
              </p>
              <p className="mt-6 text-xs text-(--color-muted)">
                タップして意味を表示
              </p>
            </div>
          ) : (
            <div>
              <Announce message={`${current.word}。${current.pos ? `${current.pos}。` : ""}${current.meaning}`} />
              <p className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
                {current.word}
              </p>
              <p className="mt-3 text-lg text-(--color-ink-soft)">
                {current.pos && (
                  <span className="mr-2 text-xs text-(--color-muted)">[{current.pos}]</span>
                )}
                {current.meaning}
              </p>
              <div className="mt-5 border-t border-(--color-line) pt-4">
                <p className="text-sm leading-relaxed text-(--color-muted)">
                  {current.example}
                </p>
                {current.exampleJa && (
                  <p className="mt-1 text-sm leading-relaxed text-(--color-ink-soft)">
                    {current.exampleJa}
                  </p>
                )}
                {current.note && (
                  <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-(--color-muted)">
                    {current.note}
                  </p>
                )}
              </div>
            </div>
          )}
        </button>
      </div>

      )}

      {format === "card" && flipped && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button
            onClick={() => handleSelfRating(false)}
            className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) py-3.5 text-sm font-medium text-(--color-incorrect)"
          >
            わからない
          </button>
          <button
            onClick={() => handleSelfRating(true, "unsure")}
            className="rounded-sm border border-(--color-gold) bg-(--color-gold-soft) py-3.5 text-sm font-medium text-(--color-ink)"
          >
            うろ覚え
          </button>
          <button
            onClick={() => handleSelfRating(true)}
            className="rounded-sm border border-(--color-correct) bg-(--color-correct-soft) py-3.5 text-sm font-medium text-(--color-correct)"
          >
            わかる
          </button>
        </div>
      )}
      {format === "card" && flipped && (
        <p className="mt-2 text-center text-[11px] text-(--color-muted)">
          「うろ覚え」は正解として数えますが、明日もう一度出します
        </p>
      )}
    </div>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "#C9932C" : "none"}
      stroke={filled ? "#C9932C" : "#8891AC"}
      strokeWidth="1.6"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-24 text-center">
      <p className="text-(--color-ink-soft)">{message}</p>
      <Link to="/" className="mt-6 text-sm font-medium text-(--color-gold)">
        ホームに戻る
      </Link>
    </div>
  );
}

export function DoneState({
  correct,
  total,
  label,
}: {
  correct: number;
  total: number;
  label: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-20 text-center">
      <p className="font-(family-name:--font-display) text-3xl font-medium text-(--color-ink)">
        お疲れさまでした
      </p>
      <p className="mt-3 text-(--color-ink-soft)">
        {label} {total}問中 {correct}問正解
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

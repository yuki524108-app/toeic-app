import { Link } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import type { AppData, StudyMode } from "../types";
import { filterByMode } from "../lib/studyQueue";

export default function Review({ data }: { data: AppData }) {
  const wordIncorrect = filterByMode(words, data, "incorrect").length;
  const wordBookmarked = filterByMode(words, data, "bookmarked").length;
  const grammarIncorrect = filterByMode(grammarQuestions, data, "incorrect").length;
  const grammarBookmarked = filterByMode(grammarQuestions, data, "bookmarked").length;

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        復習
      </h1>
      <p className="mt-2 text-sm text-(--color-muted)">
        今日出るかどうかに関係なく、好きな範囲を復習できます。
      </p>

      <ReviewSection
        title="単語"
        studyPath="/words"
        counts={{
          all: words.length,
          incorrect: wordIncorrect,
          bookmarked: wordBookmarked,
        }}
      />
      <ReviewSection
        title="文法問題"
        studyPath="/grammar"
        counts={{
          all: grammarQuestions.length,
          incorrect: grammarIncorrect,
          bookmarked: grammarBookmarked,
        }}
      />
    </div>
  );
}

function ReviewSection({
  title,
  studyPath,
  counts,
}: {
  title: string;
  studyPath: string;
  counts: Record<Exclude<StudyMode, "due">, number>;
}) {
  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-(--color-ink)">{title}</h2>
      <div className="mt-3 space-y-2.5">
        <ReviewRow
          label="間違えた問題を復習"
          count={counts.incorrect}
          disabled={counts.incorrect === 0}
          to={`${studyPath}?mode=incorrect`}
        />
        <ReviewRow
          label="ブックマークを復習"
          count={counts.bookmarked}
          disabled={counts.bookmarked === 0}
          to={`${studyPath}?mode=bookmarked`}
        />
        <ReviewRow
          label="すべて復習"
          count={counts.all}
          disabled={counts.all === 0}
          to={`${studyPath}?mode=all`}
        />
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  count,
  disabled,
  to,
}: {
  label: string;
  count: number;
  disabled: boolean;
  to: string;
}) {
  const content = (
    <div
      className={`flex items-center justify-between rounded-sm border p-4 ${
        disabled
          ? "border-(--color-line) bg-(--color-paper) opacity-50"
          : "border-(--color-line) bg-(--color-paper-raised) active:bg-(--color-gold-soft)"
      }`}
    >
      <span className="text-(--color-ink)">{label}</span>
      <span className="font-(family-name:--font-display) text-lg text-(--color-gold)">
        {count}
      </span>
    </div>
  );

  if (disabled) return content;
  return <Link to={to}>{content}</Link>;
}

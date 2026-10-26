import type { GrammarQuestion, Part6Passage, ReadingPassage } from "../../types";

export function GrammarView({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: GrammarQuestion;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 5 ・ 短文穴埋め問題
        </p>
        <p className="mt-3 text-lg leading-relaxed text-(--color-ink)">{item.question}</p>
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
              className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function Part6View({
  passage,
  answers,
  onSelect,
}: {
  passage: Part6Passage;
  answers: Record<string, number>;
  onSelect: (blankId: string, choice: number) => void;
}) {
  const passageParts = passage.passage.split(/(\(\d\))/);
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 6 ・ 長文穴埋め問題
        </p>
        <p className="mt-2 text-xs text-(--color-muted)">{passage.title}</p>
        <div className="mt-3 whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passageParts.map((part, i) =>
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
              className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4"
            >
              <p className="text-sm font-medium text-(--color-ink)">空欄 ({bi + 1})</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {blank.choices.map((choice, i) => {
                  const isSelected = i === selected;
                  const style = isSelected
                    ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                    : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
                  return (
                    <button
                      key={i}
                      onClick={() => onSelect(blank.id, i)}
                      className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${style}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function ReadingView({
  passage,
  question,
  selectedAnswer,
  onSelect,
}: {
  passage: ReadingPassage;
  question: ReadingPassage["questions"][number];
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        {(passage.type === "double" || passage.type === "triple") && (
          <span className="mb-2 inline-block rounded-sm bg-(--color-paper) px-2 py-0.5 text-[10px] font-medium text-(--color-muted)">
            {passage.type === "triple" ? "3つの文書" : "2つの文書"}
          </span>
        )}
        <p className="text-xs font-medium text-(--color-muted)">{passage.title}</p>
        <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passage.passage}
        </div>
        {(passage.type === "double" || passage.type === "triple") && passage.passage2 && (
          <>
            <p className="mt-4 text-xs font-medium text-(--color-muted)">{passage.title2}</p>
            <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
              {passage.passage2}
            </div>
          </>
        )}
        {passage.type === "triple" && passage.passage3 && (
          <>
            <p className="mt-4 text-xs font-medium text-(--color-muted)">{passage.title3}</p>
            <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
              {passage.passage3}
            </div>
          </>
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
                className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

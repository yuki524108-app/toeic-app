import { Link, useParams } from "react-router-dom";
import type { AppData, MockTestAnswerRecord } from "../types";
import { findReviewContent } from "../lib/mockReview";
import type { ReviewableContent } from "../lib/mockReview";

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;

export default function MockTestReview({ data }: { data: AppData }) {
  const { id } = useParams<{ id: string }>();
  const result = data.mockTestHistory.find((r) => r.id === id);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-24 text-center">
        <p className="text-(--color-ink-soft)">該当する受験履歴が見つかりませんでした。</p>
        <Link to="/mock-test" className="mt-6 text-sm font-medium text-(--color-gold)">
          模試モードに戻る
        </Link>
      </div>
    );
  }

  if (!result.answerRecords || result.answerRecords.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-24 text-center">
        <p className="text-(--color-ink-soft)">
          この受験にはレビューデータが保存されていません。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
          模試結果の復習機能は今回のアップデートから追加されたため、それより前に受験した回では表示できません。次回の受験から復習できます。
        </p>
        <Link to="/mock-test" className="mt-6 text-sm font-medium text-(--color-gold)">
          模試モードに戻る
        </Link>
      </div>
    );
  }

  const missed = result.answerRecords
    .filter((r) => r.selectedAnswer !== r.correctAnswer)
    .sort((a, b) => a.qNumber - b.qNumber);

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-8">
      <Link to="/mock-test" className="text-sm text-(--color-muted)">
        ← 模試モード
      </Link>
      <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        模試の復習
      </h1>
      <p className="mt-1 text-xs text-(--color-muted)">
        {new Date(result.completedAt).toLocaleString("ja-JP")} 受験 ・ スコア{" "}
        {result.totalScore}/990
      </p>

      {missed.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <p className="text-(--color-ink-soft)">
            全問正解でした。復習する問題はありません 🎉
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-(--color-ink-soft)">
            間違えた設問 {missed.length}問（未解答を含む）を、問題番号順に表示しています。
          </p>
          <div className="mt-5 space-y-6">
            {missed.map((record) => (
              <MissedQuestionCard key={record.id} record={record} />
            ))}
          </div>
        </>
      )}

      <Link
        to="/mock-test"
        className="mt-8 block rounded-sm bg-(--color-ink) py-3 text-center text-sm font-medium text-(--color-paper)"
      >
        模試モードに戻る
      </Link>
    </div>
  );
}

function MissedQuestionCard({ record }: { record: MockTestAnswerRecord }) {
  const content = findReviewContent(record.id, record.itemType);

  if (!content) {
    return (
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
        <p className="text-xs text-(--color-muted)">
          {record.partLabel} ・ Q{record.qNumber}
        </p>
        <p className="mt-2 text-sm text-(--color-muted)">
          問題データが見つかりませんでした（削除・更新された可能性があります）。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
      <p className="text-xs font-medium tracking-wide text-(--color-muted)">
        {record.partLabel} ・ Q{record.qNumber}
      </p>

      <PassageBlock content={content} />

      {content.image && (
        <div
          className="mt-3 overflow-hidden rounded-sm border border-(--color-line) [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: content.image }}
        />
      )}

      {content.script && (
        <div className="mt-3 space-y-1.5 rounded-sm border border-(--color-line) bg-(--color-paper) p-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {content.setTitle && (
            <p className="text-xs font-medium text-(--color-muted)">{content.setTitle}</p>
          )}
          {content.script.map((l, i) => (
            <p key={i}>
              <span className="font-medium text-(--color-ink)">{l.speaker}: </span>
              {l.line}
            </p>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed text-(--color-ink)">{content.prompt}</p>

      <div className="mt-3 space-y-2">
        {content.choices.map((choice, i) => {
          const isCorrect = i === content.correctAnswer;
          const isYourAnswer = i === record.selectedAnswer;
          let style =
            "border-(--color-line) bg-(--color-paper) text-(--color-ink-soft)";
          if (isCorrect) {
            style =
              "border-(--color-correct) bg-(--color-correct-soft) text-(--color-correct)";
          } else if (isYourAnswer) {
            style =
              "border-(--color-incorrect) bg-(--color-incorrect-soft) text-(--color-incorrect)";
          }
          return (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-sm border px-3 py-2 text-sm ${style}`}
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-current text-[11px] font-medium">
                {CHOICE_LABELS[i]}
              </span>
              <span className="leading-relaxed">{choice}</span>
              {isCorrect && (
                <span className="ml-auto flex-none text-[10px] font-medium">正解</span>
              )}
              {isYourAnswer && !isCorrect && (
                <span className="ml-auto flex-none text-[10px] font-medium">あなたの解答</span>
              )}
            </div>
          );
        })}
        {record.selectedAnswer === null && (
          <p className="text-xs text-(--color-muted)">（未解答でした）</p>
        )}
      </div>

      <div className="mt-3 rounded-sm border border-(--color-line) bg-(--color-paper) p-3">
        <p className="whitespace-pre-line text-xs leading-relaxed text-(--color-ink-soft)">
          {content.explanation}
        </p>
      </div>
    </div>
  );
}

function PassageBlock({ content }: { content: ReviewableContent }) {
  if (!content.passageText) return null;
  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-sm border border-(--color-line) bg-(--color-paper) p-3">
      {content.passageTitle && (
        <p className="text-xs font-medium text-(--color-muted)">{content.passageTitle}</p>
      )}
      <div className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-(--color-ink-soft)">
        {content.passageText}
      </div>
      {content.passageText2 && (
        <>
          {content.passageTitle2 && (
            <p className="mt-3 text-xs font-medium text-(--color-muted)">
              {content.passageTitle2}
            </p>
          )}
          <div className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-(--color-ink-soft)">
            {content.passageText2}
          </div>
        </>
      )}
      {content.passageText3 && (
        <>
          {content.passageTitle3 && (
            <p className="mt-3 text-xs font-medium text-(--color-muted)">
              {content.passageTitle3}
            </p>
          )}
          <div className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-(--color-ink-soft)">
            {content.passageText3}
          </div>
        </>
      )}
    </div>
  );
}

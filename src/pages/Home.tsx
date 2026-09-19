import { Link } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import type { AppData } from "../types";
import { isDueToday } from "../lib/spacedRepetition";
import { estimateScore } from "../lib/scoreEstimate";

export default function Home({ data }: { data: AppData }) {
  const wordsDue = words.filter((w) => isDueToday(data.progress[w.id])).length;
  const grammarDue = grammarQuestions.filter((g) =>
    isDueToday(data.progress[g.id])
  ).length;

  const estimate = estimateScore(data.progress);
  const today = new Date().toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-8">
      <p className="text-sm text-(--color-muted)">{today}</p>
      <h1 className="mt-1 font-(family-name:--font-display) text-[28px] font-medium leading-tight text-(--color-ink)">
        今日の学習を始めましょう
      </h1>

      {/* 予想スコア */}
      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs tracking-wide text-(--color-muted)">
            文法・語彙の目安スコア（参考値）
          </span>
          {data.streak > 0 && (
            <span className="text-xs font-medium text-(--color-gold)">
              🔥 {data.streak}日連続
            </span>
          )}
        </div>
        {estimate.status === "ok" ? (
          <div className="mt-2 flex items-end gap-2">
            <span className="font-(family-name:--font-display) text-5xl font-semibold text-(--color-ink)">
              {estimate.score}
            </span>
            <span className="mb-1 text-sm text-(--color-muted)">/ 495点</span>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-(--color-ink-soft)">
              まだ推定に必要なデータが足りません
            </p>
            <p className="mt-1 text-xs text-(--color-muted)">
              あと{estimate.needed - estimate.answeredCount}問解くとスコアの目安が表示されます
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
              <div
                className="h-full bg-(--color-gold)"
                style={{
                  width: `${Math.min(
                    100,
                    (estimate.answeredCount / estimate.needed) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 学習メニュー */}
      <div className="mt-8 space-y-3">
        <Link
          to="/words"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">単語学習</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {wordsDue > 0 ? `本日 ${wordsDue} 問` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {wordsDue}
          </span>
        </Link>

        <Link
          to="/grammar"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">文法問題</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {grammarDue > 0 ? `本日 ${grammarDue} 問` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {grammarDue}
          </span>
        </Link>
      </div>

      <Link
        to="/review"
        className="mt-6 flex items-center justify-between rounded-sm border border-dashed border-(--color-line) px-5 py-3.5 text-sm text-(--color-ink-soft)"
      >
        <span>間違えた問題・ブックマークを復習する</span>
        <span className="text-(--color-gold)">→</span>
      </Link>

      <p className="mt-8 text-center text-xs leading-relaxed text-(--color-muted)">
        予想スコアはあなたの正答率をもとにした簡易的な目安です。
        <br />
        公式のTOEICスコアを保証するものではありません。
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import readings from "../data/readings.json";
import part6Data from "../data/part6.json";
import listeningPart1Items from "../data/listeningPart1.json";
import listeningPart2Questions from "../data/listeningPart2.json";
import listeningPart34Sets from "../data/listeningPart34.json";
import type {
  AppData,
  ReadingPassage,
  Part6Passage,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
} from "../types";
import { isDueToday } from "../lib/spacedRepetition";
import { estimateScore } from "../lib/scoreEstimate";
import { estimateAbilityLevel } from "../lib/recommendation";
import {
  isReminderSupported,
  isReminderEnabled,
  enableReminder,
  disableReminder,
  maybeShowDueReminder,
} from "../lib/reminder";

const readingPassages = readings as ReadingPassage[];
const part6Passages = part6Data as Part6Passage[];
const listeningPart1 = listeningPart1Items as ListeningPart1Item[];
const listeningPart2 = listeningPart2Questions as ListeningPart2Question[];
const listeningPart34 = listeningPart34Sets as ListeningPart34Set[];

export default function Home({ data }: { data: AppData }) {
  const wordsDue = words.filter((w) => isDueToday(data.progress[w.id])).length;
  const grammarDue = grammarQuestions.filter((g) =>
    isDueToday(data.progress[g.id])
  ).length;
  const readingDue = readingPassages.filter((p) =>
    p.questions.some((q) => isDueToday(data.progress[q.id]))
  ).length;
  const part6Due = part6Passages.filter((p) =>
    p.blanks.some((b) => isDueToday(data.progress[b.id]))
  ).length;
  const listeningPart1Due = listeningPart1.filter((it) =>
    isDueToday(data.progress[it.id])
  ).length;
  const listeningPart2Due = listeningPart2.filter((q) =>
    isDueToday(data.progress[q.id])
  ).length;
  const listeningPart34Due = listeningPart34.filter((s) =>
    s.questions.some((q) => isDueToday(data.progress[q.id]))
  ).length;

  const estimate = estimateScore(data.progress);
  const ability = estimateAbilityLevel(data.progress);
  const hasTakenPlacementTest = data.placementTestCompletedAt !== null;

  const totalDue =
    wordsDue +
    grammarDue +
    readingDue +
    part6Due +
    listeningPart1Due +
    listeningPart2Due +
    listeningPart34Due;

  const [reminderOn, setReminderOn] = useState(false);
  useEffect(() => {
    setReminderOn(isReminderEnabled());
  }, []);
  useEffect(() => {
    maybeShowDueReminder(totalDue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleReminder() {
    if (reminderOn) {
      disableReminder();
      setReminderOn(false);
    } else {
      const ok = await enableReminder();
      setReminderOn(ok);
    }
  }

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

      {!hasTakenPlacementTest ? (
        /* 初回模試の案内 */
        <div className="mt-6 rounded-sm border border-(--color-gold) bg-(--color-gold-soft) p-5">
          <p className="text-xs font-medium tracking-wide text-(--color-ink)">
            まずは実力を測定しましょう
          </p>
          <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
            単語・文法あわせて30問の初回模試を受けると、今の実力に合った目安スコアと「おすすめ問題」が使えるようになります。
          </p>
          <Link
            to="/placement-test"
            className="mt-4 inline-block rounded-sm bg-(--color-ink) px-5 py-2.5 text-sm font-medium text-(--color-paper)"
          >
            初回模試を受ける（約10分）
          </Link>
        </div>
      ) : (
        /* 予想スコア */
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
      )}

      {/* おすすめ問題 */}
      {hasTakenPlacementTest && ability.status === "ok" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/words?mode=recommended"
            className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4 transition-colors active:bg-(--color-gold-soft)"
          >
            <p className="text-xs text-(--color-muted)">おすすめ単語</p>
            <p className="mt-1 text-sm font-medium text-(--color-ink)">
              今の実力に合わせて学習
            </p>
          </Link>
          <Link
            to="/grammar?mode=recommended"
            className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4 transition-colors active:bg-(--color-gold-soft)"
          >
            <p className="text-xs text-(--color-muted)">おすすめ文法</p>
            <p className="mt-1 text-sm font-medium text-(--color-ink)">
              今の実力に合わせて学習
            </p>
          </Link>
        </div>
      )}

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

        <Link
          to="/reading"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">リーディング</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {readingDue > 0 ? `本日 ${readingDue} パッセージ` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {readingDue}
          </span>
        </Link>

        <Link
          to="/part6"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">長文穴埋め（Part 6）</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {part6Due > 0 ? `本日 ${part6Due} パッセージ` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {part6Due}
          </span>
        </Link>

        <Link
          to="/listening-part1"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-(--color-ink)">リスニング（Part 1）</p>
              <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
                NEW
              </span>
            </div>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {listeningPart1Due > 0 ? `本日 ${listeningPart1Due} 問` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {listeningPart1Due}
          </span>
        </Link>

        <Link
          to="/listening-part2"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-(--color-ink)">リスニング（Part 2）</p>
              <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
                NEW
              </span>
            </div>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {listeningPart2Due > 0 ? `本日 ${listeningPart2Due} 問` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {listeningPart2Due}
          </span>
        </Link>

        <Link
          to="/listening-part34"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-(--color-ink)">リスニング（Part 3・4）</p>
              <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
                NEW
              </span>
            </div>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {listeningPart34Due > 0 ? `本日 ${listeningPart34Due} セット` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {listeningPart34Due}
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

      {isReminderSupported() && (
        <div className="mt-3 flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-5 py-3.5">
          <div>
            <p className="text-sm font-medium text-(--color-ink)">
              復習リマインダー
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-(--color-muted)">
              このアプリを開いたときに、復習が残っていれば通知します
            </p>
          </div>
          <button
            onClick={handleToggleReminder}
            aria-pressed={reminderOn}
            className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
              reminderOn ? "bg-(--color-gold)" : "bg-(--color-line)"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-(--color-paper) transition-transform ${
                reminderOn ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}

      <Link
        to="/progress"
        className="mt-3 flex items-center justify-between rounded-sm border border-dashed border-(--color-line) px-5 py-3.5 text-sm text-(--color-ink-soft)"
      >
        <span>弱点分析を見る（文法項目・レベル別の正答率）</span>
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

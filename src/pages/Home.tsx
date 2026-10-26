import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import itemIndex from "../data/itemIndex.json";
import type { AppData } from "../types";
import { isDueToday } from "../lib/spacedRepetition";
import { summarizeStudyNeeds } from "../lib/dailyPlan";
import { estimateScore } from "../lib/scoreEstimate";
import type { SectionScoreEstimate } from "../lib/scoreEstimate";
import { estimateAbilityLevel } from "../lib/recommendation";
import TargetScoreCard from "../components/TargetScoreCard";
import BackupReminder from "../components/BackupReminder";
import { displayStreak } from "../lib/streak";
import {
  isReminderSupported,
  isReminderEnabled,
  enableReminder,
  disableReminder,
  maybeShowDueReminder,
} from "../lib/reminder";

/**
 * 設問IDだけの索引（tools/build_item_index.py で生成）。
 * 今日復習する問題の数を数えるために、問題データ全体（約5MB）を読み込まずに済ませる。
 * 複数の設問を持つ出題単位（会話・文書）は、設問IDの配列。
 */
const { words, grammar, listeningPart1, listeningPart2, listeningPart34, part6, readings } =
  itemIndex as {
    words: string[];
    grammar: string[];
    listeningPart1: string[];
    listeningPart2: string[];
    listeningPart34: string[][];
    part6: string[][];
    readings: string[][];
  };

export default function Home({
  data,
  onSetTargetGoal,
}: {
  data: AppData;
  onSetTargetGoal: (score: number | null, date: string | null) => void;
}) {
  // 最終学習日が昨日より前なら連続は途切れているので0日として扱う（保存値は次に学習するまで更新されない）
  const streak = displayStreak(data.streak, data.lastStudyDate);
  const due = (id: string) => isDueToday(data.progress[id]);
  const wordsDue = words.filter(due).length;
  const grammarDue = grammar.filter(due).length;
  const readingDue = readings.filter((qs) => qs.some(due)).length;
  const part6Due = part6.filter((ids) => ids.some(due)).length;
  const listeningPart1Due = listeningPart1.filter(due).length;
  const listeningPart2Due = listeningPart2.filter(due).length;
  const listeningPart34Due = listeningPart34.filter((qs) => qs.some(due)).length;

  const needs = summarizeStudyNeeds(data.progress);
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
        /* 予想スコア（リーディング＋リスニング合計） */
        <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs tracking-wide text-(--color-muted)">
              予想スコア（参考値）
            </span>
            {streak > 0 && (
              <span className="text-xs font-medium text-(--color-gold)">
                🔥 {streak}日連続
              </span>
            )}
          </div>

          {estimate.total.status === "ok" ? (
            <div className="mt-2 flex items-end gap-2">
              <span className="font-(family-name:--font-display) text-5xl font-semibold text-(--color-ink)">
                {estimate.total.score}
              </span>
              <span className="mb-1 text-sm text-(--color-muted)">/ 990点</span>
              {estimate.total.provisional && (
                <span className="mb-1.5 rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
                  暫定
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-(--color-ink-soft)">
              リーディング・リスニング両方のデータが揃うと合計スコアを表示します
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-(--color-line) pt-4">
            <SectionScoreSummary label="リーディング" estimate={estimate.reading} />
            <SectionScoreSummary label="リスニング" estimate={estimate.listening} />
          </div>
        </div>
      )}

      {/* 目標スコアと達成度 */}
      <TargetScoreCard data={data} onSetTargetGoal={onSetTargetGoal} />

      {/* バックアップのおすすめ（一度もバックアップしていない／30日以上たっている場合） */}
      <BackupReminder data={data} />

      {/* 今日のおすすめセット：復習・苦手・弱点・新規を混ぜた10問を、1タップで始める */}
      <Link
        to="/quick-study?plan=today"
        className="mt-4 flex items-center justify-between rounded-sm border border-(--color-gold) bg-(--color-gold-soft) p-5 transition-colors active:opacity-80"
      >
        <div>
          <p className="font-medium text-(--color-ink)">今日のおすすめセットを始める</p>
          <p className="mt-0.5 text-sm text-(--color-ink-soft)">
            {needs.reviewDue > 0 || needs.leech > 0
              ? `復習 ${needs.reviewDue}問${needs.leech > 0 ? `・苦手 ${needs.leech}問` : ""}を含め、10問を自動で選びます`
              : "迷わず始められる10問を自動で選びます"}
          </p>
        </div>
        <span className="text-(--color-gold)">→</span>
      </Link>

      {/* 模試モード：本番同様の時間制限・通し形式（200問・約2時間） */}
      <Link
        to="/mock-test"
        className="mt-4 flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
      >
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-(--color-ink)">模試モード</p>
            <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
              NEW
            </span>
          </div>
          <p className="mt-0.5 text-sm text-(--color-muted)">
            {data.mockTestHistory.length > 0
              ? `本番同様200問・約2時間で力試し（受験${data.mockTestHistory.length}回）`
              : "本番同様200問・約2時間で力試し"}
          </p>
        </div>
        <span className="text-(--color-gold)">→</span>
      </Link>

      {/* すきま時間モード：単語・文法・リスニングを混ぜた3〜10問のミニセッション */}
      <Link
        to="/quick-study"
        className="mt-4 flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
      >
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-(--color-ink)">すきま時間モード</p>
            <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
              NEW
            </span>
          </div>
          <p className="mt-0.5 text-sm text-(--color-muted)">
            単語からPart 1〜7まで、選んで3〜10問だけサクッと学習
          </p>
        </div>
        <span className="text-(--color-gold)">→</span>
      </Link>

      {/* 時間感覚トレーニング：Part 5 を1問ごとの制限時間つきで10問連続（2.1.33） */}
      <Link
        to="/timed-drill"
        className="mt-4 flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
      >
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-(--color-ink)">時間感覚トレーニング</p>
            <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
              NEW
            </span>
          </div>
          <p className="mt-0.5 text-sm text-(--color-muted)">
            Part 5を1問ごとの制限時間つきで10問。時間内に解く力を鍛える
          </p>
        </div>
        <span className="text-(--color-gold)">→</span>
      </Link>

      {/* ディクテーション：英文を聞き取って書き取る（2.1.34） */}
      <Link
        to="/dictation"
        className="mt-4 flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
      >
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-(--color-ink)">ディクテーション</p>
            <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
              NEW
            </span>
          </div>
          <p className="mt-0.5 text-sm text-(--color-muted)">
            英文を聞き取って書き取り、聞き取れなかった単語を確かめる
          </p>
        </div>
        <span className="text-(--color-gold)">→</span>
      </Link>

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

      {/* 学習メニュー：単語を最初に置き、以降は本番TOEICのPart番号順（Part1〜Part7）に並べる */}
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

        <Link
          to="/grammar"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">文法問題（Part 5）</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {grammarDue > 0 ? `本日 ${grammarDue} 問` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {grammarDue}
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
          to="/reading"
          className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5 transition-colors active:bg-(--color-gold-soft)"
        >
          <div>
            <p className="font-medium text-(--color-ink)">リーディング（Part 7）</p>
            <p className="mt-0.5 text-sm text-(--color-muted)">
              {readingDue > 0 ? `本日 ${readingDue} パッセージ` : "本日の分は完了"}
            </p>
          </div>
          <span className="font-(family-name:--font-display) text-2xl text-(--color-gold)">
            {readingDue}
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
        {estimate.reading.status === "ok" && estimate.reading.provisional && (
          <>
            <br />
            リーディングは、単語の自己判定を含む暫定値です。文法・読解・Part 6を20問解くと、採点された問題だけの値に切り替わります。
          </>
        )}
      </p>
    </div>
  );
}

/** ホーム画面の予想スコア欄で、リーディング/リスニングそれぞれの目安スコアを表示する小さなブロック */
function SectionScoreSummary({
  label,
  estimate,
}: {
  label: string;
  estimate: SectionScoreEstimate;
}) {
  return (
    <div>
      <p className="text-xs text-(--color-muted)">{label}</p>
      {estimate.status === "ok" ? (
        <p className="mt-1 flex items-baseline gap-1">
          <span className="font-(family-name:--font-display) text-2xl font-semibold text-(--color-ink)">
            {estimate.score}
          </span>
          <span className="text-xs text-(--color-muted)">/ 495点</span>
          {estimate.provisional && (
            <span className="rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-gold)">
              暫定
            </span>
          )}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
            あと{estimate.needed - estimate.answeredCount}問でデータ不足解消
          </p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-(--color-line)">
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
        </>
      )}
    </div>
  );
}

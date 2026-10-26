import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import grammarCategories from "../data/grammarCategories.json";
import type { AppData } from "../types";
import { localDateStr } from "../lib/date";
import { displayStreak } from "../lib/streak";
import { PART5_TARGET_SEC, leechRecords, timeStats, weeklyStats } from "../lib/history";
import { MISS_REASONS, reasonTotals } from "../lib/missReason";
import questionTypeIndex from "../data/questionTypes.json";
import { questionTypeStats } from "../lib/questionTypeStats";
import StudyHeatmap from "../components/StudyHeatmap";
import { parseImportedJSON } from "../lib/storage";
import { downloadBackup } from "../lib/backup";

// 文法の問題データ（約640KB）ではなく、設問ID→カテゴリの小さな対応（約20KB）を使う（tools/build_item_index.py で生成）
const categoryById = new Map(Object.entries(grammarCategories as Record<string, string>));

const LEECH_TYPE_LABELS: [string, string][] = [
  ["word", "単語"],
  ["grammar", "文法"],
  ["reading", "読解"],
  ["part6", "Part 6"],
  ["listeningPart1", "Part 1"],
  ["listeningPart2", "Part 2"],
  ["listeningPart34", "Part 3・4"],
];

/** 週の開始日（YYYY-MM-DD）を「10/5〜」の形にする */
function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split("-");
  return `${Number(m)}/${Number(d)}〜`;
}

export default function ProgressPage({
  data,
  onImportData,
}: {
  data: AppData;
  onImportData: (data: AppData) => void;
}) {
  const records = Object.values(data.progress);

  const wordRecords = records.filter((r) => r.itemType === "word");
  const grammarRecords = records.filter((r) => r.itemType === "grammar");
  const readingRecords = records.filter((r) => r.itemType === "reading");
  const part6Records = records.filter((r) => r.itemType === "part6");
  const listeningPart1Records = records.filter((r) => r.itemType === "listeningPart1");
  const listeningPart2Records = records.filter((r) => r.itemType === "listeningPart2");
  const listeningPart34Records = records.filter((r) => r.itemType === "listeningPart34");

  const accuracy = (list: typeof records) =>
    list.length === 0
      ? null
      : Math.round(
          (list.filter((r) => r.isCorrect).length / list.length) * 100
        );

  const wordAccuracy = accuracy(wordRecords);
  const grammarAccuracy = accuracy(grammarRecords);
  const readingAccuracy = accuracy(readingRecords);
  const part6Accuracy = accuracy(part6Records);
  const listeningPart1Accuracy = accuracy(listeningPart1Records);
  const listeningPart2Accuracy = accuracy(listeningPart2Records);
  const listeningPart34Accuracy = accuracy(listeningPart34Records);

  // レベル帯別の正答率（弱点分析）
  const levelBuckets = useMemo(() => {
    const buckets: Record<string, { correct: number; total: number }> = {
      "400-550": { correct: 0, total: 0 },
      "600-700": { correct: 0, total: 0 },
      "750-900": { correct: 0, total: 0 },
    };
    for (const r of records) {
      const key =
        r.itemLevel <= 550 ? "400-550" : r.itemLevel <= 700 ? "600-700" : "750-900";
      buckets[key].total += 1;
      if (r.isCorrect) buckets[key].correct += 1;
    }
    return buckets;
  }, [records]);

  // 文法項目別の正答率（弱点分析）
  const grammarCategoryStats = useMemo(() => {
    const buckets: Record<string, { correct: number; total: number }> = {};
    for (const r of grammarRecords) {
      const category = categoryById.get(r.itemId) ?? "語彙・イディオム";
      if (!buckets[category]) buckets[category] = { correct: 0, total: 0 };
      buckets[category].total += 1;
      if (r.isCorrect) buckets[category].correct += 1;
    }
    return Object.entries(buckets)
      .map(([category, { correct, total }]) => ({
        category,
        correct,
        total,
        pct: total === 0 ? 0 : Math.round((correct / total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct); // 正答率が低い項目を上に表示
  }, [grammarRecords]);

  // 直近14日の学習量
  const chartData = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = localDateStr(d);
      const log = data.dailyLogs[iso];
      days.push({
        date: iso,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count: log
          ? log.wordsStudied +
            log.grammarStudied +
            log.readingsStudied +
            log.part6Studied +
            log.listeningPart1Studied +
            log.listeningPart2Studied +
            log.listeningPart34Studied
          : 0,
      });
    }
    return days;
  }, [data.dailyLogs]);

  const hasAnyData = records.length > 0;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleExport() {
    downloadBackup(data);
  }

  function handleImportClick() {
    setImportMessage(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを連続で選んでも onChange が発火するようにリセット
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseImportedJSON(text);
      if (!parsed) {
        setImportMessage({
          type: "error",
          text: "ファイルの形式が正しくありません。このアプリからエクスポートしたバックアップファイルを選択してください。",
        });
        return;
      }
      const ok = window.confirm(
        "現在のアプリ内の学習データをすべて置き換えてインポートします。この操作は元に戻せません。よろしいですか？"
      );
      if (!ok) return;
      onImportData(parsed);
      setImportMessage({ type: "success", text: "データを復元しました。" });
    };
    reader.readAsText(file);
  }

  // 正答率の推移（直近8週間）と、何度も間違える問題（解答の履歴。2.1.27）
  const weeks = weeklyStats(data.dailyLogs, 8);
  const hasWeeklyAccuracy = weeks.some((w) => w.accuracy !== null);
  const leeches = leechRecords(data.progress);
  // 間違えた理由の内訳（2.1.30）
  const typeGroups = questionTypeStats(data.progress, questionTypeIndex as Record<string, string>);
  const part5Time = timeStats(data.answerHistory, "grammar");
  const reasons = reasonTotals(data.progress);
  const reasonSum = MISS_REASONS.reduce((n, r) => n + reasons[r.id], 0);
  const topReason = MISS_REASONS.reduce((best, r) => (reasons[r.id] > reasons[best.id] ? r : best));
  const leechByType = LEECH_TYPE_LABELS.map(([type, label]) => ({
    label,
    n: leeches.filter((r) => r.itemType === type).length,
  })).filter((x) => x.n > 0);

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        進捗
      </h1>

      <div className="mt-6">
        <StudyHeatmap
          dailyLogs={data.dailyLogs}
          streak={displayStreak(data.streak, data.lastStudyDate)}
        />
      </div>

      <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-sm font-medium text-(--color-ink)">データのバックアップ</p>
        <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
          学習データはこの端末のブラウザ内にのみ保存されています。機種変更やブラウザデータの削除に備えて、定期的にファイルへ書き出しておくことをおすすめします。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="rounded-sm border border-(--color-line) py-2.5 text-sm font-medium text-(--color-ink)"
          >
            エクスポート
          </button>
          <button
            onClick={handleImportClick}
            className="rounded-sm border border-(--color-line) py-2.5 text-sm font-medium text-(--color-ink)"
          >
            インポート
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        {importMessage && (
          <p
            className={`mt-3 text-xs leading-relaxed ${
              importMessage.type === "error"
                ? "text-(--color-incorrect)"
                : "text-(--color-correct)"
            }`}
          >
            {importMessage.text}
          </p>
        )}
      </div>

      {!hasAnyData ? (
        <p className="mt-8 text-sm text-(--color-muted)">
          学習を始めると、ここに正答率や履歴が表示されます。
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <StatCard label="単語 正答率" value={wordAccuracy} />
            <StatCard label="文法 正答率" value={grammarAccuracy} />
            <StatCard label="リーディング 正答率" value={readingAccuracy} />
            <StatCard label="Part 6 正答率" value={part6Accuracy} />
            <StatCard label="リスニング Part 1 正答率" value={listeningPart1Accuracy} />
            <StatCard label="リスニング Part 2 正答率" value={listeningPart2Accuracy} />
            <StatCard label="リスニング Part 3・4 正答率" value={listeningPart34Accuracy} />
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">
              直近14日間の学習量
            </h2>
            <div className="mt-3 h-40 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#8891AC" }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "#EEF0F4" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 2,
                      border: "1px solid #D7DAE4",
                    }}
                  />
                  <Bar dataKey="count" fill="#C9932C" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">正答率の推移（週ごと）</h2>
            {hasWeeklyAccuracy ? (
              <div className="mt-3 space-y-3">
                {weeks.map((w) => {
                  const pct = w.accuracy === null ? 0 : Math.round(w.accuracy * 100);
                  return (
                    <div key={w.weekStart}>
                      <div className="flex justify-between text-xs text-(--color-muted)">
                        <span>
                          {weekLabel(w.weekStart)}
                          <span className="ml-1 text-(--color-line)">（{w.answered}問解答）</span>
                        </span>
                        <span>{w.accuracy === null ? "—" : `${pct}%`}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                        <div className="h-full bg-(--color-gold)" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
                正答率の推移は、これからの学習の記録をもとに表示されます。学習を続けると、週ごとの変化が見られるようになります。
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">何度も間違える問題</h2>
            {leeches.length > 0 ? (
              <div className="mt-3 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
                <p className="text-sm text-(--color-ink)">
                  <span className="font-medium text-(--color-incorrect)">{leeches.length}問</span>
                  <span className="ml-2 text-xs text-(--color-muted)">
                    {leechByType.map((x) => `${x.label} ${x.n}`).join(" ・ ")}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
                  通算3回以上間違えていて、まだ連続で3回正解できていない問題です。連続で3回正解すると、この一覧から外れます。
                </p>
                <Link
                  to="/quick-study?plan=leech"
                  className="mt-3 inline-block rounded-sm bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-paper)"
                >
                  この問題だけ練習する
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
                今のところ、何度も間違えている問題はありません。通算3回以上間違えた問題がここに表示されます。
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">Part 5（文法）の解答時間</h2>
            {part5Time && part5Time.n >= 5 ? (
              <div className="mt-3 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
                <p className="text-sm text-(--color-ink)">
                  中央値 <span className="font-medium">{Math.round(part5Time.medianSec)}秒</span>
                  <span className="ml-2 text-xs text-(--color-muted)">
                    （目安 {PART5_TARGET_SEC}秒 ・ 直近{part5Time.n}問）
                  </span>
                </p>
                <p className="mt-1 text-xs text-(--color-muted)">
                  {PART5_TARGET_SEC}秒以内に解答できた割合：{Math.round(part5Time.withinShare * 100)}%
                  {part5Time.slowCorrect > 0 && ` ・ 正解でも${PART5_TARGET_SEC}秒を超えた問題：${part5Time.slowCorrect}問`}
                </p>
                <Link
                  to="/timed-drill"
                  className="mt-3 inline-block rounded-sm bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-paper)"
                >
                  時間感覚トレーニングをする
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
                文法の問題を解くたびに解答時間を記録します。5問以上たまると、ここに表示されます。時間を意識して解く練習は「時間感覚トレーニング」で。
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">間違えた理由の内訳</h2>
            {reasonSum > 0 ? (
              <>
                <div className="mt-3 space-y-3">
                  {MISS_REASONS.map((r) => {
                    const pct = Math.round((reasons[r.id] / reasonSum) * 100);
                    return (
                      <div key={r.id}>
                        <div className="flex justify-between text-xs text-(--color-muted)">
                          <span>
                            {r.label}
                            <span className="ml-1 text-(--color-line)">（{reasons[r.id]}件）</span>
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                          <div className="h-full bg-(--color-gold)" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
                  最も多いのは「{topReason.label}」。{topReason.hint}。
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
                間違えたときに、解説の「なぜ間違えた？」を選ぶと、理由の内訳がここに表示されます（任意）。理由によって、効く対策が変わります。
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">
              難易度別の正答率（弱点分析）
            </h2>
            <div className="mt-3 space-y-3">
              {Object.entries(levelBuckets).map(([range, { correct, total }]) => {
                const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
                return (
                  <div key={range}>
                    <div className="flex justify-between text-xs text-(--color-muted)">
                      <span>レベル {range}</span>
                      <span>{total === 0 ? "未学習" : `${pct}%`}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                      <div
                        className="h-full bg-(--color-gold)"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {grammarCategoryStats.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-(--color-ink)">
                文法項目別の正答率（弱点分析）
              </h2>
              <p className="mt-1 text-xs text-(--color-muted)">
                正答率が低い項目ほど上に表示されます
              </p>
              <div className="mt-3 space-y-3">
                {grammarCategoryStats.map(({ category, correct, total, pct }) => (
                  <div key={category}>
                    <div className="flex justify-between text-xs text-(--color-muted)">
                      <span>
                        {category}
                        <span className="ml-1 text-(--color-line)">
                          （{correct}/{total}問）
                        </span>
                      </span>
                      <span
                        className={
                          pct < 60 ? "font-medium text-(--color-incorrect)" : ""
                        }
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                      <div
                        className={`h-full ${
                          pct < 60 ? "bg-(--color-incorrect)" : "bg-(--color-gold)"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {typeGroups.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-(--color-ink)">問題タイプ別の正答率（弱点分析）</h2>
              <p className="mt-1 text-xs text-(--color-muted)">
                問われ方（主旨・推測・詳細など）ごとの正答率です。正答率が低いタイプほど上に表示され、5問以上解いて60%未満のタイプは「弱点」として、おすすめセットでも優先して出題されます
              </p>
              {typeGroups.map((g) => (
                <div key={g.itemType} className="mt-4">
                  <p className="text-xs font-medium text-(--color-ink-soft)">{g.label}</p>
                  <div className="mt-2 space-y-3">
                    {g.rows.map((r) => {
                      const pct = Math.round(r.accuracy * 100);
                      return (
                        <div key={r.key}>
                          <div className="flex justify-between text-xs text-(--color-muted)">
                            <span>
                              {r.label}
                              <span className="ml-1 text-(--color-line)">
                                （{r.correct}/{r.answered}問）
                              </span>
                              {r.weak && (
                                <span className="ml-2 rounded-sm bg-(--color-incorrect-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--color-incorrect)">
                                  弱点
                                </span>
                              )}
                            </span>
                            <span className={r.weak ? "font-medium text-(--color-incorrect)" : ""}>{pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-(--color-line)">
                            <div
                              className={`h-full ${r.weak ? "bg-(--color-incorrect)" : "bg-(--color-gold)"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-3.5">
      <p className="text-xs leading-tight text-(--color-muted)">{label}</p>
      <p className="mt-1 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        {value === null ? "―" : `${value}%`}
      </p>
    </div>
  );
}

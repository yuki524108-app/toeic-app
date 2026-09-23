import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import grammarQuestions from "../data/grammar.json";
import type { AppData, GrammarQuestion } from "../types";

const grammarData = grammarQuestions as GrammarQuestion[];

export default function ProgressPage({ data }: { data: AppData }) {
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
    const categoryById = new Map(grammarData.map((g) => [g.id, g.category]));
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
      const iso = d.toISOString().slice(0, 10);
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

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
        進捗
      </h1>

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

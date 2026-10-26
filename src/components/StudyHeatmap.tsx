import { useMemo, useState } from "react";
import type { DailyLog } from "../types";
import {
  buildMonthGrid,
  earliestLogMonth,
  summarizeMonth,
  todayKey,
  totalStudied,
} from "../lib/studyCalendar";
import type { HeatLevel } from "../lib/studyCalendar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** レベルごとのセル背景色。ゴールドの濃さで学習量を表現する */
const LEVEL_STYLE: Record<HeatLevel, string> = {
  0: "var(--color-paper)",
  1: "color-mix(in srgb, var(--color-gold) 25%, var(--color-paper-raised))",
  2: "color-mix(in srgb, var(--color-gold) 50%, var(--color-paper-raised))",
  3: "color-mix(in srgb, var(--color-gold) 75%, var(--color-paper-raised))",
  4: "var(--color-gold)",
};

const DETAIL_ROWS: { label: string; pick: (log: DailyLog) => number }[] = [
  { label: "単語", pick: (l) => l.wordsStudied },
  { label: "文法（Part 5）", pick: (l) => l.grammarStudied },
  { label: "長文穴埋め（Part 6）", pick: (l) => l.part6Studied },
  { label: "リーディング（Part 7）", pick: (l) => l.readingsStudied },
  { label: "リスニング Part 1", pick: (l) => l.listeningPart1Studied },
  { label: "リスニング Part 2", pick: (l) => l.listeningPart2Studied },
  { label: "リスニング Part 3・4", pick: (l) => l.listeningPart34Studied },
];

export default function StudyHeatmap({
  dailyLogs,
  streak,
}: {
  dailyLogs: Record<string, DailyLog>;
  streak: number;
}) {
  const today = todayKey();
  const [ty, tm] = today.split("-").map(Number);
  const currentMonth = { year: ty, month: tm - 1 };

  const [view, setView] = useState(currentMonth);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const earliest = useMemo(() => earliestLogMonth(dailyLogs), [dailyLogs]);
  const weeks = useMemo(
    () => buildMonthGrid(view.year, view.month, dailyLogs),
    [view, dailyLogs]
  );
  const summary = useMemo(
    () => summarizeMonth(view.year, view.month, dailyLogs),
    [view, dailyLogs]
  );

  const monthIndex = (m: { year: number; month: number }) => m.year * 12 + m.month;
  const canGoNext = monthIndex(view) < monthIndex(currentMonth);
  const oldest = earliest ?? currentMonth;
  const canGoPrev = monthIndex(view) > monthIndex(oldest);

  function move(delta: number) {
    const idx = monthIndex(view) + delta;
    setView({ year: Math.floor(idx / 12), month: idx % 12 });
    setSelectedKey(null);
  }

  const selectedLog = selectedKey ? dailyLogs[selectedKey] : undefined;

  return (
    <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-(--color-ink)">学習カレンダー</h2>
        {streak > 0 && (
          <span className="text-xs font-medium text-(--color-gold)">
            🔥 {streak}日連続
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => move(-1)}
          disabled={!canGoPrev}
          aria-label="前の月"
          className="h-8 w-8 rounded-sm border border-(--color-line) text-(--color-ink) disabled:opacity-30"
        >
          ‹
        </button>
        <span className="font-(family-name:--font-display) text-base font-medium text-(--color-ink)">
          {view.year}年{view.month + 1}月
        </span>
        <button
          onClick={() => move(1)}
          disabled={!canGoNext}
          aria-label="次の月"
          className="h-8 w-8 rounded-sm border border-(--color-line) text-(--color-ink) disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-(--color-muted)">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="mt-1.5 space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, ci) => {
              if (!cell) return <span key={ci} className="aspect-square" />;
              const isToday = cell.key === today;
              const isSelected = cell.key === selectedKey;
              return (
                <button
                  key={cell.key}
                  onClick={() =>
                    setSelectedKey(isSelected ? null : cell.key)
                  }
                  aria-label={`${view.month + 1}月${cell.day}日 ${
                    cell.count > 0 ? `${cell.count}問` : "学習なし"
                  }`}
                  aria-pressed={isSelected}
                  style={{ backgroundColor: LEVEL_STYLE[cell.level] }}
                  className={`aspect-square rounded-sm text-[11px] leading-none ${
                    cell.level >= 3
                      ? "text-(--color-paper-raised)"
                      : "text-(--color-ink-soft)"
                  } ${
                    isSelected
                      ? "outline-2 outline-(--color-ink)"
                      : isToday
                        ? "outline-1 outline-(--color-ink)"
                        : ""
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-(--color-muted)">
        <span>
          {summary.studyDays}日 / {summary.daysInMonth}日 学習・計
          {summary.totalQuestions}問
        </span>
        <span className="flex items-center gap-1">
          少
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
            <span
              key={l}
              className="inline-block h-2.5 w-2.5 rounded-[2px] border border-(--color-line)"
              style={{ backgroundColor: LEVEL_STYLE[l] }}
            />
          ))}
          多
        </span>
      </div>

      {selectedKey && (
        <div className="mt-4 border-t border-(--color-line) pt-3">
          <p className="text-xs font-medium text-(--color-ink)">
            {Number(selectedKey.slice(5, 7))}月{Number(selectedKey.slice(8, 10))}日
            {selectedLog && totalStudied(selectedLog) > 0
              ? `：${totalStudied(selectedLog)}問`
              : "：学習なし"}
          </p>
          {selectedLog && totalStudied(selectedLog) > 0 && (
            <ul className="mt-2 space-y-1">
              {DETAIL_ROWS.filter((r) => r.pick(selectedLog) > 0).map((r) => (
                <li
                  key={r.label}
                  className="flex justify-between text-xs text-(--color-muted)"
                >
                  <span>{r.label}</span>
                  <span>{r.pick(selectedLog)}問</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

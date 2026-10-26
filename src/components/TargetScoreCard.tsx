import { useState } from "react";
import type { AppData } from "../types";
import {
  MAX_TARGET_SCORE,
  MIN_TARGET_SCORE,
  TARGET_SCORE_PRESETS,
  calcGoalProgress,
  calcRequiredPace,
  getCurrentScore,
  isValidTargetScore,
  projectFromMocks,
} from "../lib/goal";
import {
  addMonthsLocal,
  daysUntil,
  localDateStr,
  parseLocalDate,
  todayStr,
} from "../lib/date";

const DATE_PRESETS = [
  { label: "3ヶ月後", months: 3 },
  { label: "6ヶ月後", months: 6 },
  { label: "1年後", months: 12 },
] as const;

function formatDate(s: string): string {
  const d = parseLocalDate(s);
  return d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : s;
}

export default function TargetScoreCard({
  data,
  onSetTargetGoal,
}: {
  data: AppData;
  onSetTargetGoal: (score: number | null, date: string | null) => void;
}) {
  const target = data.targetScore;
  const targetDate = data.targetDate;
  const [editing, setEditing] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const current = getCurrentScore(data);

  function startEdit() {
    setScoreInput(target !== null ? String(target) : "");
    setDateInput(targetDate ?? "");
    setError(null);
    setEditing(true);
  }

  function handleSave() {
    const score = Number(scoreInput);
    if (scoreInput === "" || !isValidTargetScore(score)) {
      setError(
        `目標スコアは${MIN_TARGET_SCORE}〜${MAX_TARGET_SCORE}点の範囲で、5点刻みの数値を入力してください。`
      );
      return;
    }
    let date: string | null = null;
    if (dateInput !== "") {
      if (parseLocalDate(dateInput) === null) {
        setError("目標日の形式が正しくありません。");
        return;
      }
      // 過去の日付は新規には設定できない（変更していない既存の目標日はそのまま保持できる）
      if (dateInput < todayStr() && dateInput !== targetDate) {
        setError("目標日は今日以降の日付を指定してください。");
        return;
      }
      date = dateInput;
    }
    onSetTargetGoal(score, date);
    setEditing(false);
    setError(null);
  }

  function handleClear() {
    onSetTargetGoal(null, null);
    setEditing(false);
    setError(null);
  }

  const showEditor = editing || target === null;

  return (
    <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs tracking-wide text-(--color-muted)">
          目標スコア
        </span>
        {target !== null && !editing && (
          <button
            onClick={startEdit}
            className="text-xs font-medium text-(--color-gold)"
          >
            変更
          </button>
        )}
      </div>

      {showEditor ? (
        <div className="mt-3">
          {target === null && !editing && (
            <p className="text-sm leading-relaxed text-(--color-ink-soft)">
              目標を決めると、現在地との差が見えてモチベーションを保ちやすくなります。目標日も設定すると、必要な学習ペースが分かります。
            </p>
          )}

          <p className="mt-3 text-xs font-medium text-(--color-ink)">目標スコア</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TARGET_SCORE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setScoreInput(String(p));
                  setError(null);
                }}
                className={`rounded-sm border px-3 py-1.5 text-sm ${
                  scoreInput === String(p)
                    ? "border-(--color-gold) bg-(--color-gold-soft) font-medium text-(--color-ink)"
                    : "border-(--color-line) text-(--color-ink)"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_TARGET_SCORE}
            max={MAX_TARGET_SCORE}
            step={5}
            value={scoreInput}
            onChange={(e) => {
              setScoreInput(e.target.value);
              setError(null);
            }}
            placeholder="自由入力（例：750）"
            aria-label="目標スコアを入力"
            className="mt-2 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-3 py-2 text-sm text-(--color-ink)"
          />

          <p className="mt-4 text-xs font-medium text-(--color-ink)">
            目標日（任意）
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setDateInput(localDateStr(addMonthsLocal(new Date(), p.months)));
                  setError(null);
                }}
                className="rounded-sm border border-(--color-line) px-3 py-1.5 text-sm text-(--color-ink)"
              >
                {p.label}
              </button>
            ))}
            {dateInput !== "" && (
              <button
                onClick={() => setDateInput("")}
                className="px-2 py-1.5 text-xs text-(--color-muted)"
              >
                目標日をクリア
              </button>
            )}
          </div>
          <input
            type="date"
            value={dateInput}
            min={todayStr()}
            onChange={(e) => {
              setDateInput(e.target.value);
              setError(null);
            }}
            aria-label="目標日を入力"
            className="mt-2 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-3 py-2 text-sm text-(--color-ink)"
          />

          {error && (
            <p className="mt-3 text-xs text-(--color-incorrect)">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={scoreInput === ""}
            className="mt-4 w-full rounded-sm bg-(--color-ink) py-2.5 text-sm font-medium text-(--color-paper) disabled:opacity-40"
          >
            保存
          </button>

          {editing && (
            <div className="mt-3 flex justify-between text-xs">
              <button
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="text-(--color-muted)"
              >
                キャンセル
              </button>
              {target !== null && (
                <button onClick={handleClear} className="text-(--color-incorrect)">
                  目標を解除
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <GoalProgressView
          target={target!}
          targetDate={targetDate}
          current={current}
          data={data}
          onEditDate={startEdit}
        />
      )}
    </div>
  );
}

function GoalProgressView({
  target,
  targetDate,
  current,
  data,
  onEditDate,
}: {
  target: number;
  targetDate: string | null;
  current: ReturnType<typeof getCurrentScore>;
  data: AppData;
  onEditDate: () => void;
}) {
  const achieved = current.status === "ok" && current.score >= target;
  const daysLeft = targetDate ? daysUntil(targetDate) : null;

  if (current.status === "none") {
    return (
      <div className="mt-2">
        <div className="flex items-end gap-2">
          <span className="font-(family-name:--font-display) text-4xl font-semibold text-(--color-ink)">
            {target}
          </span>
          <span className="mb-1 text-sm text-(--color-muted)">点</span>
        </div>
        <DeadlineLine
          targetDate={targetDate}
          daysLeft={daysLeft}
          achieved={false}
          onEditDate={onEditDate}
        />
        <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
          予想スコアまたは模試の結果が出ると、ここに達成度と必要なペースが表示されます。
        </p>
      </div>
    );
  }

  const { percent, remaining } = calcGoalProgress(current.score, target);
  const pace =
    !achieved && daysLeft !== null ? calcRequiredPace(remaining, daysLeft) : null;
  const projection =
    !achieved && daysLeft !== null && daysLeft > 0
      ? projectFromMocks(data.mockTestHistory, daysLeft, target)
      : null;

  return (
    <div className="mt-2">
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-2">
          <span className="font-(family-name:--font-display) text-4xl font-semibold text-(--color-ink)">
            {target}
          </span>
          <span className="mb-1 text-sm text-(--color-muted)">点が目標</span>
        </div>
        <span
          className={`mb-1 text-sm font-medium ${
            achieved ? "text-(--color-correct)" : "text-(--color-gold)"
          }`}
        >
          {percent}%
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-(--color-line)"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="目標スコアの達成度"
      >
        <div
          className={`h-full ${
            achieved ? "bg-(--color-correct)" : "bg-(--color-gold)"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-(--color-muted)">
        現在 {current.score}点
        {current.source === "mock" ? "（直近の模試）" : "（予想）"}
      </p>

      <p
        className={`mt-3 text-sm ${
          achieved ? "font-medium text-(--color-correct)" : "text-(--color-ink-soft)"
        }`}
      >
        {achieved
          ? "🎉 目標スコアに到達しています！次の目標を設定してみましょう。"
          : `目標まであと ${remaining}点`}
      </p>

      {!achieved && (
        <DeadlineLine
          targetDate={targetDate}
          daysLeft={daysLeft}
          achieved={false}
          onEditDate={onEditDate}
        />
      )}

      {pace && (
        <div className="mt-3 rounded-sm bg-(--color-paper) p-3">
          <p className="text-xs font-medium text-(--color-ink)">必要な学習ペース</p>
          <p className="mt-1 text-sm text-(--color-ink-soft)">
            {pace.perWeek !== null
              ? `1週間あたり約 +${pace.perWeek}点`
              : `残り${pace.daysLeft}日で +${remaining}点`}
            {pace.perMonth !== null && `（1ヶ月あたり約 +${pace.perMonth}点）`}
          </p>
          {projection && (
            <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
              直近の模試の伸び（{projection.perWeek >= 0 ? "+" : ""}
              {projection.perWeek}点/週）が続くと、目標日には約
              {projection.projectedScore}点の見込みです（
              {projection.reachesTarget ? "目標に届く見込み" : "目標には届かない見込み"}
              ・参考値）。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DeadlineLine({
  targetDate,
  daysLeft,
  achieved,
  onEditDate,
}: {
  targetDate: string | null;
  daysLeft: number | null;
  achieved: boolean;
  onEditDate: () => void;
}) {
  if (achieved) return null;

  if (!targetDate || daysLeft === null) {
    return (
      <button
        onClick={onEditDate}
        className="mt-3 text-xs font-medium text-(--color-gold)"
      >
        ＋ 目標日を設定して必要なペースを見る
      </button>
    );
  }

  if (daysLeft < 0) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-(--color-incorrect)">
        目標日（{formatDate(targetDate)}）を過ぎています。
        <button onClick={onEditDate} className="ml-1 font-medium underline">
          目標日を見直す
        </button>
      </p>
    );
  }

  return (
    <p className="mt-3 text-xs text-(--color-ink-soft)">
      目標日 {formatDate(targetDate)}（
      {daysLeft === 0 ? "今日" : `あと${daysLeft}日`}）
    </p>
  );
}

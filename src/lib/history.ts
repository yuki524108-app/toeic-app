import type { AnswerEvent, AppData, DailyLog, ItemType, ProgressRecord } from "../types";
import { addDaysLocal, localDateStr, parseLocalDate, todayStr } from "./date";

/**
 * 解答の履歴（2.1.27）。
 *
 * 進捗（`data.progress`）は問題ごとの「最新の状態」しか持たないため、「何回間違えたか」「正答率が伸びているか」が
 * 分からなかった。これを補うために、次の3つを記録する。
 * - 解答1回ごとの記録（`answerHistory`）：直近の傾向（弱点の判定）に使う。容量を抑えるため配列で持ち、上限を超えたら古いものから捨てる
 * - 問題ごとの通算の挑戦回数・間違えた回数（`ProgressRecord.attempts` / `wrongCount`）：「何度も間違える問題」の判定に使う。上限なしで残る
 * - 日ごとの解答数・正解数（`DailyLog.gradedCount` / `correctCount`）：正答率の推移に使う。上限なしで残る
 */

/** 解答の履歴の上限（これを超えたら古いものから捨てる）。1件は約35文字なので、全体で約200KB */
export const MAX_ANSWER_HISTORY = 6000;

/** 履歴の種別の番号（`AnswerEvent` の2番目）と ItemType の対応。保存済みの番号が変わらないよう、末尾にのみ追加する */
export const ITEM_TYPE_ORDER: readonly ItemType[] = [
  "word",
  "grammar",
  "reading",
  "part6",
  "listeningPart1",
  "listeningPart2",
  "listeningPart34",
];

/** 1回の解答を履歴の1件にする */
export function makeAnswerEvent(record: ProgressRecord): AnswerEvent {
  const ms = Date.parse(record.lastAnsweredAt);
  const type = ITEM_TYPE_ORDER.indexOf(record.itemType);
  const at = Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  const correct = record.isCorrect ? 1 : 0;
  // 解答にかかった秒数は、測った画面のものだけ付ける（付けないときは5要素のまま。旧い履歴と同じ形）
  return typeof record.lastElapsedSec === "number"
    ? [record.itemId, type, record.itemLevel, at, correct, record.lastElapsedSec]
    : [record.itemId, type, record.itemLevel, at, correct];
}

/** 履歴に1件追加する。上限を超えた分は古いものから捨てる（元の配列は変更しない） */
export function appendAnswerEvent(history: AnswerEvent[], record: ProgressRecord): AnswerEvent[] {
  const next = [...history, makeAnswerEvent(record)];
  return next.length > MAX_ANSWER_HISTORY ? next.slice(next.length - MAX_ANSWER_HISTORY) : next;
}

/** 保存されていた（またはバックアップから読み込んだ）履歴から、形の正しい件だけを取り出す */
export function sanitizeAnswerHistory(raw: unknown): AnswerEvent[] {
  if (!Array.isArray(raw)) return [];
  const ok: AnswerEvent[] = [];
  for (const e of raw) {
    if (
      Array.isArray(e) &&
      (e.length === 5 || (e.length === 6 && Number.isInteger(e[5]) && e[5] >= 0 && e[5] <= 3599)) &&
      typeof e[0] === "string" &&
      Number.isInteger(e[1]) &&
      e[1] >= 0 &&
      e[1] < ITEM_TYPE_ORDER.length &&
      typeof e[2] === "number" &&
      typeof e[3] === "number" &&
      (e[4] === 0 || e[4] === 1)
    ) {
      ok.push(e as AnswerEvent);
    }
  }
  return ok.length > MAX_ANSWER_HISTORY ? ok.slice(ok.length - MAX_ANSWER_HISTORY) : ok;
}

/** 通算の挑戦回数。履歴機能より前の記録には無いので、記録がある以上は最低1回として扱う */
export function attemptsOf(record: ProgressRecord): number {
  return record.attempts ?? 1;
}

/** 通算の間違えた回数。履歴機能より前の記録には無いので、直近が不正解なら1回として扱う */
export function wrongCountOf(record: ProgressRecord): number {
  return record.wrongCount ?? (record.isCorrect ? 0 : 1);
}

/** 「何度も間違える問題」とみなす、通算の間違えた回数 */
export const LEECH_MIN_WRONG = 3;
/** 連続でこの回数正解すると、「何度も間違える問題」から外れる（定着したとみなす） */
export const LEECH_CLEAR_STREAK = 3;

/** 何度も間違える問題か：通算3回以上間違えていて、まだ連続正解が3回に届いていない */
export function isLeech(record: ProgressRecord | undefined): boolean {
  if (!record) return false;
  return wrongCountOf(record) >= LEECH_MIN_WRONG && record.repetitions < LEECH_CLEAR_STREAK;
}

/** 何度も間違える問題の一覧（間違えた回数の多い順） */
export function leechRecords(progress: Record<string, ProgressRecord>): ProgressRecord[] {
  return Object.values(progress)
    .filter(isLeech)
    .sort((a, b) => wrongCountOf(b) - wrongCountOf(a) || a.itemId.localeCompare(b.itemId));
}

// ---------- 正答率の推移 ----------

export type WeekStat = {
  /** その週の月曜日（YYYY-MM-DD） */
  weekStart: string;
  /** その週に解答した問題数（正誤を記録していない古い日の分を含む） */
  answered: number;
  /** 正誤を記録した解答数と、そのうちの正解数 */
  graded: number;
  correct: number;
  /** 正答率（0〜1）。正誤を記録した解答がなければ null */
  accuracy: number | null;
};

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 月曜=0
  x.setDate(x.getDate() - dow);
  return x;
}

function answeredIn(log: DailyLog): number {
  return (
    log.wordsStudied +
    log.grammarStudied +
    log.readingsStudied +
    log.part6Studied +
    log.listeningPart1Studied +
    log.listeningPart2Studied +
    log.listeningPart34Studied
  );
}

/** 直近 weeks 週間の週ごとの解答数・正答率（古い週から新しい週の順。今週を含む） */
export function weeklyStats(
  dailyLogs: Record<string, DailyLog>,
  weeks = 8,
  today: string = todayStr()
): WeekStat[] {
  const base = parseLocalDate(today) ?? new Date();
  const thisMonday = mondayOf(base);
  const stats: WeekStat[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDaysLocal(thisMonday, -7 * w);
    const startStr = localDateStr(start);
    let answered = 0;
    let graded = 0;
    let correct = 0;
    for (let i = 0; i < 7; i++) {
      const log = dailyLogs[localDateStr(addDaysLocal(start, i))];
      if (!log) continue;
      answered += answeredIn(log);
      graded += log.gradedCount ?? 0;
      correct += log.correctCount ?? 0;
    }
    stats.push({
      weekStart: startStr,
      answered,
      graded,
      correct,
      accuracy: graded > 0 ? correct / graded : null,
    });
  }
  return stats;
}

// ---------- 弱点の判定に使う解答のサンプル ----------

export type AnswerSample = { id: string; type: ItemType; correct: boolean };

/** 履歴がこの件数に満たないうちは、弱点の判定に進捗（問題ごとの最新の正誤）を使う */
export const MIN_HISTORY_FOR_WEAKNESS = 30;
/** 弱点の判定に使う、直近の解答の件数 */
export const WEAKNESS_WINDOW = 400;

/**
 * 弱点の判定に使う解答のサンプル。履歴が十分にあれば直近の解答（新しい傾向を反映）、
 * 無ければ（履歴機能の導入直後など）進捗の最新の正誤を使う。
 */
export function answerSamples(data: AppData): AnswerSample[] {
  if (data.answerHistory.length >= MIN_HISTORY_FOR_WEAKNESS) {
    return data.answerHistory.slice(-WEAKNESS_WINDOW).map((e) => ({
      id: e[0],
      type: ITEM_TYPE_ORDER[e[1]],
      correct: e[4] === 1,
    }));
  }
  return Object.values(data.progress).map((r) => ({
    id: r.itemId,
    type: r.itemType,
    correct: r.isCorrect,
  }));
}

// ---------- 解答時間（2.1.33） ----------

/** Part 5（文法）の目安の時間（秒）。TOEICのPart 5は、1問あたり約20秒で解くのが目安 */
export const PART5_TARGET_SEC = 20;

export type TimeStats = {
  /** 時間を測った解答の数（直近 window 件の範囲） */
  n: number;
  /** 解答時間の中央値（秒）。長く考え込んだ1問に引きずられないよう、平均ではなく中央値を使う */
  medianSec: number;
  /** 目安の時間内に解答した割合（0〜1） */
  withinShare: number;
  /** 正解だったが、目安の時間を超えた解答の数（「遅いが正解」） */
  slowCorrect: number;
  limitSec: number;
};

/** 種別ごとの解答時間の集計。時間を測った解答が1件もなければ null */
export function timeStats(
  history: AnswerEvent[],
  type: ItemType,
  limitSec: number = PART5_TARGET_SEC,
  window = 200
): TimeStats | null {
  const typeIndex = ITEM_TYPE_ORDER.indexOf(type);
  const timed = history
    .filter((e) => e[1] === typeIndex && typeof e[5] === "number")
    .slice(-window);
  if (timed.length === 0) return null;
  const secs = timed.map((e) => e[5] as number).sort((a, b) => a - b);
  const mid = Math.floor(secs.length / 2);
  const medianSec = secs.length % 2 === 1 ? secs[mid] : (secs[mid - 1] + secs[mid]) / 2;
  return {
    n: timed.length,
    medianSec,
    withinShare: timed.filter((e) => (e[5] as number) <= limitSec).length / timed.length,
    slowCorrect: timed.filter((e) => e[4] === 1 && (e[5] as number) > limitSec).length,
    limitSec,
  };
}

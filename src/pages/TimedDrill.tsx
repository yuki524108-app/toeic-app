import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import grammarQuestions from "../data/grammar.json";
import type { AppData, GrammarQuestion, ProgressRecord } from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { buildDailyPlan } from "../lib/dailyPlan";
import type { QuickPools } from "../lib/quickQueue";
import { PART5_TARGET_SEC, timeStats } from "../lib/history";
import { applyMissReason } from "../lib/missReason";
import { useStopwatch } from "../lib/stopwatch";
import { answerLabel, verdictMessage } from "../lib/announce";
import { Announce } from "../components/Announce";
import { FocusLabel } from "../components/FocusLabel";
import { MissReasonPicker } from "../components/MissReasonPicker";
import { choiceStyle } from "../components/quick/constants";

/**
 * 時間感覚トレーニング（2.1.33）。Part 5（文法）を、1問ごとの制限時間つきで10問連続で解く。
 * TOEICは時間との戦いなので、「正解できるか」に加えて「時間内に解けるか」を練習する。
 * 時間内に答えられなかった問題は、不正解（理由は「時間切れ」）として記録する。
 */

const PACES = [15, PART5_TARGET_SEC, 30] as const;
const COUNT = 10;
const PACE_KEY = "toeic-app:drill-pace";
/** 残り時間が少なくなったことを知らせる秒数 */
const WARN_SEC = 5;

const POOLS: QuickPools = {
  word: [],
  grammar: grammarQuestions as GrammarQuestion[],
  listeningPart1: [],
  listeningPart2: [],
  listeningPart34: [],
  part6: [],
  reading: [],
};

function loadPace(): number {
  try {
    const v = Number(localStorage.getItem(PACE_KEY));
    return (PACES as readonly number[]).includes(v) ? v : PART5_TARGET_SEC;
  } catch {
    return PART5_TARGET_SEC;
  }
}

type Result = { id: string; correct: boolean; timedOut: boolean; sec: number };

export default function TimedDrill({
  data,
  onAnswer,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
}) {
  const [pace, setPace] = useState<number>(loadPace);
  const [queue, setQueue] = useState<GrammarQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [, setTick] = useState(0);
  // この問題の解答（時間切れを含む）を記録済みか。状態（answered）は再描画されるまで更新されず、
  // 時間切れの判定と解答が重なったり、タイマーが続けて動いたりすると二重に記録しかねないため、同期的に判定できる印を持つ
  const settled = useRef(false);

  const current = queue?.[index];
  const watch = useStopwatch(current?.id ?? "");
  const answered = selected !== null || timedOut;

  // 残り時間の表示を更新し、時間が切れたら時間切れにする
  useEffect(() => {
    if (!current || answered) return;
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      if (watch.elapsedMs() >= pace * 1000) {
        clearInterval(timer);
        finish(null);
      }
    }, 100);
    return () => clearInterval(timer);
    // finish は current・pace・answered が変わるたびに作り直されるため、これらが変わったときにだけ付け替える
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, answered, pace]);

  function start() {
    const plan = buildDailyPlan(data, POOLS, { categories: ["grammar"], count: COUNT });
    const items = plan.queue.flatMap((q) => (q.kind === "grammar" ? [q.item] : []));
    if (items.length === 0) return;
    settled.current = false;
    setQueue(items);
    setIndex(0);
    setSelected(null);
    setTimedOut(false);
    setResults([]);
  }

  function choosePace(p: number) {
    setPace(p);
    try {
      localStorage.setItem(PACE_KEY, String(p));
    } catch {
      // 記憶できなくても学習には影響しないので、黙って無視する
    }
  }

  /** 解答する（choice が null なら時間切れ）。記録は1問につき1回だけ */
  function finish(choice: number | null) {
    if (!current || settled.current) return;
    settled.current = true;
    const correct = choice !== null && choice === current.answer;
    const sec = choice === null ? pace : Math.min(watch.elapsedSec(), pace);
    let record: ProgressRecord = {
      ...updateProgress(current.id, "grammar", current.level, correct, data.progress[current.id]),
      lastElapsedSec: sec,
    };
    if (choice === null) record = applyMissReason(record, "timeout", null);
    onAnswer(record);
    setResults((r) => [...r, { id: current.id, correct, timedOut: choice === null, sec }]);
    if (choice === null) setTimedOut(true);
    else setSelected(choice);
  }

  function next() {
    settled.current = false;
    setSelected(null);
    setTimedOut(false);
    setIndex((i) => i + 1);
  }

  const backLink = (
    <Link to="/" className="text-sm text-(--color-muted)">
      ← ホーム
    </Link>
  );

  // ---------- 設定画面 ----------
  if (queue === null) {
    const stats = timeStats(data.answerHistory, "grammar");
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        {backLink}
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          時間感覚トレーニング
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
          Part 5（文法）を、1問ごとの制限時間つきで{COUNT}問連続で解きます。TOEICのPart 5は、1問あたり約
          {PART5_TARGET_SEC}秒で解くのが目安です。時間内に答えられなかった問題は、不正解（時間切れ）として記録されます。
        </p>

        {stats && (
          <p className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-3 text-xs leading-relaxed text-(--color-ink-soft)">
            これまでの解答時間（直近{stats.n}問）：中央値 {Math.round(stats.medianSec)}秒 ・ {stats.limitSec}
            秒以内 {Math.round(stats.withinShare * 100)}%
          </p>
        )}

        <p className="mt-6 text-sm font-medium text-(--color-ink)">1問の制限時間</p>
        <div role="group" aria-label="1問の制限時間" className="mt-2 grid grid-cols-3 gap-2">
          {PACES.map((p) => (
            <button
              key={p}
              onClick={() => choosePace(p)}
              aria-pressed={pace === p}
              className={`rounded-sm border py-3 text-center ${
                pace === p
                  ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                  : "border-(--color-line) text-(--color-muted)"
              }`}
            >
              <span className="block text-base font-medium">{p}秒</span>
              <span className="block text-[10px]">
                {p === PART5_TARGET_SEC ? "本番のペース" : p < PART5_TARGET_SEC ? "速め" : "ゆっくり"}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={start}
          className="mt-8 w-full rounded-sm bg-(--color-ink) py-3.5 text-sm font-medium text-(--color-paper)"
        >
          {COUNT}問を始める
        </button>
        <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
          復習日を迎えた問題・苦手な問題・弱点の分野・新しい問題から選びます。別のアプリに切り替えている間は、時間を数えません。
        </p>
      </div>
    );
  }

  // ---------- 結果画面 ----------
  if (!current) {
    const correctN = results.filter((r) => r.correct).length;
    const timeouts = results.filter((r) => r.timedOut).length;
    const secs = results.map((r) => r.sec).sort((a, b) => a - b);
    const mid = Math.floor(secs.length / 2);
    const median = secs.length === 0 ? 0 : secs.length % 2 === 1 ? secs[mid] : (secs[mid - 1] + secs[mid]) / 2;
    const slowCorrect = results.filter((r) => r.correct && r.sec > PART5_TARGET_SEC).length;
    const byId = new Map(queue.map((q, i) => [q.id, i + 1]));
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        {backLink}
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          結果
        </h1>
        <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
          <p className="text-2xl font-medium text-(--color-ink)">
            {results.length}問中 {correctN}問正解
          </p>
          <p className="mt-2 text-sm text-(--color-ink-soft)">
            時間切れ {timeouts}問 ・ 解答時間の中央値 {Math.round(median)}秒（制限 {pace}秒）
          </p>
          {slowCorrect > 0 && (
            <p className="mt-1 text-xs text-(--color-muted)">
              正解でも{PART5_TARGET_SEC}秒を超えた問題が{slowCorrect}問ありました
            </p>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
          {timeouts >= 3
            ? "時間切れが多めです。迷ったら、明らかに違う選択肢を消して2択に絞り、早めに決めて次へ進む練習をしましょう。"
            : median > PART5_TARGET_SEC
              ? `正解できていても、1問あたりの時間が目安（${PART5_TARGET_SEC}秒）より長めです。品詞や時制など、空所の前後の形から素早く判断する練習を。`
              : "時間内に解くペースがつかめています。この調子で、制限時間を短くして挑戦してみましょう。"}
        </p>

        <ul className="mt-4 space-y-1.5">
          {results.map((r) => (
            <li key={r.id} className="flex justify-between rounded-sm border border-(--color-line) px-3 py-2 text-sm">
              <span className="text-(--color-ink-soft)">第{byId.get(r.id)}問</span>
              <span className={r.correct ? "text-(--color-correct)" : "text-(--color-incorrect)"}>
                {r.timedOut ? "時間切れ" : r.correct ? "正解" : "不正解"}
                <span className="ml-2 text-xs text-(--color-muted)">{r.sec}秒</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => {
              setQueue(null);
            }}
            className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            もう一度やる
          </button>
          <Link
            to="/"
            className="rounded-sm border border-(--color-line) py-3 text-center text-sm font-medium text-(--color-ink)"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  // ---------- 出題画面 ----------
  const remainingMs = answered ? 0 : Math.max(0, pace * 1000 - watch.elapsedMs());
  const remainingSec = Math.ceil(remainingMs / 1000);
  const ratio = answered ? 0 : remainingMs / (pace * 1000);
  const urgent = !answered && remainingSec <= WARN_SEC;
  const isLast = index === (queue?.length ?? 0) - 1;
  const correct = selected === current.answer;

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        {backLink}
        <FocusLabel changeKey={index} className="text-xs text-(--color-muted)">
          時間感覚トレーニング ・ {index + 1} / {queue.length}
        </FocusLabel>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-(--color-muted)">
          <span>制限時間 {pace}秒</span>
          <span
            role="timer"
            aria-label="残り時間"
            className={`text-base font-medium ${urgent ? "text-(--color-incorrect)" : "text-(--color-ink)"}`}
          >
            {answered ? "—" : `残り ${remainingSec}秒`}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-(--color-line)" aria-hidden="true">
          <div
            className={`h-full ${urgent ? "bg-(--color-incorrect)" : "bg-(--color-gold)"}`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        {urgent && <Announce key={current.id} message={`残り${WARN_SEC}秒`} />}
      </div>

      <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-base leading-relaxed text-(--color-ink)">{current.question}</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {current.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => finish(i)}
            disabled={answered}
            className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${choiceStyle(
              answered ? (selected ?? -1) : null,
              i,
              current.answer
            )}`}
          >
            {choice}
          </button>
        ))}
      </div>

      {answered && (
        <div role="region" aria-label="解説" className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <Announce
            message={
              timedOut
                ? `時間切れです。正解は ${answerLabel(current.choices, current.answer)}。${current.explanation}`
                : verdictMessage(correct, answerLabel(current.choices, current.answer), current.explanation)
            }
          />
          <p className={`text-sm font-medium ${correct ? "text-(--color-correct)" : "text-(--color-incorrect)"}`}>
            {timedOut ? "時間切れ" : correct ? "正解です" : "不正解です"}
            <span className="ml-2 text-xs font-normal text-(--color-muted)">
              {results[results.length - 1]?.sec}秒
            </span>
          </p>
          {!timedOut && !correct && <MissReasonPicker itemId={current.id} />}
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--color-ink-soft)">
            {current.explanation}
          </p>
          <button
            onClick={next}
            className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            {isLast ? "結果を見る" : "次の問題へ"}
          </button>
        </div>
      )}
    </div>
  );
}

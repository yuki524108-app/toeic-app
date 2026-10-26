import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import words from "../data/words.json";
import grammarQuestions from "../data/grammar.json";
import listeningPart1Items from "../data/listeningPart1.json";
import listeningPart2Questions from "../data/listeningPart2.json";
import listeningPart34Sets from "../data/listeningPart34.json";
import part6Passages from "../data/part6.json";
import readings from "../data/readings.json";
import type {
  AppData,
  GrammarQuestion,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
  Part6Passage,
  ProgressRecord,
  ReadingPassage,
  Word,
} from "../types";
import { updateProgress } from "../lib/spacedRepetition";
import { isTTSSupported } from "../lib/tts";
import {
  DEFAULT_PLAN_COUNT,
  PLAN_REASON_LABEL,
  buildDailyPlan,
  summarizeStudyNeeds,
} from "../lib/dailyPlan";
import type { PlanReason } from "../lib/dailyPlan";
import { buildBridgePlan, isBridgeKind } from "../lib/bridge";
import {
  QUICK_CATEGORIES,
  QUICK_COUNT_OPTIONS,
  buildQuickQueue,
  countReviewDue,
  estimateMinutes,
  loadQuickPrefs,
  saveQuickPrefs,
  shuffle,
  totalQuestions,
} from "../lib/quickQueue";
import type { QuickCategory, QuickItem, QuickPools } from "../lib/quickQueue";
import {
  clearQuickSession,
  firstUnansweredIndex,
  loadQuickSession,
  saveQuickSession,
} from "../lib/quickSession";
import type { QuickResult } from "../lib/quickSession";
import { WordCard, GrammarCard } from "../components/quick/BasicCards";
import { Part1Card, Part2Card, Part34Card } from "../components/quick/ListeningCards";
import { Part6Card, ReadingCard } from "../components/quick/PassageCards";
import type { QuizAnswer } from "../components/quick/constants";
import { FocusLabel } from "../components/FocusLabel";

const POOLS: QuickPools = {
  word: words as Word[],
  grammar: grammarQuestions as GrammarQuestion[],
  listeningPart1: listeningPart1Items as ListeningPart1Item[],
  listeningPart2: listeningPart2Questions as ListeningPart2Question[],
  listeningPart34: listeningPart34Sets as ListeningPart34Set[],
  part6: part6Passages as Part6Passage[],
  // 「数分」に収まらないダブル／トリプルパッセージ（複数文書）は対象外とし、1つの文書の問題のみ出題する
  reading: (readings as ReadingPassage[]).filter(
    (p) => p.type === undefined || p.type === "single"
  ),
};

const CATEGORY_LABEL = Object.fromEntries(
  QUICK_CATEGORIES.map((c) => [c.id, c.label])
) as Record<QuickCategory, string>;

/** 中断した日時の表示用（例：10月2日 18:30） */
function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuickStudy({
  data,
  onAnswer,
  onToggleBookmark,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
  onToggleBookmark: (itemId: string) => void;
}) {
  const [prefs, setPrefs] = useState(loadQuickPrefs);
  const [queue, setQueue] = useState<QuickItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<QuickResult[]>([]);
  // 中断中のセッション（端末に保存されたもの）。セッションを始める・破棄する・終えるまで残る
  const [saved, setSaved] = useState(() => loadQuickSession(POOLS));
  // おすすめセット／苦手な問題の練習として始めたセッションか（通常のすきま時間モードなら null）。出題の理由も持つ
  const [plan, setPlan] = useState<{
    kind: PlanKind;
    reasons: Record<string, PlanReason>;
    /** 基礎固め（2.1.32）のとき、戻ってくる問題の種別と設問ID */
    from?: { kind: QuickCategory; itemId: string };
  } | null>(null);
  // 基礎固めを始められなかったときの案内（設定画面に表示する）
  const [notice, setNotice] = useState<string | null>(null);
  const needs = useMemo(
    () => summarizeStudyNeeds(data.progress),
    // 設定画面を開いている間は data が変わらないため、画面の切り替わり（セッションの開始・終了）ごとに再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue === null]
  );

  const reviewDueCount = useMemo(
    () => countReviewDue(data, prefs.categories, POOLS),
    // 設定画面を開いている間は data が変わらないため、選択カテゴリが変わったときだけ再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.categories, queue === null]
  );

  function begin(items: QuickItem[], nextPlan: typeof plan = null) {
    if (items.length === 0) return;
    setPlan(nextPlan);
    // 新しく始めると、中断中のセッションは破棄される
    clearQuickSession();
    setSaved(null);
    setQueue(items);
    setIndex(0);
    setResults([]);
  }

  /** おすすめセット（または苦手な問題だけの練習）を組み立てて始める */
  function startPlan(kind: PlanKind) {
    const built = buildDailyPlan(data, POOLS, {
      count: DEFAULT_PLAN_COUNT,
      // 音声が使えない端末では、聞き取りの問題を除く
      categories: isTTSSupported()
        ? undefined
        : QUICK_CATEGORIES.map((c) => c.id).filter((id) => !id.startsWith("listening")),
      onlyReasons: kind === "leech" ? ["leech"] : undefined,
    });
    begin(built.queue, { kind, reasons: built.reasons });
  }

  /**
   * 基礎固め（2.1.32）：何度も間違える問題の前に、同じ分野のやさしい問題を解き、最後にその問題へ戻る。
   * 手がかり（同じ分野のやさしい問題）がなければ、始めずに設定画面で理由を伝える。
   */
  function startBridge(kind: string, itemId: string) {
    const built = isBridgeKind(kind) ? buildBridgePlan(data, POOLS, kind, itemId) : null;
    if (!built || built.bridgeCount === 0) {
      setNotice(
        "この問題と同じ分野で、先に解けるやさしい問題が見つかりませんでした。解説をもう一度読むか、おすすめセットで他の問題から進めましょう。"
      );
      return;
    }
    setNotice(null);
    begin(built.queue, { kind: "bridge", reasons: built.reasons, from: { kind: kind as QuickCategory, itemId } });
  }

  // ホームなどから「/quick-study?plan=today」（苦手は plan=leech）で開かれたら、1タップで始める。
  // 中断中のセッションがあるときは、それを黙って破棄しないよう、設定画面を表示する
  const autoStarted = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const want = searchParams.get("plan");
    if (!want || autoStarted.current) return;
    autoStarted.current = true;
    const bridgeKind = searchParams.get("kind") ?? "";
    const bridgeItem = searchParams.get("item") ?? "";
    setSearchParams({}, { replace: true });
    if (saved) return;
    if (want === "today") startPlan("plan");
    else if (want === "leech") startPlan("leech");
    else if (want === "bridge" && bridgeItem) startBridge(bridgeKind, bridgeItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStart(count: number) {
    const next = { ...prefs, count };
    setPrefs(next);
    saveQuickPrefs(next);
    begin(buildQuickQueue(data, count, next.categories, POOLS));
  }

  function toggleCategory(id: QuickCategory) {
    const has = prefs.categories.includes(id);
    // 最低1カテゴリは選択された状態を保つ
    if (has && prefs.categories.length === 1) return;
    const categories = QUICK_CATEGORIES.map((c) => c.id).filter((c) =>
      c === id ? !has : prefs.categories.includes(c)
    );
    const next = { ...prefs, categories };
    setPrefs(next);
    saveQuickPrefs(next);
  }

  /** 1問解答するたびに呼ばれる：進捗を記録し、結果に追加し、中断に備えてセッションを保存する */
  function handleAnswer(q: QuickItem, a: QuizAnswer) {
    onAnswer(
      updateProgress(a.id, q.kind, a.level, a.correct, data.progress[a.id], a.confidence)
    );
    const next = [...results, { ...a, q }];
    setResults(next);
    if (queue) saveQuickSession(queue, next);
  }

  /** 次の出題単位へ進む。最後まで終えたら、再開するものがなくなるので保存を消す */
  function advance() {
    if (!queue) return;
    const next = index + 1;
    setIndex(next);
    if (next >= queue.length) clearQuickSession();
  }

  /** セッションを中断して設定画面に戻る。解答が1つもなければ再開するものがないので保存を消す */
  function leave() {
    if (results.length === 0) clearQuickSession();
    setQueue(null);
    setSaved(loadQuickSession(POOLS));
  }

  /** 中断中のセッションを再開する。位置は解答の記録から導出する（途中のセットは未解答の設問から続く） */
  function resume() {
    if (!saved) return;
    const position = firstUnansweredIndex(saved.queue, saved.results);
    setQueue(saved.queue);
    setResults(saved.results);
    setSaved(null);
    if (position === -1) {
      // 最後の問題まで解答済みで、結果画面に進む前に中断していた
      setIndex(saved.queue.length);
      clearQuickSession();
    } else {
      setIndex(position);
    }
  }

  function discard() {
    clearQuickSession();
    setSaved(null);
  }

  // ---------- セッション開始前：カテゴリと問題数の選択画面 ----------
  if (!queue) {
    const hasSetCategory = QUICK_CATEGORIES.some(
      (c) => c.isSet && prefs.categories.includes(c.id)
    );
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          すきま時間モード
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
          選んだカテゴリの問題を混ぜて、短時間でサクッと学習できます。前回間違えた問題や復習日を迎えた問題が優先して出題されます。
        </p>

        {notice && (
          <p role="status" className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-3 text-xs leading-relaxed text-(--color-ink-soft)">
            {notice}
          </p>
        )}

        <PlanCard
          leechCount={needs.leech}
          reviewDue={needs.reviewDue}
          onStartPlan={() => startPlan("plan")}
          onStartLeech={() => startPlan("leech")}
        />

        {saved && (
          <ResumeCard
            saved={saved}
            onResume={resume}
            onDiscard={discard}
          />
        )}

        <p className="mt-6 text-xs font-medium text-(--color-ink)">出題するカテゴリ</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_CATEGORIES.map((c) => {
            const on = prefs.categories.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                aria-pressed={on}
                className={`rounded-sm border px-3 py-2 text-sm ${
                  on
                    ? "border-(--color-gold) bg-(--color-gold-soft) font-medium text-(--color-ink)"
                    : "border-(--color-line) text-(--color-muted)"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-(--color-muted)">
          {reviewDueCount > 0
            ? `復習が必要な問題：${reviewDueCount}問`
            : "復習が必要な問題はありません。未学習の問題から出題します。"}
        </p>
        {hasSetCategory && (
          <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
            Part 3・4、Part 6、Part 7は、会話・文書ごとに3〜4問まとめて出題します（Part
            7は1つの文書の問題のみ）。そのため、問題数が目安より少し増減することがあります。
          </p>
        )}

        <p className="mt-6 text-xs font-medium text-(--color-ink)">問題数</p>
        <div className="mt-2 space-y-3">
          {QUICK_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              onClick={() => handleStart(count)}
              className="flex w-full items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-5 py-4 text-left transition-colors active:bg-(--color-gold-soft)"
            >
              <span className="font-medium text-(--color-ink)">{count}問だけ</span>
              <span className="text-xs text-(--color-muted)">
                約{estimateMinutes(count, prefs.categories)}分
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const total = totalQuestions(queue);
  const answered = results.length;
  const isDone = index >= queue.length;

  // ---------- 結果画面 ----------
  if (isDone) {
    const correctCount = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct);
    const kinds = QUICK_CATEGORIES.map((c) => c.id).filter((id) =>
      results.some((r) => r.q.kind === id)
    );
    // 間違えた設問を含む出題単位（セットは丸ごと）。重複は除く
    const retryItems = [
      ...new Map(missed.map((r) => [r.q.item.id, r.q])).values(),
    ];

    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-16">
        <div className="text-center">
          <p className="font-(family-name:--font-display) text-3xl font-medium text-(--color-ink)">
            お疲れさまでした
          </p>
          <p className="mt-3 text-(--color-ink-soft)">
            {answered}問中 {correctCount}問正解
          </p>
          {plan && (
            <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
              {(["bridge", "leech", "dueWrong", "due", "weak", "new", "other"] as PlanReason[])
                .map((r) => {
                  const rs = results.filter((x) => plan.reasons[x.q.item.id] === r);
                  return rs.length === 0
                    ? null
                    : `${PLAN_REASON_LABEL[r]} ${rs.filter((x) => x.correct).length}/${rs.length}`;
                })
                .filter((t) => t !== null)
                .join(" ・ ")}
            </p>
          )}
          {kinds.length > 1 && (
            <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">
              {kinds
                .map((k) => {
                  const rs = results.filter((r) => r.q.kind === k);
                  return `${CATEGORY_LABEL[k]} ${rs.filter((r) => r.correct).length}/${rs.length}`;
                })
                .join(" ・ ")}
            </p>
          )}
        </div>

        {missed.length > 0 ? (
          <div className="mt-8">
            <p className="text-xs font-medium text-(--color-ink)">
              間違えた問題（{missed.length}問）
            </p>
            <ul className="mt-2 space-y-2">
              {missed.map((r) => (
                <li
                  key={r.id}
                  className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-3"
                >
                  <p className="line-clamp-2 text-sm font-medium text-(--color-ink)">
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-xs text-(--color-muted)">
                    {CATEGORY_LABEL[r.q.kind]} ・ 正解：{r.answer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-(--color-correct)">全問正解です！</p>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {missed.length > 0 && (
            <button
              onClick={() => begin(shuffle(retryItems))}
              className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
            >
              間違えた問題をもう一度（{totalQuestions(retryItems)}問）
            </button>
          )}
          <button
            onClick={() =>
              plan
                ? plan.kind === "bridge" && plan.from
                  ? startBridge(plan.from.kind, plan.from.itemId)
                  : startPlan(plan.kind === "bridge" ? "plan" : plan.kind)
                : begin(buildQuickQueue(data, prefs.count, prefs.categories, POOLS))
            }
            className={`rounded-sm py-3 text-sm font-medium ${
              missed.length > 0
                ? "border border-(--color-line) text-(--color-ink)"
                : "bg-(--color-ink) text-(--color-paper)"
            }`}
          >
            {plan
              ? plan.kind === "leech"
                ? "苦手な問題をもう一度組む"
                : plan.kind === "bridge"
                  ? "別のやさしい問題で基礎固めをやり直す"
                  : "新しいおすすめセットをやる"
              : `もう一度やる（${prefs.count}問）`}
          </button>
          <button
            onClick={() => {
              setQueue(null);
              setSaved(null);
            }}
            className="rounded-sm border border-(--color-line) py-3 text-sm font-medium text-(--color-ink)"
          >
            設定を変える
          </button>
          <Link to="/" className="py-2 text-center text-sm text-(--color-muted)">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const current = queue[index];
  const common = {
    bookmarks: data.bookmarks,
    onToggleBookmark,
    isLast: index === queue.length - 1,
    onAnswer: (a: QuizAnswer) => handleAnswer(current, a),
    onNext: advance,
  };
  // この出題単位で解答済みの設問（再開時に、解答済みの状態を復元するために使う）
  const restored = Object.fromEntries(
    results.filter((r) => r.q.item.id === current.item.id).map((r) => [r.id, r.selected])
  );

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <button onClick={leave} className="text-sm text-(--color-muted)">
          やめる
        </button>
        <FocusLabel changeKey={index} className="text-xs text-(--color-muted)">
          {plan ? (plan.kind === "leech" ? "苦手な問題の練習" : plan.kind === "bridge" ? "基礎固め" : "今日のおすすめ") : "すきま時間モード"} ・{" "}
          {answered} / {total}問 解答済み
        </FocusLabel>
      </div>
      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-(--color-line)"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="セッションの進捗"
      >
        <div
          className="h-full bg-(--color-gold) transition-all"
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>

      {plan && plan.reasons[current.item.id] && (
        <p className="mt-3 text-xs text-(--color-muted)">
          出題の理由：
          <span className="ml-1 rounded-sm border border-(--color-gold) bg-(--color-gold-soft) px-2 py-0.5 text-(--color-ink)">
            {PLAN_REASON_LABEL[plan.reasons[current.item.id]]}
          </span>
        </p>
      )}

      {current.kind === "word" && (
        <WordCard key={current.item.id} word={current.item} {...common} />
      )}
      {current.kind === "grammar" && (
        <GrammarCard key={current.item.id} question={current.item} {...common} />
      )}
      {current.kind === "listeningPart1" && (
        <Part1Card key={current.item.id} question={current.item} {...common} />
      )}
      {current.kind === "listeningPart2" && (
        <Part2Card key={current.item.id} question={current.item} {...common} />
      )}
      {current.kind === "listeningPart34" && (
        <Part34Card key={current.item.id} set={current.item} restored={restored} {...common} />
      )}
      {current.kind === "part6" && (
        <Part6Card key={current.item.id} passage={current.item} restored={restored} {...common} />
      )}
      {current.kind === "reading" && (
        <ReadingCard key={current.item.id} passage={current.item} restored={restored} {...common} />
      )}
    </div>
  );
}

type PlanKind = "plan" | "leech" | "bridge";

/** 設定画面の先頭に表示する「今日のおすすめセット」のカード */
function PlanCard({
  leechCount,
  reviewDue,
  onStartPlan,
  onStartLeech,
}: {
  leechCount: number;
  reviewDue: number;
  onStartPlan: () => void;
  onStartLeech: () => void;
}) {
  return (
    <div className="mt-5 rounded-sm border border-(--color-gold) bg-(--color-gold-soft) p-4">
      <p className="font-medium text-(--color-ink)">今日のおすすめセット</p>
      <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
        復習・苦手・弱点・新しい問題をバランスよく混ぜて、{DEFAULT_PLAN_COUNT}
        問を自動で選びます。迷わずすぐ始められます。
        {reviewDue > 0 && `（復習日を迎えた問題：${reviewDue}問）`}
      </p>
      <button
        onClick={onStartPlan}
        className="mt-3 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
      >
        おすすめセットを始める
      </button>
      {leechCount > 0 && (
        <button
          onClick={onStartLeech}
          className="mt-2 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) py-3 text-sm font-medium text-(--color-ink)"
        >
          何度も間違える問題だけ練習する（{leechCount}問）
        </button>
      )}
    </div>
  );
}

/** 設定画面に表示する「中断中のセッション」のカード */
function ResumeCard({
  saved,
  onResume,
  onDiscard,
}: {
  saved: NonNullable<ReturnType<typeof loadQuickSession>>;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const total = totalQuestions(saved.queue);
  const position = firstUnansweredIndex(saved.queue, saved.results);
  const current = position === -1 ? null : saved.queue[position];
  // 複数の設問を持つセットを途中まで解いていた場合は、続きから再開することを伝える
  const midSet =
    current !== null &&
    saved.results.some((r) => r.q.item.id === current.item.id)
      ? current
      : null;

  return (
    <div className="mt-6 rounded-sm border border-(--color-gold) bg-(--color-gold-soft) p-4">
      <p className="text-sm font-medium text-(--color-ink)">中断中のセッションがあります</p>
      <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
        {saved.results.length} / {total}問 解答済み ・ {formatSavedAt(saved.savedAt)} に中断
        {midSet && `。「${CATEGORY_LABEL[midSet.kind]}」は解答済みの設問を飛ばして、続きの設問から再開します`}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 rounded-sm bg-(--color-ink) py-2.5 text-sm font-medium text-(--color-paper)"
        >
          続きから再開
        </button>
        <button
          onClick={onDiscard}
          className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-2.5 text-sm text-(--color-ink)"
        >
          破棄
        </button>
      </div>
      <p className="mt-2 text-[11px] text-(--color-muted)">
        新しく始めると、中断中のセッションは破棄されます。
      </p>
    </div>
  );
}

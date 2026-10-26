import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppData, MockTestResult, ProgressRecord } from "../types";
import {
  buildMockTest,
  findRepeatShortages,
  flattenListening,
  flattenReading,
  formatTime,
  LISTENING_TIME_SEC,
  MOCK_TEST_COUNTS,
  READING_TIME_SEC,
  scoreSection,
} from "../lib/mockTest";
import type {
  ListeningStep,
  MockTest as MockTestData,
  MockTestSectionResult,
  ReadingStep,
} from "../lib/mockTest";
import { updateProgress } from "../lib/spacedRepetition";
import { isTTSSupported, stopSpeaking } from "../lib/tts";
import { CHOICE_ORDER_VERSION } from "../lib/choiceOrder";
import { FlagIcon } from "../components/mock/FlagIcon";
import { ReviewList } from "../components/mock/ReviewList";
import {
  ListeningPart1View,
  ListeningPart2View,
  ListeningPart34View,
} from "../components/mock/ListeningViews";
import { GrammarView, Part6View, ReadingView } from "../components/mock/ReadingViews";
import { readingStepIds, readingStepLabel } from "../components/mock/readingStep";

const READING_TOTAL_LABEL = 200; // 通し番号の最後（表示用）


type Phase = "intro" | "listening" | "transition" | "reading" | "result";

export default function MockTest({
  data,
  onAnswer,
  onRecordResult,
}: {
  data: AppData;
  onAnswer: (record: ProgressRecord) => void;
  onRecordResult: (result: MockTestResult) => void;
}) {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("intro");
  const [test, setTest] = useState<MockTestData | null>(null);
  const [listeningIndex, setListeningIndex] = useState(0);
  const [readingIndex, setReadingIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [remainingListening, setRemainingListening] = useState(LISTENING_TIME_SEC);
  const [remainingReading, setRemainingReading] = useState(READING_TIME_SEC);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    listening: MockTestSectionResult;
    reading: MockTestSectionResult;
    totalScore: number;
  } | null>(null);

  // 未出題の問題が足りず、次の模試で過去の模試と重なる区分（開始画面で事前に知らせる）。履歴が変わったときだけ再計算する
  const repeatShortages = useMemo(
    () => findRepeatShortages(data.mockTestHistory),
    [data.mockTestHistory]
  );

  // 1秒ごとにタイマーを減らす（フェーズがlistening/readingの間のみ）
  useEffect(() => {
    if (phase !== "listening" || remainingListening <= 0) return;
    const t = setTimeout(() => setRemainingListening((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remainingListening]);

  useEffect(() => {
    if (phase !== "reading" || remainingReading <= 0) return;
    const t = setTimeout(() => setRemainingReading((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remainingReading]);

  // リスニングの制限時間が0になったら、自動的にリーディングへの案内画面に進む
  useEffect(() => {
    if (phase === "listening" && remainingListening === 0) {
      stopSpeaking();
      setPhase("transition");
    }
  }, [phase, remainingListening]);

  // リーディングの制限時間が0になったら自動採点する
  useEffect(() => {
    if (phase === "reading" && remainingReading === 0) {
      finalizeTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingReading]);

  // 模試の途中でうっかりリロード・タブを閉じてしまうのを防ぐ警告
  useEffect(() => {
    if (phase !== "listening" && phase !== "reading") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  function handleStart() {
    const t = buildMockTest(data.mockTestHistory);
    setTest(t);
    setListeningIndex(0);
    setReadingIndex(0);
    setAnswers({});
    setFlagged({});
    setRemainingListening(LISTENING_TIME_SEC);
    setRemainingReading(READING_TIME_SEC);
    setResult(null);
    setPhase("listening");
  }

  function handleAbort() {
    const ok = window.confirm(
      "模試を中断してホームに戻りますか？ここまでの解答は保存されません。"
    );
    if (!ok) return;
    stopSpeaking();
    setPhase("intro");
    setTest(null);
    navigate("/");
  }

  function handleListeningSelect(id: string, choice: number) {
    setAnswers((prev) => ({ ...prev, [id]: choice }));
  }

  function handleListeningNext() {
    stopSpeaking();
    if (!test) return;
    if (listeningIndex + 1 < test.listeningSteps.length) {
      setListeningIndex((i) => i + 1);
    } else {
      setPhase("transition");
    }
  }

  function handleStartReading() {
    setPhase("reading");
  }

  function handleReadingSelect(id: string, choice: number) {
    setAnswers((prev) => ({ ...prev, [id]: choice }));
  }

  function toggleFlag() {
    setFlagged((prev) => ({ ...prev, [readingIndex]: !prev[readingIndex] }));
  }

  function goPrevReading() {
    setReadingIndex((i) => Math.max(0, i - 1));
  }

  function goNextReading() {
    if (!test) return;
    setReadingIndex((i) => Math.min(test.readingSteps.length - 1, i + 1));
  }

  function jumpToReading(i: number) {
    setReadingIndex(i);
    setShowReviewPanel(false);
  }

  function handleSubmitClick() {
    if (!test) return;
    const unansweredCount = test.readingSteps.filter(
      (step) => !readingStepIds(step).every((id) => answers[id] !== undefined)
    ).length;
    const message =
      unansweredCount > 0
        ? `未解答の設問が${unansweredCount}件あります。このまま採点しますか？`
        : "解答を終了して採点します。よろしいですか？";
    if (window.confirm(message)) {
      finalizeTest();
    }
  }

  function finalizeTest() {
    setTest((currentTest) => {
      if (!currentTest) return currentTest;
      const listeningAtomic = flattenListening(currentTest.listeningSteps);
      const readingAtomic = flattenReading(currentTest.readingSteps);

      setAnswers((currentAnswers) => {
        const listeningResult = scoreSection(listeningAtomic, currentAnswers);
        const readingResult = scoreSection(readingAtomic, currentAnswers);
        const totalScore = Math.min(
          990,
          listeningResult.score + readingResult.score
        );

        const allAtomic = [...listeningAtomic, ...readingAtomic];
        const answerRecords: MockTestResult["answerRecords"] = allAtomic.map(
          (q) => ({
            id: q.id,
            itemType: q.itemType,
            level: q.level,
            correctAnswer: q.correctAnswer,
            selectedAnswer: currentAnswers[q.id] ?? null,
            qNumber: q.qNumber,
            partLabel: q.partLabel,
          })
        );

        for (const q of allAtomic) {
          const correct = currentAnswers[q.id] === q.correctAnswer;
          const record = updateProgress(
            q.id,
            q.itemType,
            q.level,
            correct,
            data.progress[q.id]
          );
          onAnswer(record);
        }

        const completedAt = new Date().toISOString();
        onRecordResult({
          id: completedAt,
          completedAt,
          listening: listeningResult,
          reading: readingResult,
          totalScore,
          answerRecords,
          choiceOrder: CHOICE_ORDER_VERSION,
        });

        setResult({
          id: completedAt,
          listening: listeningResult,
          reading: readingResult,
          totalScore,
        });
        setPhase("result");
        return currentAnswers;
      });

      return currentTest;
    });
  }

  function renderListeningStep(step: ListeningStep) {
    if (step.kind === "part1") {
      return (
        <ListeningPart1View
          key={`part1-${step.item.id}`}
          item={step.item}
          selectedAnswer={answers[step.item.id]}
          onSelect={(choice) => handleListeningSelect(step.item.id, choice)}
        />
      );
    }
    if (step.kind === "part2") {
      return (
        <ListeningPart2View
          key={`part2-${step.item.id}`}
          item={step.item}
          selectedAnswer={answers[step.item.id]}
          onSelect={(choice) => handleListeningSelect(step.item.id, choice)}
        />
      );
    }
    const question = step.set.questions[step.questionIndex];
    return (
      <ListeningPart34View
        key={`part34-${step.set.id}-${step.questionIndex}`}
        set={step.set}
        question={question}
        selectedAnswer={answers[question.id]}
        onSelect={(choice) => handleListeningSelect(question.id, choice)}
      />
    );
  }

  function renderReadingStep(step: ReadingStep) {
    if (step.kind === "grammar") {
      return (
        <GrammarView
          key={`grammar-${step.item.id}`}
          item={step.item}
          selectedAnswer={answers[step.item.id]}
          onSelect={(choice) => handleReadingSelect(step.item.id, choice)}
        />
      );
    }
    if (step.kind === "part6") {
      return (
        <Part6View
          key={`part6-${step.passage.id}`}
          passage={step.passage}
          answers={answers}
          onSelect={handleReadingSelect}
        />
      );
    }
    const question = step.passage.questions[step.questionIndex];
    return (
      <ReadingView
        key={`reading-${question.id}`}
        passage={step.passage}
        question={question}
        selectedAnswer={answers[question.id]}
        onSelect={(choice) => handleReadingSelect(question.id, choice)}
      />
    );
  }

  // ---------- イントロ画面 ----------
  if (phase === "intro") {
    const part7Total =
      MOCK_TEST_COUNTS.readingSingle * 3 +
      MOCK_TEST_COUNTS.readingDouble * 5 +
      MOCK_TEST_COUNTS.readingTriple * 5;
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        <Link to="/" className="text-sm text-(--color-muted)">
          ← ホーム
        </Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          模試モード
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
          本番のTOEICと同じ出題数・時間配分（リスニング100問45分＋リーディング100問75分、計200問・約2時間）で、通しで解答する模試です。解答の途中で正誤は表示されず、すべて解答し終えてからまとめて採点されます。
        </p>

        <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">構成</p>
          <ul className="mt-2 space-y-1 text-sm text-(--color-ink-soft)">
            <li>
              リスニング：Part1 {MOCK_TEST_COUNTS.part1}問・Part2 {MOCK_TEST_COUNTS.part2}
              問・Part3 {MOCK_TEST_COUNTS.part3Sets * 3}問・Part4{" "}
              {MOCK_TEST_COUNTS.part4Sets * 3}問（計100問・45分）
            </li>
            <li>
              リーディング：Part5 {MOCK_TEST_COUNTS.grammar}問・Part6{" "}
              {MOCK_TEST_COUNTS.part6Passages * 4}問・Part7 {part7Total}問（計100問・75分）
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
            問題は毎回ランダムに抽出されます。過去の模試で解答した問題はできるだけ避け、未出題の問題から出題します。ブラウザを閉じたりリロードしたりすると解答内容は失われるため、まとまった時間を確保してから始めてください。
          </p>
          {repeatShortages.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
              {repeatShortages.join("・")}
              は未出題の問題が足りないため、過去の模試と重なる問題が含まれます（最後に出題されてから最も間が空いたものから選びます）。
            </p>
          )}
        </div>

        <button
          onClick={handleStart}
          className="mt-6 rounded-sm bg-(--color-ink) py-3.5 text-sm font-medium text-(--color-paper)"
        >
          模試を開始する（約2時間）
        </button>

        {data.mockTestHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-(--color-ink)">受験履歴</h2>
            <div className="mt-3 space-y-2">
              {[...data.mockTestHistory]
                .reverse()
                .slice(0, 5)
                .map((r) => (
                  <Link
                    key={r.id}
                    to={`/mock-test-review/${encodeURIComponent(r.id)}`}
                    className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-3 transition-colors active:bg-(--color-gold-soft)"
                  >
                    <div>
                      <p className="text-xs text-(--color-muted)">
                        {new Date(r.completedAt).toLocaleDateString("ja-JP")}
                      </p>
                      <p className="mt-0.5 text-xs text-(--color-muted)">
                        L {r.listening.score} ・ R {r.reading.score}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-(family-name:--font-display) text-xl font-medium text-(--color-ink)">
                        {r.totalScore}
                        <span className="ml-1 text-xs font-normal text-(--color-muted)">
                          /990
                        </span>
                      </p>
                      <span className="text-(--color-gold)">→</span>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!test) return null;

  // ---------- リスニングセクション ----------
  const listeningStep = test.listeningSteps[listeningIndex];
  if (phase === "listening" && listeningStep) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        <div className="flex items-center justify-between">
          <button onClick={handleAbort} className="text-sm text-(--color-muted)">
            中断する
          </button>
          <span
            className={`rounded-sm px-2 py-1 text-xs font-medium ${
              remainingListening <= 300
                ? "bg-(--color-incorrect-soft) text-(--color-incorrect)"
                : "bg-(--color-gold-soft) text-(--color-ink)"
            }`}
          >
            残り {formatTime(remainingListening)}
          </span>
        </div>
        <p className="mt-3 text-xs text-(--color-muted)">
          リスニングセクション ・ 設問 {listeningStep.qNumber} / {test.listeningTotal}
        </p>

        {!isTTSSupported() && (
          <div className="mt-3 rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) p-3 text-xs leading-relaxed text-(--color-incorrect)">
            お使いのブラウザは音声読み上げ（Web Speech
            API）に対応していないため、代わりに問題文を表示しています。
          </div>
        )}

        <div className="mt-4">{renderListeningStep(listeningStep)}</div>

        <button
          onClick={handleListeningNext}
          className="mt-5 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
        >
          {listeningIndex + 1 < test.listeningSteps.length
            ? "次の設問へ"
            : "リスニングセクションを終了する"}
        </button>
      </div>
    );
  }

  // ---------- セクション間の案内画面 ----------
  if (phase === "transition") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-24 text-center">
        <p className="text-sm text-(--color-muted)">リスニングセクション終了</p>
        <h1 className="mt-3 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
          次はリーディングセクションです
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          制限時間は75分です。開始すると同時にタイマーが動き出します。準備ができたら開始してください。
        </p>
        <button
          onClick={handleStartReading}
          className="mt-8 rounded-sm bg-(--color-ink) px-6 py-3 text-sm font-medium text-(--color-paper)"
        >
          リーディングセクションを開始する
        </button>
      </div>
    );
  }

  // ---------- リーディングセクション ----------
  const readingStep = test.readingSteps[readingIndex];
  if (phase === "reading" && readingStep) {
    const isFlagged = !!flagged[readingIndex];
    const qLabel = readingStepLabel(readingStep);

    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        <div className="flex items-center justify-between">
          <button onClick={handleAbort} className="text-sm text-(--color-muted)">
            中断する
          </button>
          <span
            className={`rounded-sm px-2 py-1 text-xs font-medium ${
              remainingReading <= 300
                ? "bg-(--color-incorrect-soft) text-(--color-incorrect)"
                : "bg-(--color-gold-soft) text-(--color-ink)"
            }`}
          >
            残り {formatTime(remainingReading)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-(--color-muted)">
            リーディングセクション ・ 設問 {qLabel} / {READING_TOTAL_LABEL}
          </p>
          <button
            onClick={toggleFlag}
            className={`flex items-center gap-1 text-xs ${
              isFlagged ? "text-(--color-gold)" : "text-(--color-muted)"
            }`}
          >
            <FlagIcon filled={isFlagged} />
            あとで見直す
          </button>
        </div>

        <div className="mt-4">{renderReadingStep(readingStep)}</div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={goPrevReading}
            disabled={readingIndex === 0}
            className="rounded-sm border border-(--color-line) py-3 text-sm font-medium text-(--color-ink) disabled:opacity-40"
          >
            前へ
          </button>
          {readingIndex + 1 < test.readingSteps.length ? (
            <button
              onClick={goNextReading}
              className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
            >
              次へ
            </button>
          ) : (
            <button
              onClick={handleSubmitClick}
              className="rounded-sm bg-(--color-gold) py-3 text-sm font-medium text-(--color-ink)"
            >
              採点する
            </button>
          )}
        </div>

        <button
          onClick={() => setShowReviewPanel((v) => !v)}
          className="mt-4 text-left text-xs text-(--color-muted) underline"
        >
          {showReviewPanel
            ? "見直しリストを閉じる"
            : "見直しリストを開く（未解答・見直しマーク一覧）"}
        </button>

        {showReviewPanel && (
          <div className="mt-3 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
            <ReviewList
              test={test}
              answers={answers}
              flagged={flagged}
              onJump={jumpToReading}
            />
            <button
              onClick={handleSubmitClick}
              className="mt-4 w-full rounded-sm bg-(--color-gold) py-3 text-sm font-medium text-(--color-ink)"
            >
              解答を終了して採点する
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------- 結果画面 ----------
  if (phase === "result" && result) {
    const missedCount =
      result.listening.total -
      result.listening.correct +
      (result.reading.total - result.reading.correct);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-28 pt-16 text-center">
        <p className="text-sm text-(--color-muted)">模試が完了しました</p>
        <p className="mt-2 font-(family-name:--font-display) text-6xl font-semibold text-(--color-gold)">
          {result.totalScore}
        </p>
        <p className="text-sm text-(--color-muted)">/ 990点</p>

        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
            <p className="text-xs text-(--color-muted)">リスニング</p>
            <p className="mt-1 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
              {result.listening.score}
              <span className="ml-1 text-xs font-normal text-(--color-muted)">/495</span>
            </p>
            <p className="mt-1 text-xs text-(--color-muted)">
              {result.listening.correct}/{result.listening.total}問正解
            </p>
          </div>
          <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4">
            <p className="text-xs text-(--color-muted)">リーディング</p>
            <p className="mt-1 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">
              {result.reading.score}
              <span className="ml-1 text-xs font-normal text-(--color-muted)">/495</span>
            </p>
            <p className="mt-1 text-xs text-(--color-muted)">
              {result.reading.correct}/{result.reading.total}問正解
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-(--color-muted)">
          解答結果は各設問の間隔反復スケジュールにも反映されました。間違えた問題は復習画面から復習できます。
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          {missedCount > 0 && (
            <Link
              to={`/mock-test-review/${encodeURIComponent(result.id)}`}
              className="rounded-sm border border-(--color-gold) bg-(--color-gold-soft) py-3 text-center text-sm font-medium text-(--color-ink)"
            >
              間違えた問題を復習する（{missedCount}問）
            </Link>
          )}
          <button
            onClick={handleStart}
            className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
          >
            もう一度挑戦する
          </button>
          <Link
            to="/"
            className="rounded-sm border border-(--color-line) py-3 text-sm font-medium text-(--color-ink)"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

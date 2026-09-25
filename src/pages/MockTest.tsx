import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AppData,
  GrammarQuestion,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
  MockTestResult,
  Part6Passage,
  ProgressRecord,
  ReadingPassage,
} from "../types";
import {
  buildMockTest,
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
import { isTTSSupported, speakScript, speakSequence, stopSpeaking } from "../lib/tts";

const CHOICE_LABELS4 = ["A", "B", "C", "D"] as const;
const CHOICE_LABELS3 = ["A", "B", "C"] as const;
const RATES = [0.75, 1, 1.25] as const;

const READING_TOTAL_LABEL = 200; // 通し番号の最後（表示用）

type Phase = "intro" | "listening" | "transition" | "reading" | "result";

/** リーディングの1ステップに含まれる設問id一覧（Part6は4空欄まとめて1ステップ） */
function readingStepIds(step: ReadingStep): string[] {
  if (step.kind === "grammar") return [step.item.id];
  if (step.kind === "part6") return step.passage.blanks.map((b) => b.id);
  return [step.passage.questions[step.questionIndex].id];
}

function readingStepLabel(step: ReadingStep): string {
  if (step.kind === "part6") {
    const start = step.qNumberStart;
    const end = start + step.passage.blanks.length - 1;
    return `${start}-${end}`;
  }
  return `${step.qNumber}`;
}

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
    listening: MockTestSectionResult;
    reading: MockTestSectionResult;
    totalScore: number;
  } | null>(null);

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
    const t = buildMockTest();
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

        for (const q of [...listeningAtomic, ...readingAtomic]) {
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
        });

        setResult({ listening: listeningResult, reading: readingResult, totalScore });
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
            問題は毎回ランダムに抽出されます。ブラウザを閉じたりリロードしたりすると解答内容は失われるため、まとまった時間を確保してから始めてください。
          </p>
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
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-3"
                  >
                    <div>
                      <p className="text-xs text-(--color-muted)">
                        {new Date(r.completedAt).toLocaleDateString("ja-JP")}
                      </p>
                      <p className="mt-0.5 text-xs text-(--color-muted)">
                        L {r.listening.score} ・ R {r.reading.score}
                      </p>
                    </div>
                    <p className="font-(family-name:--font-display) text-xl font-medium text-(--color-ink)">
                      {r.totalScore}
                      <span className="ml-1 text-xs font-normal text-(--color-muted)">
                        /990
                      </span>
                    </p>
                  </div>
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

// ==================== 見直しリスト ====================

function ReviewList({
  test,
  answers,
  flagged,
  onJump,
}: {
  test: MockTestData;
  answers: Record<string, number>;
  flagged: Record<number, boolean>;
  onJump: (index: number) => void;
}) {
  const unanswered: { index: number; label: string }[] = [];
  const flaggedList: { index: number; label: string }[] = [];
  test.readingSteps.forEach((step, i) => {
    const ids = readingStepIds(step);
    const label = readingStepLabel(step);
    if (!ids.every((id) => answers[id] !== undefined)) unanswered.push({ index: i, label });
    if (flagged[i]) flaggedList.push({ index: i, label });
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-(--color-muted)">
          未解答（{unanswered.length}問）
        </p>
        {unanswered.length === 0 ? (
          <p className="mt-1 text-xs text-(--color-ink-soft)">すべて解答済みです</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unanswered.map(({ index, label }) => (
              <button
                key={index}
                onClick={() => onJump(index)}
                className="rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) px-2 py-1 text-xs text-(--color-incorrect)"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-(--color-muted)">
          見直しマーク（{flaggedList.length}問）
        </p>
        {flaggedList.length === 0 ? (
          <p className="mt-1 text-xs text-(--color-ink-soft)">マークはありません</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {flaggedList.map(({ index, label }) => (
              <button
                key={index}
                onClick={() => onJump(index)}
                className="rounded-sm border border-(--color-gold) bg-(--color-gold-soft) px-2 py-1 text-xs text-(--color-ink)"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== リスニング：各Partの表示 ====================

function ListeningPart1View({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: ListeningPart1Item;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const stoppedRef = useRef({ current: false });

  useEffect(() => {
    return () => {
      stoppedRef.current.current = true;
      stopSpeaking();
    };
  }, []);

  async function handlePlay() {
    if (isPlaying) return;
    stoppedRef.current.current = false;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await speakSequence(item.choices, rate, {
      pauseMs: 700,
      onSegmentStart: (i) => setPlayingSegment(i),
      stoppedRef: stoppedRef.current,
    });
    setIsPlaying(false);
    setPlayingSegment(null);
  }
  function handleStop() {
    stoppedRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingSegment(null);
  }

  const revealed = selectedAnswer !== undefined || !ttsSupported;

  return (
    <>
      <div className="overflow-hidden rounded-sm border border-(--color-line) bg-(--color-paper-raised)">
        <p className="px-4 pt-4 text-xs font-medium tracking-wide text-(--color-muted)">
          Part 1 ・ 写真描写問題
        </p>
        <div
          className="mt-2 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: item.image }}
        />
      </div>

      {ttsSupported ? (
        <div className="mt-5 flex flex-col items-center">
          <button
            onClick={isPlaying ? handleStop : handlePlay}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper) transition-colors active:opacity-80"
            aria-label={isPlaying ? "停止" : "再生する"}
          >
            {isPlaying ? <StopIcon /> : <PlayIcon />}
          </button>
          <p className="mt-3 text-xs text-(--color-muted)">
            {isPlaying
              ? playingSegment !== null
                ? `選択肢 ${CHOICE_LABELS4[playingSegment]} を再生中…`
                : "再生中…"
              : hasPlayedOnce
              ? "もう一度再生する"
              : "タップして4つの英文を再生"}
          </p>
          <div className="mt-4 flex gap-2">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  rate === r
                    ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                    : "border-(--color-line) text-(--color-muted)"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4 text-sm leading-relaxed text-(--color-ink)">
          {item.choices.map((c, i) => (
            <p key={i}>
              <span className="font-medium">{CHOICE_LABELS4[i]}.</span> {c}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {item.choices.map((choice, i) => {
          const isSelected = i === selectedAnswer;
          const style = isSelected
            ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
            : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${style}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS4[i]}
              </span>
              {revealed ? (
                <span className="text-sm leading-relaxed">{choice}</span>
              ) : (
                <span className="text-sm text-(--color-muted)">
                  選択肢 {CHOICE_LABELS4[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ListeningPart2View({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: ListeningPart2Question;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const stoppedRef = useRef({ current: false });

  useEffect(() => {
    return () => {
      stoppedRef.current.current = true;
      stopSpeaking();
    };
  }, []);

  async function handlePlay() {
    if (isPlaying) return;
    stoppedRef.current.current = false;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await speakSequence([item.question, ...item.choices], rate, {
      pauseMs: 700,
      onSegmentStart: (i) => setPlayingSegment(i),
      stoppedRef: stoppedRef.current,
    });
    setIsPlaying(false);
    setPlayingSegment(null);
  }
  function handleStop() {
    stoppedRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingSegment(null);
  }

  const revealed = selectedAnswer !== undefined || !ttsSupported;

  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 2 ・ 応答問題
        </p>
        {ttsSupported ? (
          <div className="mt-5 flex flex-col items-center">
            <button
              onClick={isPlaying ? handleStop : handlePlay}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper) transition-colors active:opacity-80"
              aria-label={isPlaying ? "停止" : "再生する"}
            >
              {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <p className="mt-3 text-xs text-(--color-muted)">
              {isPlaying
                ? playingSegment === 0
                  ? "設問を再生中…"
                  : playingSegment !== null
                  ? `選択肢 ${CHOICE_LABELS3[playingSegment - 1]} を再生中…`
                  : "再生中…"
                : hasPlayedOnce
                ? "もう一度再生する"
                : "タップして再生"}
            </p>
            <div className="mt-4 flex gap-2">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    rate === r
                      ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                      : "border-(--color-line) text-(--color-muted)"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm leading-relaxed text-(--color-ink)">
            <p>{item.question}</p>
          </div>
        )}
      </div>
      <div className="mt-5 space-y-2.5">
        {item.choices.map((choice, i) => {
          const isSelected = i === selectedAnswer;
          const style = isSelected
            ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
            : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex w-full items-center gap-3 rounded-sm border px-4 py-3.5 text-left transition-colors ${style}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                {CHOICE_LABELS3[i]}
              </span>
              {revealed ? (
                <span className="text-sm leading-relaxed">{choice}</span>
              ) : (
                <span className="text-sm text-(--color-muted)">
                  選択肢 {CHOICE_LABELS3[i]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ListeningPart34View({
  set,
  question,
  selectedAnswer,
  onSelect,
}: {
  set: ListeningPart34Set;
  question: ListeningPart34Set["questions"][number];
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  const ttsSupported = isTTSSupported();
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const stoppedRef = useRef({ current: false });

  useEffect(() => {
    return () => {
      stoppedRef.current.current = true;
      stopSpeaking();
    };
  }, []);

  async function handlePlay() {
    if (isPlaying) return;
    stoppedRef.current.current = false;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await speakScript(set.script, rate, {
      pauseMs: 400,
      onLineStart: (i) => setPlayingLine(i),
      stoppedRef: stoppedRef.current,
    });
    setIsPlaying(false);
    setPlayingLine(null);
  }
  function handleStop() {
    stoppedRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingLine(null);
  }

  const partLabel = set.partType === "part3" ? "Part 3 ・ 会話問題" : "Part 4 ・ トーク問題";

  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-(--color-muted)">
            {partLabel}
          </p>
          <p className="text-xs text-(--color-muted)">{set.title}</p>
        </div>

        {ttsSupported ? (
          <div className="mt-5 flex flex-col items-center">
            <button
              onClick={isPlaying ? handleStop : handlePlay}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper) transition-colors active:opacity-80"
              aria-label={isPlaying ? "停止" : "再生する"}
            >
              {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <p className="mt-3 text-xs text-(--color-muted)">
              {isPlaying
                ? playingLine !== null
                  ? `${set.script[playingLine]?.speaker} の発言を再生中…`
                  : "再生中…"
                : hasPlayedOnce
                ? "もう一度再生する"
                : "タップして再生"}
            </p>
            <div className="mt-4 flex gap-2">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    rate === r
                      ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                      : "border-(--color-line) text-(--color-muted)"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2 border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
            {set.script.map((l, i) => (
              <p key={i}>
                <span className="font-medium text-(--color-ink)">{l.speaker}: </span>
                {l.line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-base leading-relaxed text-(--color-ink)">{question.question}</p>
        <div className="mt-4 space-y-2.5">
          {question.choices.map((choice, i) => {
            const isSelected = i === selectedAnswer;
            const style = isSelected
              ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
              : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={`flex w-full items-start gap-3 rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-current text-xs font-medium">
                  {CHOICE_LABELS4[i]}
                </span>
                <span className="leading-relaxed">{choice}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ==================== リーディング：各Partの表示 ====================

function GrammarView({
  item,
  selectedAnswer,
  onSelect,
}: {
  item: GrammarQuestion;
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 5 ・ 短文穴埋め問題
        </p>
        <p className="mt-3 text-lg leading-relaxed text-(--color-ink)">{item.question}</p>
      </div>
      <div className="mt-5 space-y-2.5">
        {item.choices.map((choice, i) => {
          const isSelected = i === selectedAnswer;
          const style = isSelected
            ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
            : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${style}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Part6View({
  passage,
  answers,
  onSelect,
}: {
  passage: Part6Passage;
  answers: Record<string, number>;
  onSelect: (blankId: string, choice: number) => void;
}) {
  const passageParts = passage.passage.split(/(\(\d\))/);
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6">
        <p className="text-xs font-medium tracking-wide text-(--color-muted)">
          Part 6 ・ 長文穴埋め問題
        </p>
        <p className="mt-2 text-xs text-(--color-muted)">{passage.title}</p>
        <div className="mt-3 whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passageParts.map((part, i) =>
            /^\(\d\)$/.test(part) ? (
              <span
                key={i}
                className="mx-0.5 rounded-sm bg-(--color-gold-soft) px-1.5 py-0.5 font-medium text-(--color-ink)"
              >
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {passage.blanks.map((blank, bi) => {
          const selected = answers[blank.id];
          return (
            <div
              key={blank.id}
              className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4"
            >
              <p className="text-sm font-medium text-(--color-ink)">空欄 ({bi + 1})</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {blank.choices.map((choice, i) => {
                  const isSelected = i === selected;
                  const style = isSelected
                    ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                    : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
                  return (
                    <button
                      key={i}
                      onClick={() => onSelect(blank.id, i)}
                      className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${style}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ReadingView({
  passage,
  question,
  selectedAnswer,
  onSelect,
}: {
  passage: ReadingPassage;
  question: ReadingPassage["questions"][number];
  selectedAnswer: number | undefined;
  onSelect: (choice: number) => void;
}) {
  return (
    <>
      <div className="rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        {(passage.type === "double" || passage.type === "triple") && (
          <span className="mb-2 inline-block rounded-sm bg-(--color-paper) px-2 py-0.5 text-[10px] font-medium text-(--color-muted)">
            {passage.type === "triple" ? "3つの文書" : "2つの文書"}
          </span>
        )}
        <p className="text-xs font-medium text-(--color-muted)">{passage.title}</p>
        <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
          {passage.passage}
        </div>
        {(passage.type === "double" || passage.type === "triple") && passage.passage2 && (
          <>
            <p className="mt-4 text-xs font-medium text-(--color-muted)">{passage.title2}</p>
            <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
              {passage.passage2}
            </div>
          </>
        )}
        {passage.type === "triple" && passage.passage3 && (
          <>
            <p className="mt-4 text-xs font-medium text-(--color-muted)">{passage.title3}</p>
            <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-line border-t border-(--color-line) pt-3 text-sm leading-relaxed text-(--color-ink-soft)">
              {passage.passage3}
            </div>
          </>
        )}
      </div>
      <div className="mt-5 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
        <p className="text-base leading-relaxed text-(--color-ink)">{question.question}</p>
        <div className="mt-4 space-y-2.5">
          {question.choices.map((choice, i) => {
            const isSelected = i === selectedAnswer;
            const style = isSelected
              ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
              : "border-(--color-line) bg-(--color-paper-raised) text-(--color-ink)";
            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition-colors ${style}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ==================== 汎用アイコン ====================

function PlayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.68-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "#C9932C" : "none"}
      stroke={filled ? "#C9932C" : "#8891AC"}
      strokeWidth="1.8"
    >
      <path
        d="M5 3v18M5 4h11l-2.5 3L16 10H5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

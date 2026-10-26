// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { Stopwatch, useStopwatch } from "../../src/lib/stopwatch";
import type { AnswerEvent, ProgressRecord } from "../../src/types";
import { makeAnswerEvent, sanitizeAnswerHistory, timeStats } from "../../src/lib/history";
import { loadData, recordAnswer } from "../../src/lib/storage";
import { updateProgress } from "../../src/lib/spacedRepetition";

describe("ストップウォッチ", () => {
  const clock = () => { let t = 0; return { now: () => t, advance: (ms: number) => { t += ms; } }; };
  it("経過時間を数え、止めている間は数えない", () => {
    const c = clock(); const w = new Stopwatch(c.now);
    c.advance(3000); expect(w.elapsedMs()).toBe(3000);
    w.pause(); c.advance(10000); expect(w.elapsedMs()).toBe(3000);
    w.resume(); c.advance(2000); expect(w.elapsedMs()).toBe(5000);
  });
  it("止めたまま・動かしたままの二重の操作では、時間が狂わない", () => {
    const c = clock(); const w = new Stopwatch(c.now);
    w.resume(); c.advance(1000); w.pause(); w.pause(); c.advance(500); w.resume(); w.resume(); c.advance(1000);
    expect(w.elapsedMs()).toBe(2000);
  });
  it("リセットすると0から数え直す。止めた状態から始めることもできる", () => {
    const c = clock(); const w = new Stopwatch(c.now);
    c.advance(4000); w.reset(); expect(w.elapsedMs()).toBe(0);
    c.advance(1500); expect(w.elapsedMs()).toBe(1500);
    w.reset(false); c.advance(9000); expect(w.elapsedMs()).toBe(0);
  });
  it("秒は四捨五入で、履歴に残せる上限（3599秒）を超えない", () => {
    const c = clock(); const w = new Stopwatch(c.now);
    c.advance(1499); expect(w.elapsedSec()).toBe(1);
    c.advance(1); expect(w.elapsedSec()).toBe(2);
    c.advance(10_000_000); expect(w.elapsedSec()).toBe(3599);
  });
});

describe("useStopwatch（画面が隠れている間は数えない・問題が変わると数え直す）", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
  function Probe({ k, sink }: { k: string; sink: { current: Stopwatch | null } }) { sink.current = useStopwatch(k); return null; }
  const setHidden = (hidden: boolean) => act(() => { Object.defineProperty(document, "hidden", { configurable: true, value: hidden }); document.dispatchEvent(new Event("visibilitychange")); });

  it("タブを隠している間は止まり、戻ると再開する", () => {
    vi.useFakeTimers();
    const sink = { current: null as Stopwatch | null };
    render(<Probe k="q1" sink={sink} />);
    vi.advanceTimersByTime(2000);
    setHidden(true); vi.advanceTimersByTime(60_000);
    expect(sink.current!.elapsedMs()).toBe(2000);
    setHidden(false); vi.advanceTimersByTime(1000);
    expect(sink.current!.elapsedMs()).toBe(3000);
  });
  it("キーが変わる（次の問題になる）と、0から数え直す", () => {
    vi.useFakeTimers();
    const sink = { current: null as Stopwatch | null };
    const { rerender } = render(<Probe k="q1" sink={sink} />);
    vi.advanceTimersByTime(5000);
    rerender(<Probe k="q2" sink={sink} />);
    expect(sink.current!.elapsedMs()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(sink.current!.elapsedMs()).toBe(1000);
  });
});

const rec = (id: string, o: Partial<ProgressRecord> = {}): ProgressRecord => ({ itemId: id, itemType: "grammar", itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0, nextReviewDate: "2026-10-10", lastAnsweredAt: "2026-10-09T01:00:00.000Z", isCorrect: true, ...o });

describe("解答時間の履歴", () => {
  it("秒数を測った解答は6要素、測っていない解答は従来どおり5要素", () => {
    expect(makeAnswerEvent(rec("g1", { lastElapsedSec: 14 })).length).toBe(6);
    expect(makeAnswerEvent(rec("g1", { lastElapsedSec: 14 }))[5]).toBe(14);
    expect(makeAnswerEvent(rec("g1")).length).toBe(5);
  });
  it("読み込み時、5要素（旧い履歴）も6要素も受け入れ、不正な秒数の件は捨てる", () => {
    const five = ["a", 1, 600, 1000, 1], six = ["b", 1, 600, 1000, 0, 12];
    expect(sanitizeAnswerHistory([five, six])).toEqual([five, six]);
    expect(sanitizeAnswerHistory([["c", 1, 600, 1000, 1, -1], ["d", 1, 600, 1000, 1, 4000], ["e", 1, 600, 1000, 1, 1.5], ["f", 1, 600, 1000, 1, "9"], ["g", 1, 600, 1000, 1, 5, 6]])).toEqual([]);
  });
  it("保存すると、解答時間も履歴に残る", () => {
    localStorage.clear();
    let d = loadData();
    d = recordAnswer(d, { ...updateProgress("g1", "grammar", 600, true, undefined), lastElapsedSec: 17 });
    expect(loadData().answerHistory[0][5]).toBe(17);
  });
});

describe("解答時間の集計（timeStats）", () => {
  const ev = (type: number, correct: 0 | 1, sec?: number): AnswerEvent => (sec === undefined ? ["x", type, 600, 1000, correct] : ["x", type, 600, 1000, correct, sec]);
  it("測った解答が無ければ null", () => {
    expect(timeStats([], "grammar")).toBeNull();
    expect(timeStats([ev(1, 1)], "grammar")).toBeNull();            // 測っていない解答だけ
    expect(timeStats([ev(0, 1, 9)], "grammar")).toBeNull();         // 別の種別（単語）だけ
  });
  it("中央値（奇数・偶数）、目安時間内の割合、「遅いが正解」を数える", () => {
    const h = [ev(1, 1, 10), ev(1, 1, 30), ev(1, 0, 40), ev(1, 1, 20), ev(1, 0, 15)];   // 並べ替えると 10,15,20,30,40
    const s = timeStats(h, "grammar", 20)!;
    expect([s.n, s.medianSec, s.withinShare, s.slowCorrect]).toEqual([5, 20, 0.6, 1]);   // 30秒の正解が1問
    expect(timeStats([...h, ev(1, 1, 50)], "grammar", 20)!.medianSec).toBe(25);          // 偶数個：20 と 30 の平均
  });
  it("直近 window 件だけを使い、測っていない解答は数えない", () => {
    const h = [ev(1, 1, 100), ev(1, 1), ev(1, 1, 10), ev(1, 1, 12)];
    expect(timeStats(h, "grammar", 20, 2)).toMatchObject({ n: 2, medianSec: 11 });
  });
});

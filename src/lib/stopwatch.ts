import { useEffect, useState } from "react";

/**
 * ストップウォッチ（2.1.33）。画面が見えている間だけ時間を数える（別のアプリに切り替えている間は止める）。
 * 時計は差し替えられる（テスト用）。
 */
export class Stopwatch {
  private acc = 0;
  private since: number | null;
  private readonly now: () => number;

  constructor(now: () => number = Date.now, running = true) {
    this.now = now;
    this.since = running ? now() : null;
  }

  pause(): void {
    if (this.since !== null) {
      this.acc += this.now() - this.since;
      this.since = null;
    }
  }

  resume(): void {
    if (this.since === null) this.since = this.now();
  }

  /** 0から数え直す */
  reset(running = true): void {
    this.acc = 0;
    this.since = running ? this.now() : null;
  }

  elapsedMs(): number {
    return this.acc + (this.since !== null ? this.now() - this.since : 0);
  }

  /** 経過秒（四捨五入）。履歴に残せる上限（3599秒）を超えない */
  elapsedSec(): number {
    return Math.min(3599, Math.round(this.elapsedMs() / 1000));
  }
}

/**
 * 問題ごとのストップウォッチ。resetKey（問題のIDなど）が変わるたびに0から数え直す。
 * 画面が隠れている間（タブの切り替え・アプリの切り替え）は数えない。
 */
export function useStopwatch(resetKey: string | number): Stopwatch {
  const [watch] = useState(() => new Stopwatch(Date.now, !document.hidden));

  useEffect(() => {
    watch.reset(!document.hidden);
    const onVisibility = () => (document.hidden ? watch.pause() : watch.resume());
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [watch, resetKey]);

  return watch;
}

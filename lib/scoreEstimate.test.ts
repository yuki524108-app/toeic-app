import { describe, it, expect } from "vitest";
import { estimateScore } from "../../src/lib/scoreEstimate";
import type { ItemType, ProgressRecord } from "../../src/types";

/** 解答の履歴を作る。n は解答の順番（大きいほど新しい） */
let seq = 0;
function rec(itemType: ItemType, isCorrect: boolean, level = 600): ProgressRecord {
  seq++;
  return {
    itemId: `${itemType}-${seq}`, itemType, itemLevel: level, easeFactor: 2.5, interval: 1, repetitions: 1,
    nextReviewDate: "2099-01-01",
    lastAnsweredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(), // seq の順に新しくなる
    isCorrect,
  };
}
function progress(...groups: ProgressRecord[][]): Record<string, ProgressRecord> {
  return Object.fromEntries(groups.flat().map((r) => [r.itemId, r]));
}
const many = (n: number, type: ItemType, correct: (i: number) => boolean) =>
  Array.from({ length: n }, (_, i) => rec(type, correct(i)));
const reading = (p: Record<string, ProgressRecord>) => estimateScore(p).reading;

describe("予想スコア（リーディング）: 自己判定の単語の扱い", () => {
  it("採点された問題（文法・読解・Part 6）が20件以上あれば、単語は算入しない", () => {
    // 文法25問は正答率50%。単語25問は全問「わかる」。単語を含めると75%になってしまう
    const p = progress(many(25, "grammar", (i) => i % 2 === 0), many(25, "word", () => true));
    const r = reading(p);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.accuracy).toBeCloseTo(13 / 25, 5);   // 文法だけの正答率(13/25)。単語は見ない
    expect(r.sampleSize).toBe(25);
    expect(r.provisional).toBe(false);
  });

  it("採点された問題が20件以上あれば、単語がどれだけ増えても値は変わらない", () => {
    const graded = many(25, "grammar", (i) => i % 2 === 0);
    const a = reading(progress(graded));
    const b = reading(progress(graded, many(200, "word", () => true)));
    const c = reading(progress(graded, many(200, "word", () => false)));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("文法・読解・Part 6はまとめて数える（合計20件で足りる）", () => {
    const p = progress(many(8, "grammar", () => true), many(6, "reading", () => true), many(6, "part6", () => true));
    const r = reading(p);
    expect(r.status === "ok" && r.provisional === false && r.sampleSize === 20).toBe(true);
  });

  it("採点された問題が足りないときは、単語を含めた暫定値になる（初回模試：単語15問＋文法15問）", () => {
    const p = progress(many(15, "word", () => true), many(15, "grammar", (i) => i < 9));
    const r = reading(p);
    expect(r.status).toBe("ok");   // 初回模試の直後でも、スコアは表示される（導入が壊れない）
    if (r.status !== "ok") return;
    expect(r.provisional).toBe(true);
    expect(r.sampleSize).toBe(30);
    expect(r.accuracy).toBeCloseTo((15 + 9) / 30, 5);
  });

  it("採点された問題が20件にたまると、暫定値から単語を除いた値に切り替わる（19件→20件）", () => {
    const words = many(15, "word", () => true);
    const g19 = many(19, "grammar", () => false);
    const before = reading(progress(words, g19));
    expect(before.status === "ok" && before.provisional).toBe(true);
    const after = reading(progress(words, g19, [rec("grammar", false)]));
    expect(after.status === "ok" && after.provisional === false).toBe(true);
    if (before.status === "ok" && after.status === "ok") expect(after.score).toBeLessThan(before.score);
  });

  it("単語を含めても合計が20件に満たなければ、データ不足（解答数を返す）", () => {
    const r = reading(progress(many(10, "word", () => true), many(5, "grammar", () => true)));
    expect(r).toEqual({ status: "insufficient-data", answeredCount: 15, needed: 20 });
  });

  it("単語だけを大量に解いても、リーディングの値は『暫定』のまま（採点された問題がないため）", () => {
    const r = reading(progress(many(60, "word", () => true)));
    expect(r.status === "ok" && r.provisional).toBe(true);
  });

  it("直近50問は、採点された問題だけで数える（古い解答は含めない）", () => {
    // 古い30問は全問不正解、新しい50問は全問正解 → 直近50問の正答率は100%
    const p = progress(many(30, "grammar", () => false), many(50, "reading", () => true));
    const r = reading(p);
    expect(r.status === "ok" && r.accuracy === 1 && r.sampleSize === 50).toBe(true);
  });
});

describe("予想スコア: リスニングと合計", () => {
  it("リスニングは従来どおり（単語の影響を受けず、暫定にもならない）", () => {
    const l = estimateScore(progress(many(25, "listeningPart2", (i) => i % 2 === 0), many(100, "word", () => true))).listening;
    expect(l.status).toBe("ok");
    if (l.status === "ok") { expect(l.accuracy).toBeCloseTo(13 / 25, 5); expect(l.provisional).toBe(false); }
  });

  it("合計は、リーディングが暫定の間は暫定として返る", () => {
    const e = estimateScore(progress(many(15, "word", () => true), many(15, "grammar", () => true), many(25, "listeningPart1", () => true)));
    expect(e.total.status === "ok" && e.total.provisional).toBe(true);
  });

  it("合計は、リーディングが採点された問題だけで算出できるなら暫定ではない", () => {
    const e = estimateScore(progress(many(25, "grammar", () => true), many(25, "listeningPart1", () => true)));
    expect(e.total.status === "ok" && e.total.provisional === false).toBe(true);
  });

  it("リーディングかリスニングのどちらかが足りなければ、合計はデータ不足", () => {
    const e = estimateScore(progress(many(25, "grammar", () => true)));
    expect(e.total.status).toBe("insufficient-data");
  });
});

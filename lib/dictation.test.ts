import { describe, it, expect } from "vitest";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import type { ListeningPart1Item, ListeningPart2Question, ListeningPart34Set } from "../../src/types";
import { DICTATION_COUNT, DICTATION_LENGTHS, buildDictationPool, diffWords, pickLines, wordCount } from "../../src/lib/dictation";
import type { DictationLine } from "../../src/lib/dictation";

const seq = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const real = () => buildDictationPool({ part1: part1 as ListeningPart1Item[], part2: part2 as ListeningPart2Question[], part34: part34 as ListeningPart34Set[] });
const line = (id: string, n: number): DictationLine => ({ id, text: Array.from({ length: n }, (_, i) => `w${i}`).join(" "), source: "Part 2" });

describe("英文の収集", () => {
  it("単語数は空白で区切って数える", () => {
    expect(wordCount("  Hi Karen,   do you have a minute? ")).toBe(7);
    expect(wordCount("")).toBe(0);
  });
  it("Part 1の正解の描写文・Part 2の設問と正解の応答・Part 3/4の発言から、5語以上の英文だけを集める", () => {
    const pool = real();
    expect(pool.length).toBeGreaterThan(300);
    expect(pool.every((l) => wordCount(l.text) >= 5)).toBe(true);
    expect(new Set(pool.map((l) => l.source))).toEqual(new Set(["Part 1", "Part 2", "Part 3", "Part 4"]));
  });
  it("同じ英文は1つにまとめ、IDも重複しない。Part 3/4の発言には和訳が付く", () => {
    const pool = real();
    expect(new Set(pool.map((l) => l.text.toLowerCase())).size).toBe(pool.length);
    expect(new Set(pool.map((l) => l.id)).size).toBe(pool.length);
    const p3 = pool.filter((l) => l.source === "Part 3");
    expect(p3.filter((l) => l.ja).length / p3.length).toBeGreaterThan(0.9);
  });
  it("Part 1は正解の描写文だけを使う（誤りの選択肢は使わない）", () => {
    const pool = real();
    const wrong = (part1 as ListeningPart1Item[]).flatMap((p) => p.choices.filter((_, i) => i !== p.answer));
    const texts = new Set(pool.filter((l) => l.source === "Part 1").map((l) => l.text));
    expect(wrong.filter((w) => texts.has(w) && !(part1 as ListeningPart1Item[]).some((p) => p.choices[p.answer] === w))).toEqual([]);
  });
  it("3つの長さそれぞれに、5文以上選べるだけの英文がある（実データ）", () => {
    const pool = real();
    for (const l of DICTATION_LENGTHS) {
      expect(pool.filter((x) => wordCount(x.text) >= l.min && wordCount(x.text) <= l.max).length).toBeGreaterThanOrEqual(DICTATION_COUNT);
    }
  });
});

describe("英文の選び方", () => {
  const pool = [...Array.from({ length: 8 }, (_, i) => line(`s${i}`, 6)), ...Array.from({ length: 8 }, (_, i) => line(`m${i}`, 11)), ...Array.from({ length: 2 }, (_, i) => line(`l${i}`, 15))];
  it("指定した長さの範囲の英文を、重複なく指定の本数だけ選ぶ", () => {
    for (const [len, min, max] of [["short", 5, 8], ["mid", 9, 13]] as const) {
      const r = pickLines(pool, len, 5, seq());
      expect(r.length).toBe(5);
      expect(new Set(r.map((x) => x.id)).size).toBe(5);
      expect(r.every((x) => wordCount(x.text) >= min && wordCount(x.text) <= max)).toBe(true);
    }
  });
  it("その長さの英文が足りなければ、近い長さのもので補う", () => {
    const r = pickLines(pool, "long", 5, seq());
    expect(r.length).toBe(5);
    expect(r.filter((x) => wordCount(x.text) >= 14).length).toBe(2);
    expect(r.filter((x) => wordCount(x.text) === 11).length).toBe(3);   // 長めに近い「ふつう」で補う
  });
  it("乱数が違えば選ばれる英文も変わり、同じ乱数なら同じになる", () => {
    const a = pickLines(pool, "short", 5, seq(1)).map((x) => x.id).join();
    expect(pickLines(pool, "short", 5, seq(1)).map((x) => x.id).join()).toBe(a);
    expect(new Set(Array.from({ length: 10 }, (_, i) => pickLines(pool, "short", 5, seq(i + 1)).map((x) => x.id).join())).size).toBeGreaterThan(1);
  });
  it("英文が少なければ、あるだけ返す。空なら空", () => {
    expect(pickLines(pool.slice(0, 2), "short", 5, seq()).length).toBe(2);
    expect(pickLines([], "short", 5, seq())).toEqual([]);
  });
});

describe("答え合わせ（単語ごとの突き合わせ）", () => {
  const T = "Could you send me the report by Friday afternoon?";
  const status = (typed: string) => diffWords(T, typed).tokens.map((t) => (t.status === "ok" ? "o" : "x")).join("");
  it("完全に聞き取れていれば100%。大文字小文字・記号・前後の空白は区別しない", () => {
    const d = diffWords(T, "  could you SEND me the report by friday afternoon  ");
    expect([d.matched, d.total, d.accuracy, d.extra]).toEqual([9, 9, 1, []]);
  });
  it("途中の1語が抜けても、そのあとの単語はずれずに聞き取れたと判定する", () => {
    // 「report」（6番目）だけが聞き取れず、7番目以降（by Friday afternoon）はずれずに聞き取れた
    expect(status("Could you send me the by Friday afternoon")).toBe("oooooxooo");
  });
  it("聞き取れなかった単語を示し、余分に入力した単語は別に集める", () => {
    const d = diffWords(T, "Could you send me the paper by Friday afternoon");
    expect(d.tokens.filter((t) => t.status === "missing").map((t) => t.word)).toEqual(["report"]);
    expect(d.extra).toEqual(["paper"]);
    expect(d.matched).toBe(8);
  });
  it("入力が空なら0%（全部が聞き取れなかった）", () => {
    const d = diffWords(T, "");
    expect([d.matched, d.accuracy, d.tokens.every((t) => t.status === "missing")]).toEqual([0, 0, true]);
  });
  it("同じ単語が複数回ある英文でも、数が合うぶんだけ聞き取れたとする", () => {
    const d = diffWords("I think that that is right", "I think that is right");
    expect([d.matched, d.total]).toEqual([5, 6]);
  });
  it("don't のようなアポストロフィ入りの語や、アクセント記号は区別しない。単独の記号は数えない", () => {
    expect(diffWords("I don’t know — résumé", "i don't know resume").accuracy).toBe(1);
    expect(diffWords("Well — okay", "well okay").total).toBe(2);
  });
  it("順番が入れ替わった単語は、順序の合うぶんだけ聞き取れたとする", () => {
    const d = diffWords("one two three", "three two one");
    expect(d.matched).toBe(1);
  });
});

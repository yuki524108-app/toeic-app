import { describe, it, expect } from "vitest";
import grammar from "../../src/data/grammar.json";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";
import words from "../../src/data/words.json";

/**
 * 問題データ（src/data/*.json）の整合性。
 * 選択肢の入れ替え（tools/rebalance_choices.py）や問題の追加・生成データの取り込み後に、
 * 偏りや壊れた問題が混ざっていないことを確かめる。
 */
type Q = {
  id: string;
  choices: string[];
  answer: number;
  explanation?: string;
};

const GROUPS: Record<string, Q[]> = {
  文法: grammar as Q[],
  "Part 1": part1 as Q[],
  "Part 2": part2 as Q[],
  "Part 3・4": (part34 as { questions: Q[] }[]).flatMap((s) => s.questions),
  "Part 6": (part6 as { blanks: Q[] }[]).flatMap((p) => p.blanks),
  読解: (readings as { questions: Q[] }[]).flatMap((p) => p.questions),
};

const LETTERS = "ABCD";

/** 数値が昇順に並んだ選択肢は、慣例に合わせて並べ替えない（tools/rebalance_choices.py と同じ判定） */
function isOrdered(choices: string[]): boolean {
  const nums = choices.map((c) => c.match(/\d[\d,.]*/));
  if (nums.some((n) => n === null)) return false;
  const values = nums.map((n) => parseFloat((n as RegExpMatchArray)[0].replace(/,/g, "")));
  if (values.some(Number.isNaN)) return false;
  return values.every((v, i) => i === 0 || v > values[i - 1]);
}

describe("問題データの整合性", () => {
  it("設問IDは全体で重複しない", () => {
    const ids = [
      ...Object.values(GROUPS).flatMap((qs) => qs.map((q) => q.id)),
      ...(words as { id: string }[]).map((w) => w.id),
    ];
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  describe.each(Object.entries(GROUPS))("%s", (_name, qs) => {
    it("正解番号が選択肢の範囲内にある", () => {
      const bad = qs.filter((q) => !(q.answer >= 0 && q.answer < q.choices.length));
      expect(bad.map((q) => q.id)).toEqual([]);
    });

    it("選択肢に重複がない（同じ文言が2つあると、正誤が決まらない）", () => {
      const bad = qs.filter(
        (q) => new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== q.choices.length
      );
      expect(bad.map((q) => `${q.id}: ${JSON.stringify(q.choices)}`)).toEqual([]);
    });

    it("正解の位置が偏っていない（どの位置も均等からほぼ外れない）", () => {
      const k = qs[0].choices.length;
      const counts = Array<number>(k).fill(0);
      qs.forEach((q) => counts[q.answer]++);
      const fixed = qs.filter((q) => isOrdered(q.choices)).length; // 並べ替えない問題の分は、ずれを許す
      const spread = Math.max(...counts) - Math.min(...counts);
      expect(spread, `位置ごとの件数: ${counts.join(" / ")}`).toBeLessThanOrEqual(Math.max(2, fixed));
    });
  });

  describe("解説の正解の記号が、実際の正解と一致している（文法・Part 1・Part 2）", () => {
    const HEAD = /^\[正解\] \(([A-D])\)/m;

    it.each([["文法"], ["Part 1"], ["Part 2"]])("%s: [正解] (記号) が正解番号と一致", (name) => {
      const bad = GROUPS[name].filter((q) => {
        const m = (q.explanation ?? "").match(HEAD);
        return !m || LETTERS.indexOf(m[1]) !== q.answer;
      });
      expect(bad.map((q) => q.id)).toEqual([]);
    });

    it("Part 1: 解説の「(記号) 英文」の行が、その記号の選択肢と同じ文になっている", () => {
      const bad: string[] = [];
      for (const q of GROUPS["Part 1"]) {
        for (const m of (q.explanation ?? "").matchAll(/^(?:\[正解\] )?\(([A-D])\) (.+)$/gm)) {
          if (q.choices[LETTERS.indexOf(m[1])] !== m[2].trim()) bad.push(`${q.id} (${m[1]})`);
        }
      }
      expect(bad).toEqual([]);
    });

    it("Part 2: 解説の正解の文が、正解の選択肢と同じ文になっている", () => {
      const bad = GROUPS["Part 2"].filter((q) => {
        const m = (q.explanation ?? "").match(/^\[正解\] \([A-D]\) (.+)$/m);
        return !m || m[1].trim() !== q.choices[q.answer];
      });
      expect(bad.map((q) => q.id)).toEqual([]);
    });
  });
});

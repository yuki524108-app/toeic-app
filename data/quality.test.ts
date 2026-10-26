import { describe, it, expect } from "vitest";
import grammar from "../../src/data/grammar.json";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";

/**
 * 問題データの品質（機械的に確かめられるもの）。詳しい検査は tools/quality/check.py。
 * ここでは、見つかった欠陥が再び入らないよう、確実に誤りと言えるものだけを守る。
 */
type MC = { id: string; choices: string[]; answer: number; question?: string; explanation?: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

const GRAMMAR = grammar as (MC & { question: string; explanation: string })[];
const PART2 = part2 as (MC & { question: string })[];
const ALL: Record<string, MC[]> = {
  文法: GRAMMAR,
  "Part 1": part1 as MC[],
  "Part 2": PART2,
  "Part 3・4": (part34 as { questions: MC[] }[]).flatMap((s) => s.questions),
  "Part 6": (part6 as { blanks: MC[] }[]).flatMap((p) => p.blanks),
  読解: (readings as { questions: MC[] }[]).flatMap((p) => p.questions),
};

describe("Part 6：解説が述べる正解が、登録された正解と食い違っていない", () => {
  // 「〇〇 が正解です」と書かれた語が選択肢にあるなら、それは登録された正解でなければならない。
  // （是正前は、登録された正解が文法的に誤り、解説のほうが正しい問題が13問あった）
  const pat = /([A-Za-z][A-Za-z' \-/]*?)\s*が(?:正解|適切|最も適切|入ります|適して)/g;
  const blanks = (part6 as { blanks: (MC & { explanationDetail: string })[] }[]).flatMap((p) => p.blanks);
  it("explanation / explanationDetail", () => {
    const bad: string[] = [];
    for (const b of blanks) {
      const ans = b.choices[b.answer].toLowerCase();
      const lower = b.choices.map((c) => c.toLowerCase());
      for (const text of [b.explanation ?? "", b.explanationDetail]) {
        const claimed = [...text.matchAll(pat)].map((m) => m[1].trim().toLowerCase()).filter((w) => lower.includes(w));
        if (claimed.length > 0 && !claimed.includes(ans)) bad.push(`${b.id}: 正解 ${ans} / 解説 ${claimed.join(",")}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe.each(Object.entries(ALL))("選択肢の整合: %s", (_name, qs) => {
  it("正解番号が範囲内で、選択肢に空欄・重複がない（ハイフンの違いも別の選択肢として数える）", () => {
    const bad = qs.filter(
      (q) =>
        q.answer < 0 ||
        q.answer >= q.choices.length ||
        q.choices.some((c) => !c.trim()) ||
        new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== q.choices.length
    );
    expect(bad.map((q) => q.id)).toEqual([]);
  });
});

describe("文法問題の正しさ", () => {
  it("空欄（___）がちょうど1つある", () => {
    expect(GRAMMAR.filter((q) => q.question.split("___").length !== 2).map((q) => q.id)).toEqual([]);
  });

  it("解説の「完成文」が、問題文の空欄に正解を入れた文と一致する", () => {
    const bad = GRAMMAR.filter((q) => {
      const m = q.explanation.match(/完成文:\s*(.+)/);
      return !m || norm(m[1]) !== norm(q.question.replace("___", q.choices[q.answer]));
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("解説の「[正解] (X) ～」が、正解の記号・選択肢と一致する", () => {
    const bad = [...GRAMMAR, ...PART2].filter((q) => {
      const m = (q.explanation ?? "").match(/\[正解\]\s*\(([A-D])\)\s*(.+)/);
      return !m || "ABCD".indexOf(m[1]) !== q.answer || norm(m[2]) !== norm(q.choices[q.answer]);
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("完成文に「in next fall」のような非文がない（next / last / this の前に in・on・at は置かない）", () => {
    const re = /\b(in|on|at)\s+(next|last|this)\s+(week|month|year|quarter|spring|summer|fall|autumn|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?!\s*['’]s)/i;
    const bad = GRAMMAR.filter((q) => re.test(q.explanation.match(/完成文:\s*(.+)/)?.[1] ?? ""));
    expect(bad.map((q) => q.id)).toEqual([]);
  });
});

describe("重複する問題がない", () => {
  // 文脈に依存しない問題（文法・Part 2）は、問題文と正解の両方が同じなら完全な重複。
  // Part 3・4と読解は「Why is the man calling?」のように設問文が同じでも会話・文書が違えば別の問題なので対象外。
  const dup = (items: (MC & { question: string })[]) => {
    const seen = new Map<string, string>();
    const out: string[] = [];
    for (const q of items) {
      const key = norm(q.question) + "|" + norm(q.choices[q.answer]);
      if (seen.has(key)) out.push(`${seen.get(key)}=${q.id}`);
      else seen.set(key, q.id);
    }
    return out;
  };
  it("文法", () => expect(dup(GRAMMAR)).toEqual([]));
  it("Part 2", () => expect(dup(PART2)).toEqual([]));
});

describe("正解が「一番長い選択肢」に偏っていない（長さが手がかりにならない）", () => {
  // 正解が唯一の最長になる割合。偏りがなければ、選択肢4つなら25%、3つなら33%。
  // 是正前は Part 1が71%、Part 2が61%、Part 3・4が59%、読解が57%だった。是正済みの分野を守る。
  const uniqueLongestShare = (qs: MC[]) =>
    qs.filter((q) => {
      const len = q.choices.map((c) => c.length).sort((a, b) => b - a);
      return q.choices[q.answer].length === len[0] && len[0] > len[1];
    }).length / qs.length;

  it("Part 1：正解が唯一の最長になる割合が35%以下（偶然の水準は25%）", () => {
    expect(uniqueLongestShare(ALL["Part 1"])).toBeLessThanOrEqual(0.35);
  });

  it("Part 2：正解が唯一の最長になる割合が43%以下（偶然の水準は33%）", () => {
    expect(uniqueLongestShare(ALL["Part 2"])).toBeLessThanOrEqual(0.43);
  });

  it("Part 3・4：正解が唯一の最長になる割合が35%以下（偶然の水準は25%。是正前は59%）", () => {
    expect(uniqueLongestShare(ALL["Part 3・4"])).toBeLessThanOrEqual(0.35);
  });

  it("Part 3・4：正解が最短の選択肢になる割合も偏っていない（12%以上）", () => {
    const qs = ALL["Part 3・4"];
    const share =
      qs.filter((q) => {
        const len = q.choices.map((c) => c.length).sort((a, b) => a - b);
        return q.choices[q.answer].length === len[0] && len[0] < len[1];
      }).length / qs.length;
    expect(share).toBeGreaterThanOrEqual(0.12);
  });

  it("読解：正解が唯一の最長になる割合が35%以下（偶然の水準は25%。是正前は57%）", () => {
    expect(uniqueLongestShare(ALL["読解"])).toBeLessThanOrEqual(0.35);
  });

  it("読解：正解が最短の選択肢になる割合も偏っていない（12%以上）", () => {
    const qs = ALL["読解"];
    const share =
      qs.filter((q) => {
        const len = q.choices.map((c) => c.length).sort((a, b) => a - b);
        return q.choices[q.answer].length === len[0] && len[0] < len[1];
      }).length / qs.length;
    expect(share).toBeGreaterThanOrEqual(0.12);
  });

  it("Part 1：正解が最短の選択肢になる割合も偏っていない（15%以上）", () => {
    const qs = ALL["Part 1"];
    const share =
      qs.filter((q) => {
        const len = q.choices.map((c) => c.length).sort((a, b) => a - b);
        return q.choices[q.answer].length === len[0] && len[0] < len[1];
      }).length / qs.length;
    expect(share).toBeGreaterThanOrEqual(0.15);
  });

  it("Part 2：正解が最短の選択肢になる割合も偏っていない（20%以上）", () => {
    const qs = ALL["Part 2"];
    const share =
      qs.filter((q) => {
        const len = q.choices.map((c) => c.length).sort((a, b) => a - b);
        return q.choices[q.answer].length === len[0] && len[0] < len[1];
      }).length / qs.length;
    expect(share).toBeGreaterThanOrEqual(0.2);
  });
});

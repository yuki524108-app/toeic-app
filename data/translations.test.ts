import { describe, it, expect } from "vitest";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";
import words from "../../src/data/words.json";

/**
 * 和訳・詳細解説が、現在の選択肢の並びと食い違っていないこと。
 * 並べ替え（tools/rebalance_choices.py）の前の順で作った choicesJa や、
 * 解説中の「(B)」「選択肢C」が取り残されると、英語と日本語が違う選択肢を指してしまう。
 */
type Q = {
  id: string;
  choices: string[];
  answer: number;
  choicesJa?: string[];
  explanationDetail?: string;
};

const GROUPS: Record<string, Q[]> = {
  "Part 3・4": (part34 as { questions: Q[] }[]).flatMap((s) => s.questions),
  "Part 6": (part6 as { blanks: Q[] }[]).flatMap((p) => p.blanks),
  読解: (readings as { questions: Q[] }[]).flatMap((p) => p.questions),
};

const LETTERS = "ABCD";
// 解説の中で「正解の記号」を示す定型表現（tools/rebalance_choices.py と同じ）
const ANSWER_PATTERNS = [/選択肢([A-D])[）)]?が正解/, /[(（]([A-D])[)）][^、。]{0,40}が正解/];

/** 文字列中の数字の並び（"$127.50" → "127.50"、"3月1日" → "3"）。カンマは除く */
function numbers(s: string): string[] {
  return (s.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).slice().sort();
}

describe.each(Object.entries(GROUPS))("和訳と選択肢の対応: %s", (_name, qs) => {
  it("choicesJa は選択肢と同じ数", () => {
    const bad = qs.filter((q) => q.choicesJa && q.choicesJa.length !== q.choices.length);
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("詳細解説が示す正解の記号は、正解番号と一致する", () => {
    const bad = qs.filter((q) => {
      for (const re of ANSWER_PATTERNS) {
        const m = (q.explanationDetail ?? "").match(re);
        if (m) return LETTERS.indexOf(m[1]) !== q.answer;
      }
      return false;
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("詳細解説の「（2番目）が正解」が、正解番号と一致する", () => {
    const bad = qs.filter((q) => {
      const m = (q.explanationDetail ?? "").match(/[（(]([1-4])番目[）)](?=が正解)/);
      return m ? Number(m[1]) - 1 !== q.answer : false;
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });

  it("数字を含む選択肢は、同じ位置の和訳にも同じ数字がある（順番のずれの検出）", () => {
    const bad = qs.filter((q) => {
      if (!q.choicesJa) return false;
      return q.choices.some((c, i) => {
        const en = numbers(c);
        // 同じ位置の和訳に、英語側と共通する数字が1つはあること。
        // 表記の違い（"February 15th" → "2月15日"、"2:00 PM" → "午後2時"、"9-to-5" → "9時〜17時"）で
        // 数字が増減するのは正常なので、完全一致や包含ではなく「共通の数字がある」で比べる。
        const ja = numbers(q.choicesJa![i]);
        return en.length > 0 && ja.length > 0 && !en.some((n) => ja.includes(n));
      });
    });
    expect(bad.map((q) => q.id)).toEqual([]);
  });
});

describe("詳細解説の取り込み状況", () => {
  it("読解の全文書に全訳と語彙がある", () => {
    const bad = (readings as { id: string; passageJa?: string; vocab?: string[] }[]).filter(
      (r) => !r.passageJa || !r.vocab?.length
    );
    expect(bad.map((r) => r.id)).toEqual([]);
  });

  it("読解の2つ目・3つ目の文書にも全訳がある", () => {
    const bad = (
      readings as { id: string; passage2?: string; passage2Ja?: string; passage3?: string; passage3Ja?: string }[]
    ).filter((r) => (r.passage2 && !r.passage2Ja) || (r.passage3 && !r.passage3Ja));
    expect(bad.map((r) => r.id)).toEqual([]);
  });

  it("単語は全語に品詞・例文の和訳がある", () => {
    const bad = (words as { id: string; pos?: string; exampleJa?: string }[]).filter(
      (w) => !w.pos || !w.exampleJa
    );
    expect(bad.map((w) => w.id)).toEqual([]);
  });
});

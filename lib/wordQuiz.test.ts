import { describe, it, expect } from "vitest";
import words from "../../src/data/words.json";
import type { Word } from "../../src/types";
import { buildMeaningChoices, checkSpelling, hasSharedMeaning, normalizeSpelling, spellingPattern } from "../../src/lib/wordQuiz";

const W = words as Word[];
// 種が小さくても偏らない乱数（mulberry32）。単純な線形合同法だと、小さい種では最初の出力がほぼ0になり、シャッフルが毎回同じになる
const seq = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const w = (id: string, word: string, meaning: string, o: Partial<Word> = {}): Word => ({ id, word, meaning, example: "", level: 600, ...o });

describe("スペルの比較用の整形", () => {
  it("大文字小文字・アクセント記号・アポストロフィ・空白の違いをならす", () => {
    expect(normalizeSpelling("  Résumé ")).toBe("resume");
    expect(normalizeSpelling("Maître d’")).toBe("maitre d'");
    expect(normalizeSpelling("office   SUPPLIES")).toBe("office supplies");
  });
});

describe("スペルの判定", () => {
  it("同じつづりは、大文字小文字やアクセント記号が違っても正解", () => {
    expect(checkSpelling("ACCOMMODATE", "accommodate")).toBe("correct");
    expect(checkSpelling("resume", "résumé")).toBe("correct");
    expect(checkSpelling("office  supplies", "office supplies")).toBe("correct");
  });
  it("1文字の置き換え・抜け・余分・隣り合う文字の入れ替えは「惜しい」（不正解扱い）", () => {
    expect(checkSpelling("acommodate", "accommodate")).toBe("near");     // 抜け
    expect(checkSpelling("accommodatte", "accommodate")).toBe("near");   // 余分
    expect(checkSpelling("accommodete", "accommodate")).toBe("near");    // 置き換え
    expect(checkSpelling("recieve", "receive")).toBe("near");            // 入れ替え
  });
  it("2文字以上違えば不正解。空の入力も不正解", () => {
    expect(checkSpelling("acomodate", "accommodate")).toBe("wrong");
    expect(checkSpelling("", "accommodate")).toBe("wrong");
    expect(checkSpelling("   ", "accommodate")).toBe("wrong");
    expect(checkSpelling("budget", "accommodate")).toBe("wrong");
  });
  it("短い単語（3文字以下）は1文字違うと別の単語になりやすいので、「惜しい」にせず不正解", () => {
    expect(checkSpelling("in", "an")).toBe("wrong");
    expect(checkSpelling("fee", "fed")).toBe("wrong");
  });
  it("全2,000語で、自分自身のつづりは正解になる", () => {
    expect(W.filter((x) => checkSpelling(x.word, x.word) !== "correct")).toEqual([]);
    expect(W.filter((x) => checkSpelling(x.word.toUpperCase(), x.word) !== "correct")).toEqual([]);
  });
});

describe("文字数の手がかり", () => {
  it("英数字を「_」にし、空白・記号は残す", () => {
    expect(spellingPattern("budget")).toBe("_ _ _ _ _ _");
    expect(spellingPattern("net 30")).toBe("_ _ _   _ _");
    expect(spellingPattern("401(k)")).toBe("_ _ _ ( _ )");
    expect(spellingPattern("résumé")).toBe("_ _ _ _ _ _");
  });
});

describe("同じ意味の別の単語", () => {
  it("同じ意味の語が他にあれば true（実データには「達成する」が3語ある）", () => {
    const achieve = W.filter((x) => x.meaning === "達成する");
    expect(achieve.length).toBeGreaterThanOrEqual(2);
    expect(hasSharedMeaning(achieve[0], W)).toBe(true);
    expect(hasSharedMeaning(w("x", "zzz", "唯一の意味"), [...W, w("x", "zzz", "唯一の意味")])).toBe(false);
  });
});

describe("4択の選択肢づくり", () => {
  it("正解を含む4つの異なる意味になり、answer がその位置を指す", () => {
    const word = W[0];
    const { choices, answer } = buildMeaningChoices(word, W, seq());
    expect(choices.length).toBe(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices[answer]).toBe(word.meaning);
  });
  it("同じ乱数なら同じ選択肢、乱数が違えば並びが変わりうる", () => {
    const a = buildMeaningChoices(W[10], W, seq(3));
    const b = buildMeaningChoices(W[10], W, seq(3));
    expect(a).toEqual(b);
    const variants = new Set(Array.from({ length: 12 }, (_, i) => buildMeaningChoices(W[10], W, seq(i + 1)).choices.join("|")));
    expect(variants.size).toBeGreaterThan(1);
  });
  it("選択肢は、同じ品詞・近い難易度の単語から選ばれる（紛らわしい選択肢にする）", () => {
    const verb = W.find((x) => x.pos === "動詞")!;
    const byMeaning = new Map(W.map((x) => [x.meaning, x]));
    const { choices } = buildMeaningChoices(verb, W, seq());
    const others = choices.filter((c) => c !== verb.meaning).map((c) => byMeaning.get(c)!);
    expect(others.every((o) => o.pos === verb.pos)).toBe(true);
    expect(others.every((o) => Math.abs(o.level - verb.level) <= 150)).toBe(true);
  });
  it("正解と同じ意味の別の単語は、選択肢に入れない（正解が2つにならない）", () => {
    const pool = [w("a", "achieve", "達成する"), w("b", "accomplish", "達成する"), w("c", "x1", "意味1"), w("d", "x2", "意味2"), w("e", "x3", "意味3")];
    for (let seed = 1; seed <= 40; seed++) {   // 乱数によっては偶然よけられるので、多くの乱数で確かめる
      const { choices } = buildMeaningChoices(pool[0], pool, seq(seed));
      expect(choices.filter((c) => c === "達成する").length).toBe(1);
    }
  });
  it("候補が足りないときは、ある分だけで作る（落ちない）", () => {
    const { choices, answer } = buildMeaningChoices(w("a", "a", "A"), [w("a", "a", "A"), w("b", "b", "B")], seq());
    expect(choices.sort()).toEqual(["A", "B"]);
    expect(choices[answer]).toBeDefined();
  });
  it("全2,000語で、4つの異なる意味から正解が1つだけになる", () => {
    const rng = seq(7);
    const bad = W.filter((x) => {
      const { choices, answer } = buildMeaningChoices(x, W, rng);
      return choices.length !== 4 || new Set(choices).size !== 4 || choices[answer] !== x.meaning || choices.filter((c) => c === x.meaning).length !== 1;
    });
    expect(bad.map((x) => x.id)).toEqual([]);
  });
});

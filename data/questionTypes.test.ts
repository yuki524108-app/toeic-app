import { describe, it, expect } from "vitest";
import questionTypes from "../../src/data/questionTypes.json";
import readings from "../../src/data/readings.json";
import part34 from "../../src/data/listeningPart34.json";
import part2 from "../../src/data/listeningPart2.json";
import { PART2_TYPES, READING_TYPES, classifyPart2Question, classifyReadingQuestion } from "../../src/lib/questionType";

type Q = { id: string; question: string };
const readingQs = (readings as { questions: Q[] }[]).flatMap((p) => p.questions);
const part34Qs = (part34 as { questions: Q[] }[]).flatMap((s) => s.questions);
const part2Qs = part2 as Q[];
const hint = "（問題データまたは分類の規則を変えたら node tools/build_question_types.mjs を実行して索引を作り直してください）";

describe("問題タイプの索引（src/data/questionTypes.json）", () => {
  it(`すべての読解・Part 3/4・Part 2の設問が、規則どおりの問題タイプで載っている ${hint}`, () => {
    const expected: Record<string, string> = {};
    for (const q of [...readingQs, ...part34Qs]) expected[q.id] = `r:${classifyReadingQuestion(q.question)}`;
    for (const q of part2Qs) expected[q.id] = `p2:${classifyPart2Question(q.question)}`;
    expect(questionTypes).toEqual(expected);
  });
  it("設問IDが重複していない（読解・Part 3/4・Part 2をまたいで）", () => {
    const ids = [...readingQs, ...part34Qs, ...part2Qs].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("索引の値は、定義済みの問題タイプだけ", () => {
    const valid = new Set([...READING_TYPES.map((t) => `r:${t.id}`), ...PART2_TYPES.map((t) => `p2:${t.id}`)]);
    expect(Object.values(questionTypes).filter((v) => !valid.has(v))).toEqual([]);
  });
});

describe("分類の質（実データ）", () => {
  it("Part 2の「平叙文」は疑問符を含まず、それ以外は疑問符を含む（「Let's…」の提案だけは例外）", () => {
    const stmt = part2Qs.filter((q) => classifyPart2Question(q.question) === "statement");
    expect(stmt.filter((q) => q.question.includes("?")).map((q) => q.question)).toEqual([]);
    const nonStmt = part2Qs.filter((q) => classifyPart2Question(q.question) !== "statement" && !q.question.includes("?"));
    expect(nonStmt.map((q) => q.question).filter((t) => !/^let's/i.test(t))).toEqual([]);
  });
  it("Part 2の「A or B?」の疑問文は、選択疑問に分類される（依頼などに取りこぼされない）", () => {
    const miss = part2Qs.filter((q) => / or /.test(q.question) && q.question.endsWith("?") && !/^(why|how|who|when|where|what|which)\b/i.test(q.question) && classifyPart2Question(q.question) !== "alternative");
    expect(miss.map((q) => q.question)).toEqual([]);
  });
  it("読解の問題タイプは「詳細」だけに偏らず、主旨・推測・一致などにも分かれる", () => {
    const kinds = new Set(readingQs.map((q) => classifyReadingQuestion(q.question)));
    for (const k of ["detail", "purpose", "inference", "problem", "match", "crossDoc"]) expect(kinds.has(k as never)).toBe(true);
  });
});

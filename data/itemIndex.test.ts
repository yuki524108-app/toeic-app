import { describe, it, expect } from "vitest";
import itemIndex from "../../src/data/itemIndex.json";
import grammarCategories from "../../src/data/grammarCategories.json";
import words from "../../src/data/words.json";
import grammar from "../../src/data/grammar.json";
import part1 from "../../src/data/listeningPart1.json";
import part2 from "../../src/data/listeningPart2.json";
import part34 from "../../src/data/listeningPart34.json";
import part6 from "../../src/data/part6.json";
import readings from "../../src/data/readings.json";

type WithId = { id: string };
const ids = (xs: WithId[]) => xs.map((x) => x.id);

describe("設問IDの索引（src/data/itemIndex.json）", () => {
  // 問題データを更新したら tools/build_item_index.py で作り直す。ずれていると、ホームの復習件数が実際とずれる
  const hint = "（問題データを更新したら python3 tools/build_item_index.py を実行して索引を作り直してください）";

  it(`単語・文法・Part 1・Part 2のIDが、問題データと一致している ${hint}`, () => {
    expect(itemIndex.words).toEqual(ids(words as WithId[]));
    expect(itemIndex.grammar).toEqual(ids(grammar as WithId[]));
    expect(itemIndex.listeningPart1).toEqual(ids(part1 as WithId[]));
    expect(itemIndex.listeningPart2).toEqual(ids(part2 as WithId[]));
  });

  it(`会話・文書ごとの設問IDが、問題データと一致している（Part 3・4、Part 6、読解） ${hint}`, () => {
    expect(itemIndex.listeningPart34).toEqual((part34 as { questions: WithId[] }[]).map((s) => ids(s.questions)));
    expect(itemIndex.part6).toEqual((part6 as { blanks: WithId[] }[]).map((p) => ids(p.blanks)));
    expect(itemIndex.readings).toEqual((readings as { questions: WithId[] }[]).map((p) => ids(p.questions)));
  });

  it("索引は小さい（問題データ全体の3%未満。実測は約1.4%）ので、ホームを軽く保てる", () => {
    const indexSize = JSON.stringify(itemIndex).length;
    const dataSize = [words, grammar, part1, part2, part34, part6, readings].reduce((n, d) => n + JSON.stringify(d).length, 0);
    expect(indexSize / dataSize).toBeLessThan(0.03);
  });

  it(`文法の設問ID→カテゴリの対応（grammarCategories.json）が、問題データと一致している ${hint}`, () => {
    const expected = Object.fromEntries((grammar as { id: string; category: string }[]).map((g) => [g.id, g.category]));
    expect(grammarCategories).toEqual(expected);
  });

  it("文法カテゴリの対応は、文法の問題データの5%未満（実測は約3%）なので、進捗画面を軽く保てる", () => {
    expect(JSON.stringify(grammarCategories).length / JSON.stringify(grammar).length).toBeLessThan(0.05);
  });
});

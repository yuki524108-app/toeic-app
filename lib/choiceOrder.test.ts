import { describe, it, expect } from "vitest";
import { CHOICE_ORDER_VERSION, isLegacyChoiceOrder, legacyToCurrentIndex } from "../../src/lib/choiceOrder";
import type { MockTestResult } from "../../src/types";

/** tools/rebalance_choices.py と同じ規則：正解を目標の位置へ移し、ほかは相対的な順序を保つ */
function rebalance(choices: string[], oldAnswer: number, newAnswer: number): string[] {
  const others = choices.filter((_, i) => i !== oldAnswer);
  return [...others.slice(0, newAnswer), choices[oldAnswer], ...others.slice(newAnswer)];
}

describe("legacyToCurrentIndex（旧い選択肢番号 → 現在の番号）", () => {
  it("選択肢が2〜5個・旧い正解と新しい正解のすべての組み合わせで、選んだ選択肢が同じ文言のまま対応する", () => {
    let checked = 0;
    for (let k = 2; k <= 5; k++) {
      const oldChoices = Array.from({ length: k }, (_, i) => `choice-${i}`);
      for (let oldCorrect = 0; oldCorrect < k; oldCorrect++) {
        for (let newCorrect = 0; newCorrect < k; newCorrect++) {
          const current = rebalance(oldChoices, oldCorrect, newCorrect);
          for (let selected = 0; selected < k; selected++) {
            const mapped = legacyToCurrentIndex(selected, oldCorrect, newCorrect);
            expect(current[mapped]).toBe(oldChoices[selected]);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(2 * 2 * 2 + 3 * 3 * 3 + 4 * 4 * 4 + 5 * 5 * 5);
  });

  it("並べ替えがない（旧い正解＝新しい正解）なら、番号は変わらない", () => {
    for (let correct = 0; correct < 4; correct++) {
      for (let selected = 0; selected < 4; selected++) {
        expect(legacyToCurrentIndex(selected, correct, correct)).toBe(selected);
      }
    }
  });

  it("旧い正解を選んでいたなら、新しい正解の番号になる", () => {
    expect(legacyToCurrentIndex(0, 0, 3)).toBe(3);
    expect(legacyToCurrentIndex(1, 1, 0)).toBe(0);
  });

  it("結果は常に、同じ選択肢の数の範囲内の番号で、旧い番号と1対1に対応する", () => {
    for (let k = 2; k <= 5; k++) {
      for (let a = 0; a < k; a++) {
        for (let t = 0; t < k; t++) {
          const mapped = Array.from({ length: k }, (_, i) => legacyToCurrentIndex(i, a, t));
          expect(new Set(mapped).size).toBe(k);
          expect(mapped.every((m) => m >= 0 && m < k)).toBe(true);
        }
      }
    }
  });
});

describe("isLegacyChoiceOrder", () => {
  const base = { id: "x", completedAt: "x", listening: {}, reading: {}, totalScore: 0 } as unknown as MockTestResult;
  it("印がない結果は旧い並び順", () => expect(isLegacyChoiceOrder(base)).toBe(true));
  it("現在の版の印がある結果は旧い並び順ではない", () =>
    expect(isLegacyChoiceOrder({ ...base, choiceOrder: CHOICE_ORDER_VERSION })).toBe(false));
  it("版1（明示）は旧い並び順", () => expect(isLegacyChoiceOrder({ ...base, choiceOrder: 1 })).toBe(true));
});

import { describe, it, expect } from "vitest";
import type { ProgressRecord } from "../../src/types";
import { classifyPart2Question as p2, classifyReadingQuestion as rd } from "../../src/lib/questionType";
import { questionTypeStats } from "../../src/lib/questionTypeStats";

describe("読解・Part 3/4の問題タイプ", () => {
  it.each([
    ["The word \"issue\" in paragraph 2, line 3, is closest in meaning to", "synonym"],
    ["In which of the positions marked [1], [2], [3], and [4] does the following sentence belong?", "insert"],
    ["Based on both the email and the schedule, when will the meeting start?", "crossDoc"],
    ["Based on all three documents, what is required?", "crossDoc"],
    ["Which of the following is NOT included in the package?", "match"],
    ["What is true about the new policy?", "match"],
    ["What is mentioned about the venue?", "match"],
    ["What does the woman mean when she says, \"I'm all set\"?", "intent"],
    ["What is the purpose of the email?", "purpose"],
    ["What is the notice mainly about?", "purpose"],
    ["Why was the letter sent?", "purpose"],
    ["What problem does the man mention?", "problem"],
    ["What is the woman concerned about?", "problem"],
    ["What will the speaker do next?", "nextAction"],
    ["Who most likely is the speaker?", "inference"],
    ["What does the man suggest?", "inference"],
    ["What might happen if the deadline is missed?", "inference"],
    ["When does the new health insurance plan take effect?", "detail"],
    ["How many years of experience does the position require?", "detail"],
  ])("「%s」は %s", (q, expected) => expect(rd(q)).toBe(expected));

  it("複数の特徴を持つ問題は、優先順位の高い方（同義語＞挿入＞複数文書＞一致＞意図＞主旨＞問題＞次の行動＞推測＞詳細）になる", () => {
    expect(rd("Based on both documents, what is NOT true?")).toBe("crossDoc");
    expect(rd("What problem is likely to happen next?")).toBe("problem");
    expect(rd("What is the purpose of the NOT-for-profit group's email?")).toBe("match");
  });
});

describe("Part 2の応答問題のタイプ", () => {
  it.each([
    ["Who approved the budget?", "who"],
    ["Who's covering the front desk?", "who"],
    ["When is the deadline?", "when"],
    ["Where did you put the keys?", "where"],
    ["Why is the printer offline?", "why"],
    ["How long is the flight?", "how"],
    ["What's the problem?", "what"],
    ["Which supplier did you choose?", "what"],
    ["Have you finished reviewing the contract yet?", "yesno"],
    ["Is the meeting still on?", "yesno"],
    ["Isn't the store closed on Mondays?", "negative"],
    ["Haven't you met our new manager?", "negative"],
    ["Could you send me the file?", "request"],
    ["Why don't we take a short break?", "request"],
    ["Would you like some help?", "request"],
    ["Let's finalize the agenda before the meeting starts.", "request"],
    ["Is the report due today or tomorrow?", "alternative"],
    ["Would you like coffee or tea with your breakfast?", "alternative"],
    ["Should we take the elevator or the stairs?", "alternative"],
    ["The report looks great, doesn't it?", "tag"],
    ["You haven't submitted your timesheet yet, have you?", "tag"],
    ["We're supposed to submit the form by Friday, right?", "tag"],
    ["I think we should upgrade our computers soon.", "statement"],
    ["This copier keeps jamming every time I use it.", "statement"],
  ])("「%s」は %s", (q, expected) => expect(p2(q)).toBe(expected));

  it("「Excuse me,」などの呼びかけは取り除いて判定する", () => {
    expect(p2("Excuse me, is this seat taken?")).toBe("yesno");
    expect(p2("Excuse me, could you tell me where the nearest restroom is?")).toBe("request");
  });
  it("「Why don't」は Why ではなく提案、「Why is」は Why", () => {
    expect(p2("Why don't we start now?")).toBe("request");
    expect(p2("Why is the printer offline?")).toBe("why");
  });
});

const rec = (id: string, itemType: ProgressRecord["itemType"], isCorrect: boolean): ProgressRecord => ({ itemId: id, itemType, itemLevel: 600, easeFactor: 2.5, interval: 1, repetitions: 0, nextReviewDate: "2999-01-01", lastAnsweredAt: "2026-01-01T00:00:00.000Z", isCorrect });

describe("問題タイプ別の集計", () => {
  const index: Record<string, string> = {};
  const progress: Record<string, ProgressRecord> = {};
  const add = (n: number, key: string, type: ProgressRecord["itemType"], correct: number) => {
    for (let i = 0; i < n; i++) { const id = `${key}-${i}`; index[id] = key; progress[id] = rec(id, type, i < correct); }
  };
  add(6, "r:inference", "reading", 2);         // 33%：6問以上＝弱点
  add(5, "r:purpose", "reading", 5);           // 100%
  add(2, "r:detail", "reading", 0);            // 2問：少ないので表示しない
  add(5, "r:problem", "listeningPart34", 1);   // 20%：弱点
  add(4, "p2:who", "listeningPart2", 1);       // 25%：4問は表示するが、弱点にはしない（5問未満）
  const groups = questionTypeStats(progress, index);

  it("種別ごとにまとめ、正答率の低い順に並べる。解答が3問未満のタイプは出さない", () => {
    expect(groups.map((g) => g.itemType)).toEqual(["reading", "listeningPart34", "listeningPart2"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual(["推測", "主旨・目的"]);
    expect(groups[0].rows[0]).toMatchObject({ answered: 6, correct: 2, weak: true });
  });
  it("弱点は、5問以上解いて正答率60%未満のタイプだけ", () => {
    expect(groups[1].rows[0]).toMatchObject({ label: "問題・懸念", weak: true });
    expect(groups[2].rows[0]).toMatchObject({ label: "Who", answered: 4, weak: false });
    expect(groups[0].rows[1].weak).toBe(false);
  });
  it("読解の記号（r:）とPart 2の記号（p2:）を取り違えない。索引に無い問題は数えない", () => {
    const g = questionTypeStats({ a: rec("a", "listeningPart2", false), b: rec("zz", "reading", false) }, { a: "r:detail" });
    expect(g).toEqual([]);
  });
  it("解答の記録が無ければ空", () => expect(questionTypeStats({}, index)).toEqual([]));
});

import type { ReadingStep } from "../../lib/mockTest";

/** リーディングの1ステップに含まれる設問id一覧（Part6は4空欄まとめて1ステップ） */
export function readingStepIds(step: ReadingStep): string[] {
  if (step.kind === "grammar") return [step.item.id];
  if (step.kind === "part6") return step.passage.blanks.map((b) => b.id);
  return [step.passage.questions[step.questionIndex].id];
}

export function readingStepLabel(step: ReadingStep): string {
  if (step.kind === "part6") {
    const start = step.qNumberStart;
    const end = start + step.passage.blanks.length - 1;
    return `${start}-${end}`;
  }
  return `${step.qNumber}`;
}

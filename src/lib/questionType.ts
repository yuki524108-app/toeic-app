/**
 * 問題タイプの分類（2.1.31）。
 *
 * 読解・Part 3/4の問題は「主旨・目的」「推測」「詳細」など、Part 2の応答問題は「Who」「Why」「依頼・提案」など、
 * 問われ方によって必要な力が違う。問題データにタグを付ける代わりに、問題文の英文から規則で判定する
 * （問題データを増やしても、そのまま分類される）。判定の結果は `src/data/questionTypes.json` に書き出してあり、
 * 進捗画面が問題データ（約5MB）を読み込まずに使える。書き出しは `tools/build_question_types.ts`。
 */

export type ReadingTypeId =
  | "purpose"
  | "problem"
  | "nextAction"
  | "intent"
  | "inference"
  | "synonym"
  | "insert"
  | "crossDoc"
  | "match"
  | "detail";

export type Part2TypeId =
  | "who"
  | "what"
  | "when"
  | "where"
  | "why"
  | "how"
  | "yesno"
  | "negative"
  | "alternative"
  | "request"
  | "tag"
  | "statement";

/** 読解・Part 3/4の問題タイプ（優先順位の順。上にあるほど先に判定する） */
export const READING_TYPES: { id: ReadingTypeId; label: string; hint: string }[] = [
  { id: "synonym", label: "同義語", hint: "文脈での語の意味（closest in meaning）" },
  { id: "insert", label: "文の挿入", hint: "文が入る位置を選ぶ" },
  { id: "crossDoc", label: "複数文書", hint: "複数の文書をまたいで答える（Based on both…）" },
  { id: "match", label: "内容の一致・不一致", hint: "NOT・true・mentioned など" },
  { id: "intent", label: "発言の意図", hint: "〜と言ったときの意図（mean when…）" },
  { id: "purpose", label: "主旨・目的", hint: "何についての文書か、なぜ書かれたか" },
  { id: "problem", label: "問題・懸念", hint: "問題点・心配事" },
  { id: "nextAction", label: "次の行動", hint: "このあと何をするか（next）" },
  { id: "inference", label: "推測", hint: "likely・suggest・imply など、書かれていないことを読み取る" },
  { id: "detail", label: "詳細", hint: "書かれている事実を探す" },
];

/** Part 2の応答問題のタイプ（優先順位の順） */
export const PART2_TYPES: { id: Part2TypeId; label: string; hint: string }[] = [
  { id: "tag", label: "付加疑問・確認", hint: "…, right? / …, isn't it?" },
  { id: "request", label: "依頼・提案・勧誘", hint: "Could you…? / Why don't we…? / Would you like…?" },
  { id: "negative", label: "否定疑問", hint: "Isn't…? / Haven't…?" },
  { id: "who", label: "Who", hint: "誰が" },
  { id: "when", label: "When", hint: "いつ" },
  { id: "where", label: "Where", hint: "どこで" },
  { id: "why", label: "Why", hint: "なぜ" },
  { id: "how", label: "How", hint: "どのように・どのくらい" },
  { id: "what", label: "What / Which", hint: "何・どれ" },
  { id: "alternative", label: "選択疑問", hint: "A or B?" },
  { id: "yesno", label: "Yes/No疑問", hint: "Do/Is/Have…?" },
  { id: "statement", label: "平叙文", hint: "疑問文でない発話への応答" },
];

/** 読解・Part 3/4の問題文から、問題タイプを判定する */
export function classifyReadingQuestion(question: string): ReadingTypeId {
  const q = question.trim();
  if (/closest in meaning/i.test(q)) return "synonym";
  if (/in which of the (positions|following)/i.test(q)) return "insert";
  if (/^based on (both|all)\b/i.test(q)) return "crossDoc";
  if (/\bNOT\b|\btrue\b|\b(is|are|was|were) (mentioned|stated|indicated|listed)\b|\bnot (mentioned|stated|included)\b/.test(q)) {
    return "match";
  }
  if (/\b(mean|imply|implies)\b.*\bwhen\b|\bwhen\b.*\b(say|says|said)\b/i.test(q)) return "intent";
  if (
    /\bpurpose\b|\bmainly\b|\bprimarily\b|\bmain (topic|idea|point|focus|subject)\b|\bwhat (is|are) (?!.*\b(concerned|worried|excited|happy|upset)\b).{0,40}\babout\?$/i.test(q) ||
    /\bwhy (was|is|did) (the|this) .{0,30}\b(sent|written|posted|issued|sending|writing|calling|call)\b/i.test(q)
  ) {
    return "purpose";
  }
  if (/\b(problem|concern|concerned|issue|difficulty|worried|complain)/i.test(q)) return "problem";
  if (/\bnext\b/i.test(q)) return "nextAction";
  if (/\b(likely|probably|infer|inferred|implied|imply|suggest|suggested|suggests|might)\b/i.test(q)) return "inference";
  return "detail";
}

const AUX =
  "is|are|was|were|do|does|did|have|has|had|can|could|will|would|shall|should|may|am|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|haven't|hasn't|hadn't|can't|couldn't|won't|wouldn't|shouldn't";

/** Part 2の応答問題の発話（英文）から、問題タイプを判定する */
export function classifyPart2Question(text: string): Part2TypeId {
  // 「Excuse me, 」などの呼びかけは取り除いて、本体の文で判定する
  const q = text.trim().replace(/^(excuse me|pardon me|sorry|well|so|hey|um)\s*,\s*/i, "");
  const lower = q.toLowerCase();
  const endsQ = q.endsWith("?");
  // 付加疑問・確認：「…, right?」「…, isn't it?」「…, have you?」
  if (
    /,\s*(right|correct|okay|ok|isn't that right)\s*\?$/i.test(q) ||
    new RegExp(`,\\s*(${AUX})\\s+(it|you|they|we|he|she|i|that|this|there)\\s*\\?$`, "i").test(q)
  ) {
    return "tag";
  }
  // はっきりした提案・勧誘（A or B を含んでいても提案）
  if (/^(why don't|why not|let's|how about|what about|shall (we|i))\b/.test(lower)) return "request";
  // 助動詞で始まる「A or B?」は選択疑問（Would you like coffee or tea? など）
  if (endsQ && /\bor\b/.test(lower) && new RegExp(`^(${AUX})\\b`).test(lower)) return "alternative";
  if (/^(would you (like|mind)|could you|can you|will you|would you|should (we|i)|do you (want|mind)|can i|could i|may i)\b/.test(lower)) {
    return "request";
  }
  if (/^(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|haven't|hasn't|hadn't|can't|couldn't|won't|wouldn't|shouldn't)\b/.test(lower)) {
    return "negative";
  }
  if (/^(who|who's|whose|who'd|who'll)\b/.test(lower)) return "who";
  if (/^(when|when's)\b/.test(lower)) return "when";
  if (/^(where|where's)\b/.test(lower)) return "where";
  if (/^(why|why's)\b/.test(lower)) return "why";
  if (/^how\b/.test(lower)) return "how";
  if (/^(what|what's|which)\b/.test(lower)) return "what";
  if (endsQ && /\bor\b/.test(lower)) return "alternative";
  if (endsQ && new RegExp(`^(${AUX})\\b`).test(lower)) return "yesno";
  return "statement";
}

export const READING_TYPE_LABEL = Object.fromEntries(READING_TYPES.map((t) => [t.id, t.label])) as Record<ReadingTypeId, string>;
export const PART2_TYPE_LABEL = Object.fromEntries(PART2_TYPES.map((t) => [t.id, t.label])) as Record<Part2TypeId, string>;

/** 問題タイプの記号（`src/data/questionTypes.json` の値）。読解・Part 3/4は "r:"、Part 2は "p2:" を前に付ける */
export type QuestionTypeKey = `r:${ReadingTypeId}` | `p2:${Part2TypeId}`;

export function typeKeyLabel(key: string): string {
  if (key.startsWith("r:")) return READING_TYPE_LABEL[key.slice(2) as ReadingTypeId] ?? key;
  if (key.startsWith("p2:")) return PART2_TYPE_LABEL[key.slice(3) as Part2TypeId] ?? key;
  return key;
}

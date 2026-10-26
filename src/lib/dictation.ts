import type { ListeningPart1Item, ListeningPart2Question, ListeningPart34Set } from "../types";
import { normalizeSpelling } from "./wordQuiz";

/**
 * ディクテーション（2.1.34）。英文を聞き取って書き取り、答え合わせで「聞き取れなかった単語」を確かめる。
 * 英文は、リスニングの問題（Part 1の正解の描写文、Part 2の設問文と正解の応答、Part 3・4の発言）から集める。
 */

export type DictationLine = {
  id: string;
  text: string;
  /** 和訳（Part 3・4の発言のみ） */
  ja?: string;
  /** 出典（画面に表示する） */
  source: string;
};

export const DICTATION_LENGTHS = [
  { id: "short", label: "短め", hint: "5〜8語", min: 5, max: 8 },
  { id: "mid", label: "ふつう", hint: "9〜13語", min: 9, max: 13 },
  { id: "long", label: "長め", hint: "14語以上", min: 14, max: Infinity },
] as const;

export type DictationLengthId = (typeof DICTATION_LENGTHS)[number]["id"];

export const DICTATION_COUNT = 5;

/** 英文の単語数（空白で区切る） */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** 聞き取りの練習に使える英文を集める（単語が5語以上で、同じ文は1つにする） */
export function buildDictationPool(src: {
  part1: ListeningPart1Item[];
  part2: ListeningPart2Question[];
  part34: ListeningPart34Set[];
}): DictationLine[] {
  const seen = new Set<string>();
  const out: DictationLine[] = [];
  const add = (id: string, text: string, source: string, ja?: string) => {
    const t = text.trim();
    const key = normalizeSpelling(t);
    if (wordCount(t) < 5 || seen.has(key)) return;
    seen.add(key);
    out.push({ id, text: t, source, ...(ja ? { ja } : {}) });
  };
  for (const p of src.part1) add(`${p.id}`, p.choices[p.answer], "Part 1");
  for (const q of src.part2) {
    add(`${q.id}:q`, q.question, "Part 2");
    add(`${q.id}:a`, q.choices[q.answer], "Part 2");
  }
  for (const s of src.part34) {
    const label = s.partType === "part3" ? "Part 3" : "Part 4";
    s.script.forEach((l, i) => add(`${s.id}:${i}`, l.line, label, s.scriptJa?.[i]));
  }
  return out;
}

/** 指定の長さの英文から、重複なく count 本を選ぶ（足りなければ、近い長さのものから補う） */
export function pickLines(
  pool: DictationLine[],
  length: DictationLengthId,
  count: number = DICTATION_COUNT,
  rng: () => number = Math.random
): DictationLine[] {
  const spec = DICTATION_LENGTHS.find((l) => l.id === length)!;
  const mid = (spec.min + Math.min(spec.max, 20)) / 2;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const inRange = shuffled.filter((l) => {
    const n = wordCount(l.text);
    return n >= spec.min && n <= spec.max;
  });
  if (inRange.length >= count) return inRange.slice(0, count);
  const rest = shuffled
    .filter((l) => !inRange.includes(l))
    .sort((a, b) => Math.abs(wordCount(a.text) - mid) - Math.abs(wordCount(b.text) - mid));
  return [...inRange, ...rest].slice(0, count);
}

// ---------- 答え合わせ ----------

/** 単語の比較用の形：大文字小文字・アクセント記号・前後の記号をならす（don't の中のアポストロフィは残す） */
function wordKey(word: string): string {
  return normalizeSpelling(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export type DiffToken = { word: string; status: "ok" | "missing" };

export type DictationDiff = {
  /** 正解の英文の単語（記号だけの語は除く）と、聞き取れたか */
  tokens: DiffToken[];
  /** 正解にない、余分に入力された単語 */
  extra: string[];
  matched: number;
  total: number;
  /** 聞き取れた単語の割合（0〜1） */
  accuracy: number;
};

/**
 * 正解の英文と入力を、単語ごとに突き合わせる（最長共通部分列）。
 * 単語の抜けや余分な単語があっても、そのあとの単語がずれて全部間違いにならないようにする。
 */
export function diffWords(target: string, typed: string): DictationDiff {
  const t = target.split(/\s+/).map((w) => ({ word: w, key: wordKey(w) })).filter((x) => x.key !== "");
  const u = typed.split(/\s+/).map((w) => ({ word: w, key: wordKey(w) })).filter((x) => x.key !== "");

  const dp: number[][] = Array.from({ length: t.length + 1 }, () => new Array<number>(u.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = u.length - 1; j >= 0; j--) {
      dp[i][j] = t[i].key === u[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const okIdx = new Set<number>();
  const usedIdx = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < t.length && j < u.length) {
    if (t[i].key === u[j].key) {
      okIdx.add(i);
      usedIdx.add(j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const matched = okIdx.size;
  return {
    tokens: t.map((x, k) => ({ word: x.word, status: okIdx.has(k) ? "ok" : "missing" })),
    extra: u.filter((_, k) => !usedIdx.has(k)).map((x) => x.word),
    matched,
    total: t.length,
    accuracy: t.length === 0 ? 0 : matched / t.length,
  };
}

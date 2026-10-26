import type { Word } from "../types";

/**
 * 単語の想起テスト（2.1.29）。意味を思い出して選ぶ「4択」と、日本語から英単語を打ち込む「スペル入力」。
 * 「見て、めくって、わかった気になる」だけにならないよう、実際に思い出したかを確かめる。
 */

export type WordFormat = "card" | "choice" | "spell";

export const WORD_FORMATS: { id: WordFormat; label: string; hint: string }[] = [
  { id: "card", label: "カード", hint: "めくって、自分で判定" },
  { id: "choice", label: "4択", hint: "意味を選ぶ" },
  { id: "spell", label: "スペル", hint: "英単語を入力" },
];

const FORMAT_KEY = "toeic-app:word-format";

export function loadWordFormat(): WordFormat {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    return v === "choice" || v === "spell" ? v : "card";
  } catch {
    return "card";
  }
}

export function saveWordFormat(format: WordFormat): void {
  try {
    localStorage.setItem(FORMAT_KEY, format);
  } catch {
    // 出題形式の記憶は補助機能なので、保存できなくても黙って無視する
  }
}

// ---------- スペル入力 ----------

/** 比較用に整える：英大文字→小文字、アクセント記号を外す（résumé→resume）、curlyなアポストロフィを直す、空白をまとめる */
export function normalizeSpelling(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function editDistanceIsOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff += 1;
    if (diff === 1) return true;
    // 隣り合う2文字の入れ替え（recieve → receive）も「惜しい」とみなす
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] !== b[i]) return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
    }
    return false;
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i += 1;
  return s.slice(i) === l.slice(i + 1);
}

export type SpellResult = "correct" | "near" | "wrong";

/** 入力の判定。正解／惜しい（1文字の違い・入れ替え。不正解として扱う）／不正解 */
export function checkSpelling(input: string, target: string): SpellResult {
  const a = normalizeSpelling(input);
  const b = normalizeSpelling(target);
  if (a === "") return "wrong";
  if (a === b) return "correct";
  // 短い単語は1文字違うだけで別の単語になりやすい（an/in など）ので、「惜しい」は4文字以上に限る
  return b.length >= 4 && editDistanceIsOne(a, b) ? "near" : "wrong";
}

/** 文字数の手がかり。英数字を「_」にし、空白・ハイフン・記号はそのまま残す（例：office supplies → _ _ _ _ _ _  _ _ _ _ _ _ _ _） */
export function spellingPattern(word: string): string {
  return Array.from(word)
    .map((ch) => (/[\p{L}\p{N}]/u.test(ch) ? "_" : ch === " " ? " " : ch))
    .join(" ");
}

/** 同じ意味の別の単語があるか（achieve / accomplish / attain など）。あれば、スペル入力では最初の文字を最初から示す */
export function hasSharedMeaning(word: Word, pool: Word[]): boolean {
  return pool.some((w) => w.id !== word.id && w.meaning === word.meaning);
}

// ---------- 4択（意味を選ぶ） ----------

const DISTRACTOR_POOL = 14;

/**
 * 4択の選択肢を作る。正解の意味1つと、紛らわしい（同じ品詞・近い難易度の）別の単語の意味3つ。
 * 正解と同じ意味の語は選択肢に入れない（正解が2つになるのを防ぐ）。
 */
export function buildMeaningChoices(
  word: Word,
  pool: Word[],
  rng: () => number = Math.random
): { choices: string[]; answer: number } {
  const seen = new Set<string>([word.meaning]);
  const ranked = pool
    .filter((w) => w.id !== word.id && w.meaning !== word.meaning)
    .map((w) => ({
      w,
      rank: (word.pos && w.pos === word.pos ? 0 : 1000) + Math.abs(w.level - word.level),
    }))
    .sort((x, y) => x.rank - y.rank)
    .slice(0, DISTRACTOR_POOL * 4);

  // 候補の上位から、重複しない意味を選ぶ。毎回同じ並びにならないよう、上位の中からランダムに取る
  const top: string[] = [];
  for (const { w } of ranked) {
    if (!seen.has(w.meaning)) {
      seen.add(w.meaning);
      top.push(w.meaning);
    }
    if (top.length >= DISTRACTOR_POOL) break;
  }
  const picked = shuffle(top, rng).slice(0, 3);
  const choices = shuffle([word.meaning, ...picked], rng);
  return { choices, answer: choices.indexOf(word.meaning) };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

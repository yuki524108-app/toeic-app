import type {
  AppData,
  GrammarQuestion,
  ItemType,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
  Part6Passage,
  ProgressRecord,
  ReadingPassage,
  Word,
} from "../types";
import { todayStr } from "./date";

/**
 * すきま時間モードで出題できるカテゴリ。id は ItemType と同じ値にしており、進捗の記録種別にそのまま使う。
 * 単語・文法・Part 1・Part 2 は1問で完結する。Part 3・4、Part 6、読解は複数の設問を持つ
 * 「セット」（会話／トーク、穴埋め文書、読解文書）を1つの出題単位として扱う。
 */
export type QuickCategory = Extract<
  ItemType,
  | "word"
  | "grammar"
  | "listeningPart1"
  | "listeningPart2"
  | "listeningPart34"
  | "part6"
  | "reading"
>;

export const QUICK_CATEGORIES: {
  id: QuickCategory;
  label: string;
  /** 1問（設問）あたりのおおよその所要秒数。セット型は文書を読む・音声を聞く時間を設問数で割った概算 */
  seconds: number;
  /** 複数の設問を持つセット単位の出題か */
  isSet: boolean;
}[] = [
  { id: "word", label: "単語", seconds: 15, isSet: false },
  { id: "grammar", label: "文法", seconds: 40, isSet: false },
  { id: "listeningPart1", label: "Part 1 写真描写", seconds: 30, isSet: false },
  { id: "listeningPart2", label: "Part 2 応答", seconds: 45, isSet: false },
  { id: "listeningPart34", label: "Part 3・4 会話・トーク", seconds: 50, isSet: true },
  { id: "part6", label: "Part 6 長文穴埋め", seconds: 45, isSet: true },
  { id: "reading", label: "Part 7 読解", seconds: 60, isSet: true },
];

export const QUICK_COUNT_OPTIONS = [3, 5, 10] as const;

export type QuickItem =
  | { kind: "word"; item: Word }
  | { kind: "grammar"; item: GrammarQuestion }
  | { kind: "listeningPart1"; item: ListeningPart1Item }
  | { kind: "listeningPart2"; item: ListeningPart2Question }
  | { kind: "listeningPart34"; item: ListeningPart34Set }
  | { kind: "part6"; item: Part6Passage }
  | { kind: "reading"; item: ReadingPassage };

export type QuickPools = {
  word: Word[];
  grammar: GrammarQuestion[];
  listeningPart1: ListeningPart1Item[];
  listeningPart2: ListeningPart2Question[];
  listeningPart34: ListeningPart34Set[];
  part6: Part6Passage[];
  reading: ReadingPassage[];
};

/** 出題単位に含まれる設問の ID。進捗はセットではなく設問ごとに記録されているため、設問IDで引く */
export function questionIds(q: QuickItem): string[] {
  switch (q.kind) {
    case "listeningPart34":
      return q.item.questions.map((x) => x.id);
    case "part6":
      return q.item.blanks.map((x) => x.id);
    case "reading":
      return q.item.questions.map((x) => x.id);
    default:
      return [q.item.id];
  }
}

/** 出題単位の重み＝含まれる設問数（セッションの問題数にはこの合計を数える） */
export function quickWeight(q: QuickItem): number {
  return questionIds(q).length;
}

/**
 * 出題の優先度（小さいほど優先）。
 * 0: 前回不正解で復習日を迎えている問題（最優先で苦手を潰す）
 * 1: 正解済みで復習日を迎えている問題（間隔反復の復習）
 * 2: まだ学習していない問題
 * 3: 学習済みで復習日がまだ先の問題（他に出す問題がないときの穴埋め）
 */
const TIER_COUNT = 4;

function tierOfRecord(record: ProgressRecord | undefined, today: string): number {
  if (!record) return 2;
  if (record.nextReviewDate <= today) return record.isCorrect ? 1 : 0;
  return 3;
}

/** 出題単位の優先度。セットは含まれる設問のうち最も優先度の高いものに合わせる */
function tierOfItem(q: QuickItem, data: AppData, today: string): number {
  return Math.min(
    ...questionIds(q).map((id) => tierOfRecord(data.progress[id], today))
  );
}

export function toQuickItems(category: QuickCategory, pools: QuickPools): QuickItem[] {
  // kind と item の対応は QuickPools の型で保証されている
  return (pools[category] as QuickItem["item"][]).map(
    (item) => ({ kind: category, item }) as QuickItem
  );
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 設問数が count 前後のミニセッションを組み立てる。
 * - 優先度（tierOfItem）の高い順に出題する。以前は未学習の問題も「復習日を迎えた問題」と同列に
 *   混ぜていたため、未学習が多いと復習すべき問題がほとんど出なかった
 * - 同じ優先度の中では、選択したカテゴリから交互に取り出して偏りを防ぐ
 * - セット型（Part 3・4、Part 6、読解）は設問を分割せず、1セットを丸ごと出題する。設問数の合計が
 *   count を超えない範囲で選び、それでも count に満たない場合は、count との差が最も小さくなるときに限り
 *   1セットだけ超過して追加する（例：Part 3・4のみで5問 → 3問のセットを2つ＝6問。Part 6のみで3問 → 4問）
 * - 最後に並び順をシャッフルし、優先度順に並ばないようにする
 */
export function buildQuickQueue(
  data: AppData,
  count: number,
  categories: QuickCategory[],
  pools: QuickPools,
  rng: () => number = Math.random
): QuickItem[] {
  if (categories.length === 0 || count <= 0) return [];
  const today = todayStr();

  // tiers[優先度][カテゴリ番号] = その優先度・カテゴリに該当する出題単位
  const tiers: QuickItem[][][] = Array.from({ length: TIER_COUNT }, () =>
    categories.map(() => [])
  );
  categories.forEach((category, ci) => {
    for (const q of toQuickItems(category, pools)) {
      tiers[tierOfItem(q, data, today)][ci].push(q);
    }
  });

  const picked: QuickItem[] = [];
  const skipped: QuickItem[] = []; // 残り設問数に収まらず見送った出題単位（優先度順）
  let remaining = count;

  for (const perCategory of tiers) {
    if (remaining <= 0) break;
    const lists = shuffle(
      perCategory.map((l) => shuffle(l, rng)),
      rng
    );
    const pointers = lists.map(() => 0);
    let progressed = true;
    while (remaining > 0 && progressed) {
      progressed = false;
      for (let li = 0; li < lists.length && remaining > 0; li++) {
        while (pointers[li] < lists[li].length) {
          const q = lists[li][pointers[li]++];
          const weight = quickWeight(q);
          if (weight <= remaining) {
            picked.push(q);
            remaining -= weight;
            progressed = true;
            break;
          }
          // 残り設問数より大きい。残りは減る一方なので、以降この単位が収まることはない
          skipped.push(q);
        }
      }
    }
  }

  if (remaining > 0) {
    // 超過が不足より小さい（＝count により近づく）場合に限り、見送った単位から1つ追加する
    const over = skipped.find((q) => quickWeight(q) - remaining < remaining);
    if (over) picked.push(over);
  }

  return shuffle(picked, rng);
}

/** 選択中のカテゴリのうち、今すぐ復習すべき設問（優先度0・1）の数 */
export function countReviewDue(
  data: AppData,
  categories: QuickCategory[],
  pools: QuickPools
): number {
  const today = todayStr();
  let n = 0;
  for (const category of categories) {
    for (const q of toQuickItems(category, pools)) {
      for (const id of questionIds(q)) {
        if (tierOfRecord(data.progress[id], today) <= 1) n += 1;
      }
    }
  }
  return n;
}

/** セッションの設問数の合計 */
export function totalQuestions(queue: QuickItem[]): number {
  return queue.reduce((sum, q) => sum + quickWeight(q), 0);
}

/** 所要時間の目安（分）。選択カテゴリの平均所要秒数×問題数。最低1分 */
export function estimateMinutes(count: number, categories: QuickCategory[]): number {
  const selected = QUICK_CATEGORIES.filter((c) => categories.includes(c.id));
  if (selected.length === 0) return 1;
  const avg = selected.reduce((sum, c) => sum + c.seconds, 0) / selected.length;
  return Math.max(1, Math.round((count * avg) / 60));
}

// ---------- 前回の設定の記憶 ----------

export type QuickPrefs = { count: number; categories: QuickCategory[] };

const PREFS_KEY = "toeic-app:quick-study-prefs";
const DEFAULT_PREFS: QuickPrefs = {
  count: 5,
  categories: ["word", "grammar"],
};

export function loadQuickPrefs(): QuickPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<QuickPrefs>;
    const valid = new Set<string>(QUICK_CATEGORIES.map((c) => c.id));
    const categories = (parsed.categories ?? []).filter((c): c is QuickCategory =>
      valid.has(c)
    );
    const count = (QUICK_COUNT_OPTIONS as readonly number[]).includes(
      parsed.count ?? -1
    )
      ? (parsed.count as number)
      : DEFAULT_PREFS.count;
    return {
      count,
      categories: categories.length > 0 ? categories : [...DEFAULT_PREFS.categories],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveQuickPrefs(prefs: QuickPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 設定の記憶は補助機能なので、保存に失敗しても黙って無視する
  }
}

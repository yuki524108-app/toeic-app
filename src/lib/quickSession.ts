import type { AnswerConfidence } from "../types";
import { questionIds } from "./quickQueue";
import type { QuickCategory, QuickItem, QuickPools } from "./quickQueue";

/**
 * すきま時間モードのセッションの中断／再開。
 *
 * 保存するのは「出題リスト（カテゴリとID）」と「解答済みの設問の記録」だけで、現在位置は保存しない。
 * 再開時は、解答の記録から「最初の未解答の出題単位」を導出する（`firstUnansweredIndex`）。
 * 位置を別に持たないので、保存内容と実際の進み具合がずれることがない。
 *
 * 解答済みの設問は解答した時点で進捗（間隔反復）に記録済みのため、セット型を途中で中断した場合も、
 * 再開時は解答済みの設問を飛ばして未解答の設問から続ける（最初からやり直すと二重に記録されてしまう）。
 */

const SESSION_KEY = "toeic-app:quick-study-session";
// 保存形式の版。2：選択肢の並べ替え（src/lib/choiceOrder.ts）に伴い、旧い並び順の選択肢番号を含む保存（版1）を破棄する
const SESSION_VERSION = 2;

/** 1問分の解答の記録 */
export type QuickAnswerRecord = {
  /** 設問のID（セット型でもセットではなく設問のID） */
  id: string;
  level: number;
  correct: boolean;
  /** 結果画面の「間違えた問題」に表示する出題内容 */
  title: string;
  /** 結果画面に表示する正解 */
  answer: string;
  /** 選んだ選択肢の番号（単語は「わかる」=1・「わからない」=0）。再開時に解答済みの状態を復元するために使う */
  selected: number;
  /** 確信度。単語で「うろ覚え」を選んだときの "unsure"（間隔反復で、翌日にもう一度出す）。省略時は確信あり */
  confidence?: AnswerConfidence;
};

/** 解答の記録に、それが属する出題単位を結び付けたもの */
export type QuickResult = QuickAnswerRecord & { q: QuickItem };

type SavedSession = {
  v: number;
  savedAt: string;
  queue: { kind: QuickCategory; id: string }[];
  answers: (QuickAnswerRecord & { itemKind: QuickCategory; itemId: string })[];
};

export type RestoredSession = {
  queue: QuickItem[];
  results: QuickResult[];
  savedAt: string;
};

export function saveQuickSession(
  queue: QuickItem[],
  results: QuickResult[],
  now: Date = new Date()
): void {
  try {
    const saved: SavedSession = {
      v: SESSION_VERSION,
      savedAt: now.toISOString(),
      queue: queue.map((q) => ({ kind: q.kind, id: q.item.id })),
      answers: results.map(({ q, ...record }) => ({
        ...record,
        itemKind: q.kind,
        itemId: q.item.id,
      })),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  } catch {
    // 再開機能は補助機能なので、保存に失敗しても学習自体は続けられるよう黙って無視する
  }
}

export function clearQuickSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // 同上
  }
}

/**
 * 保存されたセッションを復元する。再開できるものがなければ null。
 * 保存後に問題データが変わって出題単位が見つからない場合は、途中の状態を正しく再現できないため、
 * 保存内容ごと破棄する（壊れたデータ・解答が1つもない場合も同様）。
 */
export function loadQuickSession(pools: QuickPools): RestoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSession;
    if (
      saved.v !== SESSION_VERSION ||
      !Array.isArray(saved.queue) ||
      !Array.isArray(saved.answers) ||
      typeof saved.savedAt !== "string"
    ) {
      clearQuickSession();
      return null;
    }

    const queue: QuickItem[] = [];
    for (const entry of saved.queue) {
      const pool = pools[entry.kind] as { id: string }[] | undefined;
      const item = pool?.find((x) => x.id === entry.id);
      if (!item) {
        clearQuickSession();
        return null;
      }
      queue.push({ kind: entry.kind, item } as QuickItem);
    }

    const results: QuickResult[] = [];
    const seen = new Set<string>();
    for (const { itemKind, itemId, ...record } of saved.answers) {
      const q = queue.find((x) => x.kind === itemKind && x.item.id === itemId);
      // 出題リストにない・その出題単位の設問ではない・重複している解答は取り込まない
      if (!q || !questionIds(q).includes(record.id) || seen.has(record.id)) continue;
      seen.add(record.id);
      results.push({ ...record, q });
    }
    if (queue.length === 0 || results.length === 0) {
      clearQuickSession();
      return null;
    }
    return { queue, results, savedAt: saved.savedAt };
  } catch {
    clearQuickSession();
    return null;
  }
}

/**
 * 最初の「まだ解き終えていない」出題単位の位置。すべて解き終えていれば -1。
 * セット型は、含まれる設問のうち1つでも未解答なら解き終えていない（途中のセットはそこから再開する）。
 */
export function firstUnansweredIndex(queue: QuickItem[], results: QuickResult[]): number {
  const answered = new Set(results.map((r) => r.id));
  return queue.findIndex((q) => questionIds(q).some((id) => !answered.has(id)));
}

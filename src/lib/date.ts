/**
 * 日付ユーティリティ。アプリ内の「日付キー（YYYY-MM-DD）」はすべて端末のローカル日付で扱う。
 * （以前は toISOString()＝UTC基準で生成していたため、日本時間の0:00〜9:00に学習すると前日扱いになっていた）
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date を端末ローカルの YYYY-MM-DD に変換する */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 今日（ローカル）の YYYY-MM-DD */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** base に days 日を加えた新しい Date を返す（時刻は保持、月跨ぎ・DSTはローカル暦で計算） */
export function addDaysLocal(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** YYYY-MM-DD をローカルの0時の Date に変換する（不正な形式なら null） */
export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  // 2/30 のような存在しない日付を弾く
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** 今日から target（YYYY-MM-DD）までの日数。今日なら0、過ぎていれば負の数 */
export function daysUntil(target: string, today: string = todayStr()): number | null {
  const t = parseLocalDate(target);
  const n = parseLocalDate(today);
  if (!t || !n) return null;
  // 夏時間などで1日が23/25時間になる場合に備えて round する
  return Math.round((t.getTime() - n.getTime()) / 86_400_000);
}

/**
 * base に months ヶ月を加えた新しい Date を返す。
 * 翌月に同じ日が存在しない場合（例：1/31 + 1ヶ月）は、その月の末日に丸める。
 */
export function addMonthsLocal(base: Date, months: number): Date {
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(base.getDate(), lastDay));
  return target;
}

import { Link } from "react-router-dom";
import type { ItemType, ProgressRecord } from "../types";
import { isBridgeKind } from "../lib/bridge";
import { isLeech, wrongCountOf } from "../lib/history";

/**
 * 何度も間違えている問題を間違えたときに出す、基礎固めの案内（2.1.32）。
 * 同じ解説を繰り返し読むより、同じ分野のやさしい問題で土台を固めてから、この問題に戻るほうが定着しやすい。
 * 対象は、分野のある種別（文法・Part 2・Part 3/4・読解）の、「何度も間違える問題」だけ。
 */
export function BridgePanel({
  kind,
  itemId,
  record,
}: {
  kind: ItemType;
  itemId: string;
  record: ProgressRecord | undefined;
}) {
  if (!isBridgeKind(kind) || !isLeech(record) || !record) return null;
  return (
    <div role="note" className="mt-3 rounded-sm border border-(--color-gold) bg-(--color-gold-soft) p-3">
      <p className="text-xs font-medium text-(--color-ink)">
        この問題は通算{wrongCountOf(record)}回間違えています
      </p>
      <p className="mt-1 text-xs leading-relaxed text-(--color-ink-soft)">
        同じ解説をもう一度読むより、同じ分野のやさしい問題で土台を固めてから、この問題に戻るほうが定着しやすくなります。
      </p>
      <Link
        to={`/quick-study?plan=bridge&kind=${kind}&item=${encodeURIComponent(itemId)}`}
        className="mt-2 inline-block rounded-sm bg-(--color-ink) px-3 py-2 text-xs font-medium text-(--color-paper)"
      >
        基礎固めをする（やさしい問題 → この問題）
      </Link>
    </div>
  );
}

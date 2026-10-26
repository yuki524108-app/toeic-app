import { useContext, useState } from "react";
import type { MissReason } from "../types";
import { MISS_REASONS } from "../lib/missReason";
import { MissReasonContext } from "../lib/missReasonContext";

/**
 * 間違えた直後に、その理由を1タップで記録する（任意）。もう一度押すと取り消し、別の理由を押すと選び直せる。
 * 理由を記録する仕組みが提供されていない場所（テストなど）では何も表示しない。
 * 画面に表示している間（＝この間違い1回分）の選択だけを持ち、記録は問題ごとの通算に反映される。
 */
export function MissReasonPicker({ itemId }: { itemId: string }) {
  const record = useContext(MissReasonContext);
  const [value, setValue] = useState<MissReason | null>(null);
  if (!record) return null;

  function choose(reason: MissReason) {
    const next = value === reason ? null : reason;
    record?.(itemId, next, value);
    setValue(next);
  }

  return (
    <div role="group" aria-label="間違えた理由（任意）" className="mt-3">
      <p className="text-xs text-(--color-muted)">なぜ間違えた？（任意・1タップで記録）</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {MISS_REASONS.filter((r) => r.manual).map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={value === r.id}
            onClick={() => choose(r.id)}
            className={`rounded-sm border px-2.5 py-1 text-xs ${
              value === r.id
                ? "border-(--color-gold) bg-(--color-gold-soft) font-medium text-(--color-ink)"
                : "border-(--color-line) text-(--color-muted)"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

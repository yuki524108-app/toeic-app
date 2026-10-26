import { useEffect, useRef } from "react";

/**
 * 「Q3 / 10」のような進捗表示。出題が切り替わる（changeKey が変わる）と、ここへフォーカスを戻す。
 * 「次の問題へ」ボタンが消えたときにフォーカスが失われ、キーボード・スクリーンリーダーの利用者が
 * 画面の先頭から操作をやり直すことになるのを防ぐ。初回表示ではフォーカスを動かさない。
 */
export function FocusLabel({
  changeKey,
  className,
  children,
}: {
  changeKey: number | string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
  }, [changeKey]);

  return (
    <span ref={ref} tabIndex={-1} className={`${className ?? ""} outline-none`}>
      {children}
    </span>
  );
}

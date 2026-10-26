import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { titleForPath } from "../lib/routeTitle";

/**
 * 画面（パス）が変わったとき、タブの題名を更新し、メイン領域へフォーカスを移す。
 * 画面遷移はページの再読み込みを伴わないため、そのままでは支援技術の利用者に遷移が伝わらず、
 * フォーカスも押したリンクが消えた位置に取り残される。初回表示ではフォーカスを動かさない。
 */
export function RouteFocus({ targetId }: { targetId: string }) {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    document.title = titleForPath(pathname);
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }, [pathname, targetId]);

  return null;
}

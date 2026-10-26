import { useEffect } from "react";
import { announce } from "../lib/announce";

/** 画面に挿入された時点で、メッセージを読み上げ領域へ通知する（何も描画しない） */
export function Announce({ message }: { message: string }) {
  useEffect(() => {
    announce(message);
    // 挿入された時点の内容だけを通知する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

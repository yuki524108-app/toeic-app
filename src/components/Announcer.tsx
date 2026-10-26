import { useEffect, useState } from "react";
import { subscribeAnnouncer } from "../lib/announce";

/** 常設の読み上げ領域（画面には表示しない）。App に1つだけ置く */
export function Announcer() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAnnouncer((m) => {
      // 同じ文を続けて通知しても読み上げ直されるよう、いったん空にしてから設定する
      setMessage("");
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(m), 50);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

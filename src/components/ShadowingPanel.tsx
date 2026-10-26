import { useEffect, useRef, useState } from "react";
import { isTTSSupported, speak, stopSpeaking, voiceForSpeaker } from "../lib/tts";

export type ShadowLine = {
  /** 話者（同じ名前なら同じ声）。1人しかいなければ省略 */
  speaker?: string;
  text: string;
  /** 和訳（あれば表示する） */
  ja?: string;
};

const RATES = [0.75, 1, 1.25] as const;
/** 「くり返す」の回数と、くり返しの間の間（ミリ秒） */
const REPEAT = 3;
const REPEAT_PAUSE_MS = 900;

/**
 * シャドーイング練習（2.1.34）。解答後に、解説の中から開く。
 * 英文を1文ずつ聞いて、すぐあとに続けて声に出して真似する。ゆっくり（0.75倍）から始められ、1文をくり返し再生できる。
 * 声に出せたかは自己判定（正誤は判定しない）。
 */
export function ShadowingPanel({ lines }: { lines: ShadowLine[] }) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState<number>(0.75);
  const [playing, setPlaying] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  // いまの再生を識別する番号。新しい再生を始めたら増やし、古いくり返しを止める
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
      stopSpeaking();
    },
    []
  );

  if (!isTTSSupported() || lines.length === 0) return null;

  const speakers = lines.map((l) => l.speaker ?? "");

  async function play(index: number, times: number) {
    stopSpeaking();
    runId.current += 1;
    const mine = runId.current;
    const line = lines[index];
    const voice = await voiceForSpeaker(speakers, line.speaker ?? "");
    for (let n = 0; n < times; n++) {
      if (runId.current !== mine) return;
      setPlaying(index);
      await speak(line.text, rate, voice);
      if (runId.current !== mine) return;
      if (n < times - 1) await new Promise((r) => setTimeout(r, REPEAT_PAUSE_MS));
    }
    if (runId.current === mine) setPlaying(null);
  }

  function stop() {
    runId.current += 1;
    stopSpeaking();
    setPlaying(null);
  }

  function toggleDone(index: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-ink-soft)"
      >
        シャドーイング練習をする（聞いて、続けて声に出す）
      </button>
    );
  }

  return (
    <div role="group" aria-label="シャドーイング練習" className="mt-3 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-(--color-ink)">シャドーイング練習</p>
        <button onClick={() => { stop(); setOpen(false); }} className="text-xs text-(--color-muted)">
          閉じる
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
        1文を聞いて、少し遅れて続けるように声に出して真似します。まずはゆっくり（0.75倍）で。
      </p>

      <div role="group" aria-label="再生の速さ" className="mt-2 flex gap-2">
        {RATES.map((r) => (
          <button
            key={r}
            onClick={() => setRate(r)}
            aria-pressed={rate === r}
            className={`rounded-sm border px-2.5 py-1 text-xs ${
              rate === r ? "border-(--color-gold) bg-(--color-gold-soft) font-medium text-(--color-ink)" : "border-(--color-line) text-(--color-muted)"
            }`}
          >
            {r}倍
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-3">
        {lines.map((l, i) => (
          <li key={i} className={`rounded-sm border p-2.5 ${playing === i ? "border-(--color-gold) bg-(--color-gold-soft)" : "border-(--color-line)"}`}>
            <p className="text-sm leading-relaxed text-(--color-ink)">
              {l.speaker && <span className="mr-1.5 text-xs text-(--color-muted)">{l.speaker}:</span>}
              {l.text}
            </p>
            {l.ja && <p className="mt-0.5 text-xs leading-relaxed text-(--color-muted)">{l.ja}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => play(i, 1)}
                aria-label={`第${i + 1}文を聞く`}
                className="rounded-sm bg-(--color-ink) px-3 py-1.5 text-xs font-medium text-(--color-paper)"
              >
                聞く
              </button>
              <button
                onClick={() => play(i, REPEAT)}
                aria-label={`第${i + 1}文を${REPEAT}回くり返す`}
                className="rounded-sm border border-(--color-line) px-3 py-1.5 text-xs text-(--color-ink)"
              >
                {REPEAT}回くり返す
              </button>
              <button
                onClick={() => toggleDone(i)}
                aria-pressed={done.has(i)}
                aria-label={`第${i + 1}文を言えた`}
                className={`rounded-sm border px-3 py-1.5 text-xs ${
                  done.has(i) ? "border-(--color-correct) bg-(--color-correct-soft) font-medium text-(--color-correct)" : "border-(--color-line) text-(--color-muted)"
                }`}
              >
                {done.has(i) ? "言えた ✓" : "言えた"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-(--color-muted)">
          言えた：{done.size} / {lines.length}文（自己判定）
        </p>
        {playing !== null && (
          <button onClick={stop} className="rounded-sm border border-(--color-line) px-3 py-1 text-xs text-(--color-ink)">
            停止
          </button>
        )}
      </div>
    </div>
  );
}

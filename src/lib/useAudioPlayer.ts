import { useCallback, useEffect, useRef, useState } from "react";
import { stopSpeaking } from "./tts";

type PlayContext = {
  rate: number;
  /** true になったら再生を打ち切る（再生ごとに別のオブジェクト） */
  stoppedRef: { current: boolean };
  /** 何番目の区間（選択肢・発言）を再生中かを通知する */
  onIndex: (index: number) => void;
};

/**
 * 最新の再生を打ち切って音声を止める。
 * ref には「現在の再生のトークン」を入れてあり、アンマウント時に最新のものを止めるのが目的のため、
 * 離脱時点の .current を読む（DOM要素のrefとは違い、途中で別物に差し替わることを想定した使い方）。
 */
function abortLatest(ref: { current: { current: boolean } }) {
  ref.current.current = true;
  stopSpeaking();
}

/**
 * リスニング系の画面（学習画面・模試・すきま時間モード）共通の再生制御。
 * - 再生ごとに専用の停止フラグを作るため、「停止→すぐ再生」しても、止めたはずの古い再生が
 *   続いて二重に読み上げられることがない
 * - 画面を離れる（アンマウント）ときは再生を止め、以降の区間が読み上げられないようにする
 */
export function useAudioPlayer() {
  const [rate, setRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const tokenRef = useRef<{ current: boolean }>({ current: false });

  useEffect(() => {
    const ref = tokenRef;
    return () => abortLatest(ref);
  }, []);

  async function play(run: (ctx: PlayContext) => Promise<void>) {
    if (isPlaying) return;
    const token = { current: false };
    tokenRef.current = token;
    setIsPlaying(true);
    setHasPlayedOnce(true);
    await run({ rate, stoppedRef: token, onIndex: setPlayingIndex });
    // 再生の途中で停止・再生し直されていた場合は、新しい再生の状態を上書きしない
    if (tokenRef.current === token) {
      setIsPlaying(false);
      setPlayingIndex(null);
    }
  }

  /** 再生を止める（「もう一度再生する」の表示は保つ） */
  const stop = useCallback(() => {
    tokenRef.current.current = true;
    stopSpeaking();
    setIsPlaying(false);
    setPlayingIndex(null);
  }, []);

  /**
   * 再生を止めて、「まだ再生していない」状態に戻す。
   * 同じコンポーネントのまま次の問題に切り替わる画面（学習画面など）で、問題が変わるたびに呼ぶ。
   */
  const reset = useCallback(() => {
    stop();
    setHasPlayedOnce(false);
  }, [stop]);

  return { rate, setRate, isPlaying, playingIndex, hasPlayedOnce, play, stop, reset };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;

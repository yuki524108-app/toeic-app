// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { speakSequence } from "../../src/lib/tts";
import { useAudioPlayer } from "../../src/lib/useAudioPlayer";

/** 3つの区間を再生するだけの、テスト用の小さな画面 */
function Player({ texts = ["one", "two", "three"] }: { texts?: string[] }) {
  const p = useAudioPlayer();
  return (
    <div>
      <button onClick={() => p.play(({ rate, stoppedRef, onIndex }) => speakSequence(texts, rate, { pauseMs: 80, onSegmentStart: onIndex, stoppedRef }))}>play</button>
      <button onClick={p.stop}>stop</button>
      <button onClick={p.reset}>reset</button>
      <button onClick={() => p.setRate(1.25)}>fast</button>
      <output data-testid="state">{JSON.stringify({ playing: p.isPlaying, index: p.playingIndex, once: p.hasPlayedOnce })}</output>
    </div>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);

const spoken: { text: string; rate: number }[] = [];
let pending: { u: { onend?: () => void; onerror?: () => void }; timer: ReturnType<typeof setTimeout> }[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => {
  spoken.length = 0; pending = [];
  const voices = [{ lang: "en-US", name: "v" }];
  Object.assign(window, {
    SpeechSynthesisUtterance: class { text: string; rate = 1; lang = ""; voice: unknown; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } },
    speechSynthesis: {
      getVoices: () => voices, addEventListener() {}, removeEventListener() {},
      speak(u: { text: string; rate: number; onend?: () => void; onerror?: () => void }) {
        spoken.push({ text: u.text, rate: u.rate });
        const timer = setTimeout(() => { pending = pending.filter((p) => p.u !== u); u.onend?.(); }, 20);
        pending.push({ u, timer });
      },
      // 実ブラウザと同様、cancel すると再生中の発話は（非同期に）終了イベントを返す
      cancel() { const ps = pending; pending = []; for (const p of ps) { clearTimeout(p.timer); setTimeout(() => p.u.onerror?.(), 0); } },
    },
  });
});
afterEach(() => cleanup());

describe("useAudioPlayer", () => {
  it("再生すると全区間が順に読み上げられ、終わると『再生済み』になる", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(500);
    expect(spoken.map((s) => s.text)).toEqual(["one", "two", "three"]);
    expect(state()).toEqual({ playing: false, index: null, once: true });
  });

  it("再生中は、再生中の区間の番号が分かる", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(40);
    expect(state()).toMatchObject({ playing: true, index: 0 });
    await wait(150);
    expect(state().index).toBe(1);
  });

  it("再生速度が読み上げに反映される", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("fast"));
    await userEvent.click(screen.getByText("play"));
    await wait(60);
    expect(spoken[0].rate).toBe(1.25);
  });

  it("停止すると、以降の区間は読み上げられない。『再生済み』の表示は保たれる", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(40);
    await userEvent.click(screen.getByText("stop"));
    const n = spoken.length;
    await wait(500);
    expect(spoken.length).toBe(n);
    expect(state()).toEqual({ playing: false, index: null, once: true });
  });

  it("停止→すぐ再生しても、止めたはずの再生は続かない（二重再生しない）", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(10);
    await userEvent.click(screen.getByText("stop"));
    const before = spoken.length;
    await userEvent.click(screen.getByText("play"));
    await wait(600);
    expect(spoken.length).toBe(before + 3);   // 1回目の途中までの分 + 2回目の全区間
  });

  it("再生中に画面を離れると、以降の区間は読み上げられない", async () => {
    const { unmount } = render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(40);
    unmount();
    const n = spoken.length;
    await wait(500);
    expect(spoken.length).toBe(n);
  });

  it("reset すると、再生を止めて『まだ再生していない』状態に戻る", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await wait(40);
    await userEvent.click(screen.getByText("reset"));
    const n = spoken.length;
    await wait(400);
    expect(spoken.length).toBe(n);
    expect(state()).toEqual({ playing: false, index: null, once: false });
  });

  it("再生中に再度 play を押しても、重ねて再生しない", async () => {
    render(<Player />);
    await userEvent.click(screen.getByText("play"));
    await userEvent.click(screen.getByText("play"));
    await wait(500);
    expect(spoken.length).toBe(3);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ShadowingPanel } from "../../src/components/ShadowingPanel";
import Dictation from "../../src/pages/Dictation";
import ListeningPart2Study from "../../src/pages/ListeningPart2Study";
import part2 from "../../src/data/listeningPart2.json";
import { voiceForSpeaker } from "../../src/lib/tts";
import type { AppData, ListeningPart2Question } from "../../src/types";

// ---- 音声の偽物：発話を記録し、すぐに終了を返す。声は2種類 ----
const VOICES = [{ lang: "en-US", name: "v0" }, { lang: "en-US", name: "v1" }];
type Spoken = { text: string; rate: number; voice?: string };
const spoken: Spoken[] = [];
let pending: { u: { onend?: () => void; onerror?: () => void }; timer: ReturnType<typeof setTimeout> }[] = [];
function installSpeech() {
  Object.assign(window, {
    SpeechSynthesisUtterance: class { text: string; rate = 1; lang = ""; voice?: { name: string }; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } },
    speechSynthesis: {
      getVoices: () => VOICES, addEventListener() {}, removeEventListener() {},
      speak(u: { text: string; rate: number; voice?: { name: string }; onend?: () => void; onerror?: () => void }) {
        spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name });
        const timer = setTimeout(() => { pending = pending.filter((p) => p.u !== u); u.onend?.(); }, 10);
        pending.push({ u, timer });
      },
      cancel() { const ps = pending; pending = []; for (const p of ps) { clearTimeout(p.timer); setTimeout(() => p.u.onerror?.(), 0); } },
    },
  });
}
beforeEach(() => { cleanup(); localStorage.clear(); spoken.length = 0; pending = []; installSpeech(); });
afterEach(() => { cleanup(); delete (window as unknown as Record<string, unknown>).speechSynthesis; });

const EMPTY: AppData = { progress: {}, answerHistory: [], dailyLogs: {}, streak: 0, lastStudyDate: null, bookmarks: [], placementTestCompletedAt: "2026-01-01T00:00:00.000Z", mockTestHistory: [], targetScore: null, targetDate: null, dataVersion: 2 };
const LINES = [{ speaker: "Man", text: "Could you send me the report?", ja: "報告書を送ってもらえますか。" }, { speaker: "Woman", text: "Sure, I will send it this afternoon." }];

describe("話者ごとの声", () => {
  it("話者の登場順に声を割り当て、同じ話者には同じ声を使う", async () => {
    expect((await voiceForSpeaker(["Man", "Woman", "Man"], "Man"))?.name).toBe("v0");
    expect((await voiceForSpeaker(["Man", "Woman", "Man"], "Woman"))?.name).toBe("v1");
    expect((await voiceForSpeaker(["Narrator"], "Narrator"))?.name).toBe("v0");
  });
});

describe("シャドーイング練習のパネル", () => {
  it("初めは閉じていて、開くと英文・和訳・操作が出る。速さは0.75倍から", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    expect(screen.queryByRole("group", { name: "シャドーイング練習" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    expect(screen.getByRole("group", { name: "シャドーイング練習" })).toBeTruthy();
    expect(screen.getByText(LINES[0].text)).toBeTruthy();
    expect(screen.getByText(LINES[0].ja!)).toBeTruthy();
    expect(screen.getByRole("button", { name: "0.75倍" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("1文を聞くと、選んだ速さで、その話者の声で再生される", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    await user.click(screen.getByRole("button", { name: "第2文を聞く" }));
    await waitFor(() => expect(spoken.length).toBe(1));
    expect(spoken[0]).toEqual({ text: LINES[1].text, rate: 0.75, voice: "v1" });
    await user.click(screen.getByRole("button", { name: "1倍" }));
    await user.click(screen.getByRole("button", { name: "第1文を聞く" }));
    await waitFor(() => expect(spoken.length).toBe(2));
    expect(spoken[1]).toEqual({ text: LINES[0].text, rate: 1, voice: "v0" });
  });
  it("「3回くり返す」で同じ文が3回再生される", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    await user.click(screen.getByRole("button", { name: "第1文を3回くり返す" }));
    await waitFor(() => expect(spoken.length).toBe(3), { timeout: 6000 });
    expect(new Set(spoken.map((s) => s.text))).toEqual(new Set([LINES[0].text]));
  }, 10000);
  it("停止すると、くり返しの残りは再生されない", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    await user.click(screen.getByRole("button", { name: "第1文を3回くり返す" }));
    await waitFor(() => expect(spoken.length).toBe(1));
    await user.click(screen.getByRole("button", { name: "停止" }));
    await new Promise((r) => setTimeout(r, 1500));
    expect(spoken.length).toBe(1);
  });
  it("別の文を再生し始めると、前のくり返しは止まる（声が重ならない）", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    await user.click(screen.getByRole("button", { name: "第1文を3回くり返す" }));
    await waitFor(() => expect(spoken.length).toBe(1));
    await user.click(screen.getByRole("button", { name: "第2文を聞く" }));
    await new Promise((r) => setTimeout(r, 1500));
    expect(spoken.map((s) => s.text)).toEqual([LINES[0].text, LINES[1].text]);
  });
  it("「言えた」は自己判定で、押すと数が増え、もう一度押すと取り消せる", async () => {
    const user = userEvent.setup();
    render(<ShadowingPanel lines={LINES} />);
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    expect(screen.getByText(/言えた：0 \/ 2文/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "第1文を言えた" }));
    expect(screen.getByText(/言えた：1 \/ 2文/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "第1文を言えた" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "第1文を言えた" }));
    expect(screen.getByText(/言えた：0 \/ 2文/)).toBeTruthy();
  });
  it("音声が使えない端末では、何も表示しない", () => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    const { container } = render(<ShadowingPanel lines={LINES} />);
    expect(container.textContent).toBe("");
  });
});

describe("リスニング Part 2 の学習画面", () => {
  it("解答すると、解説の中にシャドーイング練習が出て、設問と正解の応答を練習できる", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/listening-part2?mode=all"]}><ListeningPart2Study data={EMPTY} onAnswer={() => {}} onToggleBookmark={() => {}} /></MemoryRouter>);
    const q = (part2 as ListeningPart2Question[])[0];
    expect(screen.queryByRole("button", { name: /シャドーイング練習をする/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^A選択肢/ }));
    await user.click(screen.getByRole("button", { name: /シャドーイング練習をする/ }));
    expect(screen.getAllByText(q.question).length).toBeGreaterThan(0);
    expect(screen.getAllByText(q.choices[q.answer]).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "第2文を聞く" })).toBeTruthy();
  });
});

describe("ディクテーション", () => {
  const start = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: /5文を始める/ }));
  const mount = () => { render(<MemoryRouter><Dictation /></MemoryRouter>); return userEvent.setup(); };
  const play = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole("button", { name: /再生する|もう一度再生する/ })); await waitFor(() => expect(spoken.length).toBeGreaterThan(0)); };

  it("音声が使えない端末では、使えない旨を伝え、始められない", () => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    mount();
    expect(screen.getByText(/英語の音声を再生できない/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /5文を始める/ })).toBeNull();
  });
  it("長さと速さを選べ、選んだ値は記憶される", async () => {
    const user = mount();
    expect(screen.getByRole("button", { name: /^短め/ }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: /^ふつう/ }));
    await user.click(screen.getByRole("button", { name: /^0.75倍/ }));
    expect([localStorage.getItem("toeic-app:dictation-length"), localStorage.getItem("toeic-app:dictation-rate")]).toEqual(["mid", "0.75"]);
    cleanup();
    mount();
    expect(screen.getByRole("button", { name: /^ふつう/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^0.75倍/ }).getAttribute("aria-pressed")).toBe("true");
  });
  it("再生すると選んだ速さで英文が読み上げられ、聞き直すたびに再生回数が増える", async () => {
    const user = mount();
    await user.click(screen.getByRole("button", { name: /^0.75倍/ }));
    await start(user);
    expect(screen.getByText(/ディクテーション ・ 1 \/ 5/)).toBeTruthy();
    await play(user);
    expect(spoken[0].rate).toBe(0.75);
    await user.click(screen.getByRole("button", { name: "もう一度再生する" }));
    await waitFor(() => expect(spoken.length).toBe(2));
    expect(spoken[1].text).toBe(spoken[0].text);
    await waitFor(() => expect(screen.getByText(/再生 2回/)).toBeTruthy());   // 再生が終わると「もう一度聞く（再生 2回）」に戻る
  });
  it("聞き取った英文を入力すると、聞き取れた単語と、聞き取れなかった単語が分かる", async () => {
    const user = mount();
    await start(user);
    await play(user);
    const text = spoken[0].text;
    const words = text.split(/\s+/);
    expect((screen.getByRole("button", { name: "答え合わせ" }) as HTMLButtonElement).disabled).toBe(true);   // 空では確認できない
    await user.type(screen.getByLabelText("聞き取った英文"), words.slice(1).join(" "));                      // 先頭の1語を抜かして入力
    await user.click(screen.getByRole("button", { name: "答え合わせ" }));
    const n = words.length;
    expect(screen.getByText(new RegExp(`聞き取れた単語：${n - 1} / ${n}語`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`聞き取れなかった単語：${words[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeTruthy();
  });
  it("聞き取れなかった単語は、色だけでなく、読み上げ用の文字でも示される", async () => {
    const user = mount();
    await start(user);
    await play(user);
    await user.type(screen.getByLabelText("聞き取った英文"), "zzz");
    await user.click(screen.getByRole("button", { name: "答え合わせ" }));
    expect(screen.getAllByText("（聞き取れなかった）").length).toBeGreaterThan(0);
  });
  it("「わからない」で正解の英文を見られる。5文を終えると結果が出て、もう一度やれる", async () => {
    const user = mount();
    await start(user);
    for (let n = 0; n < 5; n++) {
      await user.click(screen.getByRole("button", { name: "わからない（答えを見る）" }));
      expect(screen.getByText("正解の英文")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: n === 4 ? "結果を見る" : "次の英文へ" }));
    }
    expect(screen.getByText(/聞き取れた単語 0%/)).toBeTruthy();
    expect(screen.getAllByText(/答えを見た/).length).toBe(5);
    await user.click(screen.getByRole("button", { name: "もう一度やる" }));
    expect(screen.getByRole("button", { name: /5文を始める/ })).toBeTruthy();
  });
  it("次の英文へ進むと、入力と再生回数がリセットされる", async () => {
    const user = mount();
    await start(user);
    await play(user);
    await user.type(screen.getByLabelText("聞き取った英文"), "hello");
    await user.click(screen.getByRole("button", { name: "答え合わせ" }));
    await user.click(screen.getByRole("button", { name: "次の英文へ" }));
    expect((screen.getByLabelText("聞き取った英文") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("タップして再生")).toBeTruthy();
  });
});

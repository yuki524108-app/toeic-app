/**
 * ブラウザ標準の Web Speech API (speechSynthesis) を使った英語音声読み上げ。
 * バックエンドや外部APIキーを一切必要とせず、要件定義書の
 * 「バックエンド・認証・課金を持たない構成」という方針に合致する。
 *
 * 音質・利用可能な声は端末・ブラウザのOSに依存する。
 */

export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoadPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/**
 * ブラウザによっては音声リストの読み込みが非同期になるため、
 * voiceschanged イベントを待ってから取得する。
 */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTTSSupported()) return Promise.resolve([]);
  if (cachedVoices.length > 0) return Promise.resolve(cachedVoices);
  if (voicesLoadPromise) return voicesLoadPromise;

  voicesLoadPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    const handle = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        cachedVoices = voices;
        window.speechSynthesis.removeEventListener("voiceschanged", handle);
        resolve(voices);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", handle);
    // 一部ブラウザではイベントが発火しないことがあるためタイムアウトも設定
    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices();
      cachedVoices = voices;
      window.speechSynthesis.removeEventListener("voiceschanged", handle);
      resolve(voices);
    }, 1000);
  });

  return voicesLoadPromise;
}

async function pickEnglishVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const voices = await loadVoices();
  return (
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang?.startsWith("en-US")) ??
    voices.find((v) => v.lang?.startsWith("en")) ??
    voices[0]
  );
}

/**
 * 利用可能な英語音声の一覧を返す（Part 3・4で話者ごとに声を変えるために使用）。
 * 英語音声が1つも見つからない場合は、端末にある全音声を返す。
 */
export async function getEnglishVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = await loadVoices();
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return en.length > 0 ? en : voices;
}

/** 1つの英文を読み上げる。voiceを指定しない場合は既定の英語音声が使われる。再生完了/エラー/中断でresolveする。 */
export function speak(
  text: string,
  rate = 1,
  voice?: SpeechSynthesisVoice
): Promise<void> {
  if (!isTTSSupported()) return Promise.resolve();

  return new Promise((resolve) => {
    const voicePromise = voice ? Promise.resolve(voice) : pickEnglishVoice();
    voicePromise.then((v) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = v?.lang ?? "en-US";
      if (v) utterance.voice = v;
      utterance.rate = rate;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  });
}

/**
 * 複数の英文を順番に読み上げる（設問→選択肢A→B→Cなど）。
 * 各文の間に短い無音区間を挟む。stoppedRef.current が true になったら
 * 途中でも再生を打ち切る。
 */
export async function speakSequence(
  texts: string[],
  rate = 1,
  options?: {
    pauseMs?: number;
    onSegmentStart?: (index: number) => void;
    stoppedRef?: { current: boolean };
  }
): Promise<void> {
  if (!isTTSSupported()) return;
  const pauseMs = options?.pauseMs ?? 700;

  for (let i = 0; i < texts.length; i++) {
    if (options?.stoppedRef?.current) return;
    options?.onSegmentStart?.(i);
    await speak(texts[i], rate);
    if (options?.stoppedRef?.current) return;
    if (i < texts.length - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

/**
 * Part 3・4向け：複数話者のスクリプト（会話・トーク）を順番に読み上げる。
 * 話者名（speaker）ごとに異なる音声を割り当てることで、会話の聞き分けを助ける
 * （Part 4のようにNarrator1人のみの場合は単一の声になる）。
 * stoppedRef.current が true になったら途中でも再生を打ち切る。
 */
export async function speakScript(
  lines: { speaker: string; line: string }[],
  rate = 1,
  options?: {
    pauseMs?: number;
    onLineStart?: (index: number) => void;
    stoppedRef?: { current: boolean };
  }
): Promise<void> {
  if (!isTTSSupported()) return;
  const pauseMs = options?.pauseMs ?? 500;

  const voices = await getEnglishVoices();
  const uniqueSpeakers = [...new Set(lines.map((l) => l.speaker))];
  const speakerVoice = new Map<string, SpeechSynthesisVoice>();
  uniqueSpeakers.forEach((speaker, i) => {
    speakerVoice.set(speaker, voices[i % voices.length]);
  });

  for (let i = 0; i < lines.length; i++) {
    if (options?.stoppedRef?.current) return;
    options?.onLineStart?.(i);
    await speak(lines[i].line, rate, speakerVoice.get(lines[i].speaker));
    if (options?.stoppedRef?.current) return;
    if (i < lines.length - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
}

export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

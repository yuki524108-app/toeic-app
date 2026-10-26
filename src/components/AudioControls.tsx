import type { AudioPlayer } from "../lib/useAudioPlayer";

const RATES = [0.75, 1, 1.25] as const;

export function AudioControls({
  player,
  idleLabel,
  playingLabel,
  onPlay,
}: {
  player: AudioPlayer;
  idleLabel: string;
  /** 再生中の区間に応じた表示。null のときは「再生中…」 */
  playingLabel: (index: number | null) => string | null;
  onPlay: () => void;
}) {
  const { isPlaying, playingIndex, hasPlayedOnce, rate, setRate, stop } = player;
  return (
    <div className="mt-5 flex flex-col items-center">
      <button
        onClick={isPlaying ? stop : onPlay}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper) transition-colors active:opacity-80"
        aria-label={isPlaying ? "停止" : "再生する"}
      >
        {isPlaying ? <StopIcon /> : <PlayIcon />}
      </button>
      <p className="mt-3 text-xs text-(--color-muted)">
        {isPlaying
          ? (playingLabel(playingIndex) ?? "再生中…")
          : hasPlayedOnce
            ? "もう一度再生する"
            : idleLabel}
      </p>
      <div className="mt-4 flex gap-2">
        {RATES.map((r) => (
          <button
            key={r}
            onClick={() => setRate(r)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              rate === r
                ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)"
                : "border-(--color-line) text-(--color-muted)"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.68-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

import { BookmarkIcon } from "../../pages/WordStudy";

export function BookmarkToggle({
  id,
  bookmarks,
  onToggleBookmark,
  className = "absolute right-3 top-3 z-10 p-1.5",
}: {
  id: string;
  bookmarks: string[];
  onToggleBookmark: (id: string) => void;
  className?: string;
}) {
  const on = bookmarks.includes(id);
  return (
    <button
      onClick={() => onToggleBookmark(id)}
      aria-label={on ? "ブックマークを外す" : "ブックマークする"}
      className={className}
    >
      <BookmarkIcon filled={on} />
    </button>
  );
}

export function NextButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)"
    >
      {children}
    </button>
  );
}

export function TtsNotice({ what }: { what: string }) {
  return (
    <div className="mt-4 rounded-sm border border-(--color-incorrect) bg-(--color-incorrect-soft) p-3 text-xs leading-relaxed text-(--color-incorrect)">
      お使いのブラウザは音声読み上げに対応していないため、代わりに{what}を表示しています。
    </div>
  );
}

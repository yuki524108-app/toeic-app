import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "ホーム", icon: HomeIcon },
  { to: "/words", label: "単語", icon: WordIcon },
  { to: "/grammar", label: "文法", icon: GrammarIcon },
  { to: "/review", label: "復習", icon: ReviewIcon },
  { to: "/progress", label: "進捗", icon: ProgressIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-(--color-line) bg-(--color-paper-raised)">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                isActive ? "text-(--color-ink)" : "text-(--color-muted)"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span className={isActive ? "font-semibold" : ""}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WordIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
    </svg>
  );
}
function GrammarIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
      <path d="M9 4h9v16H9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 4v16M4 4h4M4 20h4" strokeLinecap="round" />
    </svg>
  );
}
function ReviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
      <path d="M4 12a8 8 0 1 1 2.5 5.8" strokeLinecap="round" />
      <path d="M4 17v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
      <path d="M5 19V10M12 19V5M19 19v-7" strokeLinecap="round" />
    </svg>
  );
}

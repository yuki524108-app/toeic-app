export function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "#C9932C" : "none"}
      stroke={filled ? "#C9932C" : "#8891AC"}
      strokeWidth="1.8"
    >
      <path
        d="M5 3v18M5 4h11l-2.5 3L16 10H5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

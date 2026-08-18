export function WowMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path
        d="M12 20L22 44L32 26L42 44L52 20"
        stroke="#38BDF8"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

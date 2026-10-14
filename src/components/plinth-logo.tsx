// Plinth brand mark — a stepped pedestal (the "plinth" a structure stands on).
// Uses currentColor so it inherits the surrounding text color (e.g. white on the indigo tile).
export function PlinthMark({ className = '', size = 20 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-hidden="true" className={className}>
      <rect x="13" y="7" width="14" height="6.5" rx="2" fill="currentColor" />
      <rect x="8" y="16.5" width="24" height="6.5" rx="2" fill="currentColor" />
      <rect x="3" y="26" width="34" height="7.5" rx="2" fill="currentColor" />
    </svg>
  );
}

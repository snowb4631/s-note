// Same drawing as src/app/icon.svg.
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M29.3 6.6A11 11 0 0 1 45.5 10.4A11 11 0 0 1 56.0 23.3A11 11 0 0 1 56.5 39.0A11 11 0 0 1 47.7 52.1A11 11 0 0 1 32.0 57.5A11 11 0 0 1 16.3 52.1A11 11 0 0 1 7.5 39.0A11 11 0 0 1 8.0 23.3A11 11 0 0 1 18.5 10.4A11 11 0 0 1 29.3 6.6Z"
        fill="#FBF7E9"
        stroke="#1E2A4A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M15 18.5 49 17 50 29 14 30.5Z" fill="#FFE14D" />
      <g fill="none" stroke="#1E2A4A" strokeWidth="4" strokeLinecap="round">
        <path d="M18 25C26 23.5 38 25.5 46 24" />
        <path d="M16 35C26 33.5 38 35.5 48 34" />
        <path d="M20 45C26 44 33 45.5 39 44.5" />
      </g>
    </svg>
  );
}

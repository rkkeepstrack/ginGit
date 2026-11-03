export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 81.15 130.01" width={size * 0.624} height={size} aria-hidden>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M40.91 80.01v40" strokeWidth={4} />
        <path d="M10 10c1.82 5 9.09 21.67 10.91 30.01 1.82 8.33-3.33 13.33 0 20 3.33 6.67 13.33 20 20 20s16.67-13.33 20-20c3.33-6.67-1.71-11.67 0-20 1.71-8.34 8.54-25.01 10.24-30.01" strokeWidth={4} />
        <path d="M20.91 40.01h40" strokeWidth={2} />
        <path d="M20.91 120.01h40" strokeWidth={4} />
      </g>
      <path d="M40.91 80.01l-5.47-2.19-5.78-5.31-9.28-13.71.53-18.79h40l.53 18.79-9.28 13.71-5.78 5.31z" fill="#a5d8ff" />
    </svg>
  )
}

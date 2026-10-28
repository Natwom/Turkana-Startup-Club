export default function VerifiedBadge({ className = 'h-4 w-4' }) {
  return (
    <span title="Verified member" aria-label="Verified member"
      className="inline-flex shrink-0 items-center align-middle">
      <svg viewBox="0 0 24 24" className={`${className} text-sky-500`} fill="currentColor" aria-hidden="true">
        <path d="M12 1.5l2.76 1.9 3.33.1.98 3.19 2.63 2.04-1 3.17 1 3.17-2.63 2.04-.98 3.19-3.33.1L12 22.5l-2.76-1.9-3.33-.1-.98-3.19L2.28 15.27l1-3.17-1-3.17 2.63-2.04.98-3.19 3.33-.1L12 1.5z" />
        <path d="M8.5 12.2l2.4 2.4 4.7-4.9" fill="none" stroke="white" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
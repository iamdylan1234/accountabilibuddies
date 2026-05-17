/**
 * Small inline spinner — drop next to button labels to indicate pending state.
 *
 * Pure CSS animation, no JS, no external dependencies. Color inherits from
 * parent via `currentColor` so it adapts to the button's text colour.
 *
 * Usage:
 *   <button disabled={pending}>
 *     {pending ? <><Spinner /> Saving…</> : 'Save'}
 *   </button>
 */
export default function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

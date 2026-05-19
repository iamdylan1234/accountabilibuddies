'use client'

interface Props {
  weekStart: string  // "YYYY-MM-DD"
  weekEnd: string    // "YYYY-MM-DD"
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
}

function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function WeekHeader({ weekStart, weekEnd, canGoPrev, canGoNext, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Previous week"
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-95"
      >
        ‹
      </button>
      <p className="text-xs font-bold text-gray-600 tracking-wider uppercase">
        {shortDate(weekStart)} – {shortDate(weekEnd)}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next week"
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-95"
      >
        ›
      </button>
    </div>
  )
}

interface Props {
  value: string
  label: string
  subtitle?: string        // small text below label (e.g. "Attend BJJ · Alex")
  onClick?: () => void
  children?: React.ReactNode  // inline expansion content (win rate breakdown)
}

export default function StatTile({ value, label, subtitle, onClick, children }: Props) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={[
          'rounded-2xl bg-gray-50 px-2 py-4 text-center transition',
          onClick ? 'active:scale-95 hover:bg-gray-100 cursor-pointer' : 'cursor-default',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        ].join(' ')}
      >
        <p className="text-xl font-black text-gray-800 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 font-semibold mt-0.5">{label}</p>
        {subtitle && (
          <p className="text-gray-300 mt-1 leading-tight px-1 truncate"
            style={{ fontSize: '9px' }}>
            {subtitle}
          </p>
        )}
      </button>

      {/* Inline expansion (e.g. win/loss/tie breakdown) */}
      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  )
}

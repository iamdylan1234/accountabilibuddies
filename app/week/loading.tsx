export default function WeekLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Header banner */}
      <div className="rounded-2xl h-28 bg-gray-200 mb-6" />

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl h-24 bg-gray-200" />
        <div className="rounded-2xl h-24 bg-gray-200" />
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(col => (
          <div key={col} className="space-y-2">
            <div className="h-5 w-16 bg-gray-200 rounded-full mb-3" />
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl h-20 bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

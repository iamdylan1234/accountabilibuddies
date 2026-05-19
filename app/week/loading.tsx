export default function WeekLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Week header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
        <div className="h-3 w-32 bg-gray-200 rounded-full" />
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </div>

      {/* Week strip placeholder */}
      <div className="bg-gray-100 rounded-2xl p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-[56px]" />
          <div className="flex gap-1 flex-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-3 bg-gray-200 rounded-full mx-1" />
            ))}
          </div>
        </div>
        {[0, 1].map(row => (
          <div key={row} className="flex items-center gap-2 py-1">
            <div className="w-[56px] h-3 bg-gray-200 rounded-full" />
            <div className="flex gap-1 flex-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 flex justify-center">
                  <div className="w-[18px] h-[18px] rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Score tiles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl h-24 bg-gray-200" />
        <div className="rounded-2xl h-24 bg-gray-200" />
      </div>

      {/* Day-detail header */}
      <div className="h-3 w-40 bg-gray-200 rounded-full mb-3" />

      {/* Goal sections (one section sketch) */}
      <div className="bg-gray-100 rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(col => (
            <div key={col} className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-xl h-16 bg-gray-200" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

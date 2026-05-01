export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Header card */}
      <div className="rounded-2xl p-6 mb-6 h-28 bg-gray-200" />

      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(col => (
          <div key={col}>
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

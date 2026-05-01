export default function MonthLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-48 bg-gray-200 rounded-full mb-6" />

      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between mb-2">
              <div className="h-4 w-32 bg-gray-200 rounded-full" />
              <div className="h-4 w-10 bg-gray-200 rounded-full" />
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div className="h-2 bg-gray-200 rounded-full w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

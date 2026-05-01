export default function WrapUpLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Score cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl p-6 h-32 bg-gray-200" />
        ))}
      </div>

      {/* Goal rows */}
      <div className="h-6 w-40 bg-gray-200 rounded-full mb-4" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex justify-between items-center py-2">
            <div className="h-4 w-36 bg-gray-200 rounded-full" />
            <div className="h-4 w-12 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

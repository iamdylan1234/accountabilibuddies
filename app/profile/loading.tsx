export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      {/* Avatar skeleton */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-24 h-24 rounded-full bg-gray-200" />
        <div className="h-5 w-32 bg-gray-200 rounded-full" />
        <div className="h-4 w-40 bg-gray-100 rounded-full" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
        ))}
      </div>

      {/* History skeleton */}
      <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
      {[0, 1, 2].map(i => (
        <div key={i} className="h-20 bg-gray-100 rounded-2xl mb-3" />
      ))}
    </div>
  )
}

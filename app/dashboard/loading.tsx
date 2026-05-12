import { BRAND_GRADIENT } from '@/lib/brand'

export default function DashboardLoading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center text-white px-6 overflow-hidden"
      style={{ background: BRAND_GRADIENT }}
    >
      {/* Yellow halo glow behind logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(249,248,113,0.30) 0%, rgba(249,248,113,0) 65%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo card */}
        <div className="w-36 h-36 rounded-3xl overflow-hidden bg-white shadow-xl mb-9 p-2.5">
          <img
            src="/icon.png"
            alt="Accountabilibuddies"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-center mb-2">
          2 mates.
        </h1>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-center">
          No excuses.
        </h1>
      </div>

      {/* Wordmark */}
      <div
        className="absolute z-10 text-[10px] font-bold tracking-[2.5px] uppercase"
        style={{
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        accountabilibuddies
      </div>
    </div>
  )
}

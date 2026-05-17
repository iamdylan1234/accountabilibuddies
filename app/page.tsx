import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BRAND_GRADIENT } from '@/lib/brand'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className="relative flex flex-col items-center justify-center flex-1 text-white px-6 py-24 text-center overflow-hidden"
        style={{ background: BRAND_GRADIENT }}
      >
        {/* Yellow halo glow behind the logo */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '22%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,248,113,0.28) 0%, rgba(249,248,113,0) 65%)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-32 h-32 rounded-3xl overflow-hidden bg-white shadow-xl mb-8 p-2.5">
            <img src="/icon.png" alt="Accountabilibuddies" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-2 leading-none">
            2 mates.
          </h1>
          <h1 className="text-5xl font-black tracking-tight mb-10 leading-none">
            No excuses.
          </h1>
          <div className="flex gap-3">
            <Link
              href="/auth/signup"
              className="px-7 py-3 rounded-full font-bold text-sm transition active:scale-95"
              style={{ background: '#F9F871', color: '#0077B6', boxShadow: '0 4px 16px rgba(249,248,113,0.35)' }}
            >
              Start a month →
            </Link>
            <Link
              href="/auth/login"
              className="px-7 py-3 rounded-full font-bold text-sm border-2 border-white/40 hover:bg-white/10 transition"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4">How it works</h2>
          <div className="grid grid-cols-3 gap-8 mt-10">
            <div>
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-bold text-gray-900 mb-1">Set goals</h3>
              <p className="text-sm text-gray-500">Choose 5–8 goals for the 30 days</p>
            </div>
            <div>
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-bold text-gray-900 mb-1">Log daily</h3>
              <p className="text-sm text-gray-500">Check in every day, see your buddy in real time</p>
            </div>
            <div>
              <div className="text-4xl mb-3">🏆</div>
              <h3 className="font-bold text-gray-900 mb-1">Win together</h3>
              <p className="text-sm text-gray-500">Weekly summaries, friendly competition</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

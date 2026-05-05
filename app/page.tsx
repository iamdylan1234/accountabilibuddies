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
        className="flex flex-col items-center justify-center flex-1 text-white px-6 py-24 text-center"
        style={{ background: BRAND_GRADIENT }}
      >
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Accountabilibuddies
        </h1>
        <p className="text-xl text-white/80 max-w-md mb-10">
          Set goals. Track daily. Hold each other accountable. One month at a time.
        </p>
        <div className="flex gap-4">
          <Link
            href="/auth/signup"
            className="px-8 py-3 rounded-full font-bold text-sm"
            style={{ background: '#F9F871', color: '#0077B6' }}
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 rounded-full font-bold text-sm bg-white/20 hover:bg-white/30 transition"
          >
            Log in
          </Link>
        </div>
      </div>

      <div className="bg-white py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4">How it works</h2>
          <div className="grid grid-cols-3 gap-8 mt-10">
            <div>
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-bold text-gray-900 mb-1">Set goals</h3>
              <p className="text-sm text-gray-500">Choose 5–8 goals for the month</p>
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

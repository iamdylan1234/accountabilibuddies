'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BRAND_GRADIENT } from '@/lib/brand'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const next = searchParams.get('next') ?? '/dashboard'
    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-1">Log in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-700">Password</label>
              <Link href="/auth/forgot-password" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Your password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-red-600 text-sm font-medium">
                {/^invalid (login credentials|email or password)/i.test(error)
                  ? 'Email or password is incorrect.'
                  : error}
              </p>
              <Link
                href="/auth/forgot-password"
                className="inline-block mt-1 text-xs font-bold text-teal-600 hover:text-teal-700"
              >
                Forgot your password? Reset it →
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition"
            style={{ background: BRAND_GRADIENT }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link href="/auth/signup" className="font-semibold text-teal-600">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

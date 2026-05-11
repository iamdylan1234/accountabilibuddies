'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BRAND_GRADIENT } from '@/lib/brand'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Check existing session (Supabase auto-handles the recovery link's hash)
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session)
    })

    // Listen for PASSWORD_RECOVERY event in case session arrives later
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Set new password</h1>
          <p className="text-gray-500 mt-1">
            {success ? 'Password updated. Redirecting…' : 'Enter your new password below.'}
          </p>
        </div>

        {sessionReady === false && !success && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-gray-700 mb-4">
            <p className="font-semibold text-amber-700 mb-1">Link not valid</p>
            <p>
              This reset link may have expired or already been used. <Link href="/auth/forgot-password" className="text-teal-600 font-semibold underline">Request a new one</Link>.
            </p>
          </div>
        )}

        {sessionReady === null && !success && (
          <p className="text-sm text-gray-400">Verifying link…</p>
        )}

        {sessionReady && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="At least 8 characters"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Re-enter the password"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {success && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-sm text-gray-700">
            <p className="font-semibold text-teal-700">✓ Password updated</p>
            <p className="mt-1">Taking you to the dashboard…</p>
          </div>
        )}
      </div>
    </div>
  )
}

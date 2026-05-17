'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BRAND_GRADIENT } from '@/lib/brand'
import Spinner from '@/components/shared/Spinner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    // Always show success even if the email doesn't exist (don't leak account existence)
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Reset password</h1>
          <p className="text-gray-500 mt-1">
            {sent
              ? 'Check your inbox for a reset link.'
              : 'Enter your email and we\'ll send you a reset link.'}
          </p>
        </div>

        {!sent ? (
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
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white text-sm transition active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
              style={{ background: BRAND_GRADIENT }}
            >
              {loading ? (<><Spinner /><span>Sending…</span></>) : <span>Send reset link</span>}
            </button>
          </form>
        ) : (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-sm text-gray-700">
            <p className="font-semibold text-teal-700 mb-1">✓ Email sent</p>
            <p>
              If <strong>{email}</strong> matches an account, you&apos;ll receive a reset link within a minute. The link is single-use and expires after 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/auth/login" className="font-semibold text-teal-600">← Back to log in</Link>
        </p>
      </div>
    </div>
  )
}

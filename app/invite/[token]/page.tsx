import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from './actions'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  const supabase = await createClient()
  const { data: challenge } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(name)')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-gray-900">Invite not found</h1>
          <p className="text-gray-500 mt-2">This invite has already been used or doesn't exist.</p>
        </div>
      </div>
    )
  }

  const creator = challenge.creator as { name: string }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div
          className="rounded-2xl p-8 text-white mb-6"
          style={{ background: 'linear-gradient(135deg, #00C9A7, #0077B6)' }}
        >
          <p className="text-white/80 text-sm font-semibold uppercase tracking-wide mb-2">
            You've been invited
          </p>
          <h1 className="text-3xl font-black mb-1">{challenge.month_name}</h1>
          <p className="text-white/70 text-sm">by {creator.name}</p>
        </div>

        <p className="text-gray-500 text-sm mb-8">
          Join {creator.name}'s challenge, set your goals, and hold each other accountable.
        </p>

        <form action={acceptInvite.bind(null, token)}>
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: '#F9F871', color: '#0077B6' }}
          >
            Accept invite & set my goals →
          </button>
        </form>
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'
import { sendMonthlyWrapUp } from '@/lib/email'
import { scoreChallenge } from '@/lib/scoring'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: challenges } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')
    .eq('end_date', today)

  if (!challenges) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const challenge of challenges) {
    await supabase
      .from('challenge_months')
      .update({ status: 'completed' })
      .eq('id', challenge.id)

    const buddyId = challenge.buddy_id
    if (!buddyId) continue

    const [goalsRes, creatorCheckInsRes, buddyCheckInsRes, creatorAuthRes, buddyAuthRes] =
      await Promise.all([
        supabase.from('goals').select('*').eq('challenge_id', challenge.id),
        supabase.from('check_ins').select('*').eq('user_id', challenge.creator_id),
        supabase.from('check_ins').select('*').eq('user_id', buddyId),
        supabase.auth.admin.getUserById(challenge.creator_id),
        supabase.auth.admin.getUserById(buddyId),
      ])

    const allGoals = goalsRes.data ?? []
    const creatorGoals = allGoals.filter(g => g.user_id === challenge.creator_id)
    const buddyGoals = allGoals.filter(g => g.user_id === buddyId)
    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const creatorScore = scoreChallenge(creatorGoals, creatorCheckInsRes.data ?? [], totalDays)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckInsRes.data ?? [], totalDays)
    const creatorWon = creatorScore > buddyScore
    const tied = creatorScore === buddyScore

    const creatorEmail = creatorAuthRes.data.user?.email
    const buddyEmail = buddyAuthRes.data.user?.email
    const creatorName = (challenge.creator as any)?.name ?? 'Friend'
    const buddyName = (challenge.buddy as any)?.name ?? 'Friend'

    if (creatorEmail) {
      await sendMonthlyWrapUp({
        toEmail: creatorEmail, toName: creatorName, buddyName,
        myScore: creatorScore, buddyScore, challengeName: challenge.month_name,
        won: creatorWon, tied,
      })
      sent++
    }

    if (buddyEmail) {
      await sendMonthlyWrapUp({
        toEmail: buddyEmail, toName: buddyName, buddyName: creatorName,
        myScore: buddyScore, buddyScore: creatorScore, challengeName: challenge.month_name,
        won: !creatorWon && !tied, tied,
      })
      sent++
    }
  }

  return NextResponse.json({ sent })
}

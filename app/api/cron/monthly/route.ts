import { createClient } from '@supabase/supabase-js'
import { sendMonthlyWrapUp } from '@/lib/email'
import { scoreChallenge } from '@/lib/scoring'
import { NextResponse } from 'next/server'
import type { ChallengeWithProfiles } from '@/types/database'

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // UTC "today". A challenge completes once the calendar has rolled PAST its
  // end_date — i.e. its final day is fully over. Using `< today` (not the old
  // `= today`) fixes two things:
  //   1. Timing: the challenge stays active through ALL of its end_date and
  //      flips at the next UTC midnight (this route is scheduled at 00:00 UTC),
  //      instead of being cut off at 9am on the final day mid-challenge.
  //   2. Self-healing: if a daily run is ever missed (deploy, outage, cron
  //      throttling), the next run still catches any active challenge whose
  //      end_date has passed — an exact `= today` match would skip it forever.
  const today = new Date().toISOString().split('T')[0]

  const { data: challenges, error: challengesError } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .eq('status', 'active')
    .lt('end_date', today)

  if (challengesError) {
    console.error('Failed to fetch challenges:', challengesError)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }

  if (!challenges) return NextResponse.json({ sent: 0, failed: 0 })

  let sent = 0
  let failed = 0

  for (const challenge of challenges) {
    const buddyId = challenge.buddy_id
    if (!buddyId) continue  // guard FIRST

    // THEN update status
    const { error: updateError } = await supabase
      .from('challenge_months')
      .update({ status: 'completed' })
      .eq('id', challenge.id)

    if (updateError) {
      console.error('Failed to mark challenge completed:', challenge.id, updateError)
      failed++
      continue
    }

    const [goalsRes, creatorCheckInsRes, buddyCheckInsRes, creatorAuthRes, buddyAuthRes] =
      await Promise.all([
        supabase.from('goals').select('*').eq('challenge_id', challenge.id),
        supabase.from('check_ins').select('*').eq('user_id', challenge.creator_id).gte('date', challenge.start_date).lte('date', challenge.end_date),
        supabase.from('check_ins').select('*').eq('user_id', buddyId).gte('date', challenge.start_date).lte('date', challenge.end_date),
        supabase.auth.admin.getUserById(challenge.creator_id),
        supabase.auth.admin.getUserById(buddyId),
      ])

    if (goalsRes.error) console.error('goals query failed:', goalsRes.error)
    if (creatorCheckInsRes.error) console.error('creator check-ins query failed:', creatorCheckInsRes.error)
    if (buddyCheckInsRes.error) console.error('buddy check-ins query failed:', buddyCheckInsRes.error)
    if (creatorAuthRes.error) console.error('auth lookup failed for creator:', challenge.creator_id, creatorAuthRes.error)
    if (buddyAuthRes.error) console.error('auth lookup failed for buddy:', buddyId, buddyAuthRes.error)

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
    // Supabase infers a different type from the join — cast to our app type for type-safe field access
    const typedChallenge = challenge as unknown as ChallengeWithProfiles
    const creatorName = typedChallenge.creator?.name ?? 'Friend'
    const buddyName = typedChallenge.buddy?.name ?? 'Friend'

    if (creatorEmail) {
      try {
        await sendMonthlyWrapUp({
          toEmail: creatorEmail, toName: creatorName, buddyName,
          myScore: creatorScore, buddyScore, challengeName: challenge.month_name,
          won: creatorWon, tied,
        })
        sent++
      } catch (err) {
        console.error('Failed to send email to', creatorEmail, err)
        failed++
      }
    }

    if (buddyEmail) {
      try {
        await sendMonthlyWrapUp({
          toEmail: buddyEmail, toName: buddyName, buddyName: creatorName,
          myScore: buddyScore, buddyScore: creatorScore, challengeName: challenge.month_name,
          won: !creatorWon && !tied, tied,
        })
        sent++
      } catch (err) {
        console.error('Failed to send email to', buddyEmail, err)
        failed++
      }
    }
  }

  return NextResponse.json({ sent, failed })
}

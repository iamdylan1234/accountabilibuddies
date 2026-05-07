import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAvatarUrl } from '@/lib/avatar'
import ProfileClient from '@/components/profile/ProfileClient'
import type { ChallengeWithProfiles, Goal, CheckIn, Profile } from '@/types/database'
import { getBestStreak, getCurrentStreak, scoreChallenge } from '@/lib/scoring'
import type { BestStreakResult, GoalStreakContext } from '@/lib/scoring'

export interface ProfileStats {
  totalChallenges: number
  wins: number
  losses: number
  ties: number
  bestStreak: BestStreakResult | null
  currentStreak: { days: number; goalTitle: string } | null
  totalCheckIns: number
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Fetch all challenges this user participated in
  const { data: challengesData } = await supabase
    .from('challenge_months')
    .select('*, creator:profiles!creator_id(*), buddy:profiles!buddy_id(*)')
    .or(`creator_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const challenges = (challengesData ?? []) as ChallengeWithProfiles[]
  const challengeIds = challenges.map(c => c.id)

  // Collect all unique user IDs from challenges (user + all buddies)
  const allUserIds = [...new Set([
    user.id,
    ...challenges.flatMap(c => [c.creator_id, c.buddy_id].filter((id): id is string => !!id)),
  ])]

  // Fetch all goals and check-ins for all challenges
  const [allGoalsRes, allCheckInsRes] = await (challengeIds.length > 0
    ? Promise.all([
        supabase.from('goals').select('*').in('challenge_id', challengeIds),
        supabase.from('check_ins').select('*').in('user_id', allUserIds),
      ])
    : Promise.resolve([{ data: [] }, { data: [] }]))

  const allGoals: Goal[] = allGoalsRes.data ?? []
  const allCheckIns: CheckIn[] = allCheckInsRes.data ?? []

  const today = new Date().toISOString().split('T')[0]

  // ── Stat computation ─────────────────────────────────────────────────────────

  const userCheckIns = allCheckIns.filter(c => c.user_id === user.id)

  // Total completed check-ins (user only)
  const totalCheckIns = userCheckIns.filter(c => c.completed).length

  // Win / loss / tie on completed challenges
  const completedChallenges = challenges.filter(c => c.status === 'completed')
  let wins = 0, losses = 0, ties = 0

  for (const challenge of completedChallenges) {
    const buddyId = challenge.creator_id === user.id ? challenge.buddy_id : challenge.creator_id
    if (!buddyId) continue

    const myGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === user.id)
    const buddyGoals = allGoals.filter(g => g.challenge_id === challenge.id && g.user_id === buddyId)
    const myCheckIns = allCheckIns.filter(c => c.user_id === user.id && myGoals.some(g => g.id === c.goal_id))
    const buddyCheckIns = allCheckIns.filter(c => c.user_id === buddyId && buddyGoals.some(g => g.id === c.goal_id))

    const totalDays = Math.floor(
      (new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000
    ) + 1

    const myScore = scoreChallenge(myGoals, myCheckIns, totalDays, challenge.start_date, challenge.end_date, true)
    const buddyScore = scoreChallenge(buddyGoals, buddyCheckIns, totalDays, challenge.start_date, challenge.end_date, true)

    if (myScore > buddyScore) wins++
    else if (myScore < buddyScore) losses++
    else ties++
  }

  // Best streak (user's own goals only)
  const userGoals = allGoals.filter(g => g.user_id === user.id)
  const goalContexts: GoalStreakContext[] = userGoals.map(goal => {
    const challenge = challenges.find(c => c.id === goal.challenge_id)
    const buddyProfile = challenge
      ? (challenge.creator_id === user.id ? challenge.buddy : challenge.creator) as Profile | null
      : null
    return {
      goal,
      challengeName: challenge?.month_name ?? '',
      buddyName: buddyProfile?.name ?? 'Buddy',
    }
  })
  const bestStreak = getBestStreak(goalContexts, userCheckIns)

  // Current streak: best active streak across the active challenge's goals
  const activeChallenge = challenges.find(c => c.status === 'active') ?? null
  let currentStreak: { days: number; goalTitle: string } | null = null

  if (activeChallenge) {
    const activeGoals = userGoals.filter(g => g.challenge_id === activeChallenge.id)
    let maxDays = 0
    let maxTitle = ''
    for (const goal of activeGoals) {
      const goalCheckIns = userCheckIns.filter(c => c.goal_id === goal.id)
      const days = getCurrentStreak(goal, goalCheckIns, today)
      if (days > maxDays) {
        maxDays = days
        maxTitle = goal.title
      }
    }
    if (maxDays > 0) currentStreak = { days: maxDays, goalTitle: maxTitle }
  }

  const stats: ProfileStats = {
    totalChallenges: completedChallenges.length,
    wins,
    losses,
    ties,
    bestStreak,
    currentStreak,
    totalCheckIns,
  }

  const avatarUrl = getAvatarUrl(user.id, profile.avatar_style)

  return (
    <ProfileClient
      profile={profile}
      activeChallenge={activeChallenge}
      challenges={challenges}
      allGoals={allGoals}
      allCheckIns={allCheckIns}
      stats={stats}
      avatarUrl={avatarUrl}
      userId={user.id}
    />
  )
}

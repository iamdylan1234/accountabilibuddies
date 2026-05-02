export type GoalType = 'daily' | 'milestone' | 'frequency'
export type ChallengeStatus = 'pending' | 'active' | 'completed'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  notification_time: string
  created_at: string
}

export interface ChallengeMonth {
  id: string
  creator_id: string
  buddy_id: string | null
  invite_token: string
  month_name: string
  start_date: string
  end_date: string
  status: ChallengeStatus
  created_at: string
}

export interface Goal {
  id: string
  challenge_id: string
  user_id: string
  title: string
  type: GoalType
  target_count: number | null
  created_at: string
  schedule_days: number[] | null   // null = every day; [0]=Sun [1]=Mon…[6]=Sat
  catch_up: boolean                // show every day when behind on scheduled days
}

export interface CheckIn {
  id: string
  goal_id: string
  user_id: string
  date: string
  completed: boolean
  created_at: string
}

export interface Reaction {
  id: string
  check_in_id: string
  from_user_id: string
  emoji: string
  created_at: string
}

// Joined types used in components
export interface GoalWithCheckIns extends Goal {
  check_ins: CheckIn[]
}

export interface ChallengeWithProfiles extends ChallengeMonth {
  creator: Profile
  buddy: Profile | null
}

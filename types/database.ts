export type GoalType = 'daily' | 'milestone' | 'frequency' | 'cumulative'
export type ChallengeStatus = 'pending' | 'active' | 'completed'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null      // reserved for future photo upload
  avatar_style: string           // DiceBear style slug, default 'avataaars'
  notification_time: string
  created_at: string
  daily_message: string | null
  message_date: string | null
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
  target_unit: string | null       // display label for quantity (e.g. "km")
  created_at: string
  schedule_dates: string[] | null  // specific "YYYY-MM-DD" dates; null = every day
  catch_up: boolean
}

export interface CheckIn {
  id: string
  goal_id: string
  user_id: string
  date: string
  completed: boolean
  value: number | null   // set for cumulative goals
  created_at: string
}

export interface Reaction {
  id: string
  check_in_id: string
  from_user_id: string
  emoji: string
  created_at: string
}

export interface GoalWithCheckIns extends Goal {
  check_ins: CheckIn[]
}

export interface ChallengeWithProfiles extends ChallengeMonth {
  creator: Profile
  buddy: Profile | null
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected'

export interface GoalChangeRequest {
  id: string
  goal_id: string
  challenge_id: string
  requester_id: string
  proposed_title: string
  proposed_type: GoalType
  proposed_target_count: number | null
  proposed_target_unit: string | null
  proposed_schedule_dates: string[] | null
  proposed_catch_up: boolean
  status: ChangeRequestStatus
  created_at: string
}

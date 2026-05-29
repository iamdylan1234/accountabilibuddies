import { BRAND_GRADIENT } from '@/lib/brand'
import RematchButton from './RematchButton'

interface Props {
  challengeName: string
  myName: string
  buddyName: string
  myScore: number   // 0–100, must match the Summary tab (scoreChallenge with useTargetCount)
  buddyScore: number
  result: 'won' | 'lost' | 'tied'
  rematchOf?: string
}

/**
 * Shown on Today when the user's most recent challenge is completed and they
 * have no active/pending one — replaces the bare "Start a challenge" form so
 * the end-of-challenge result isn't a blank slate. Shows the headline result;
 * the full breakdown lives on the Summary tab (the "See full results" link).
 */
export default function CompletionCard({ challengeName, myName, buddyName, myScore, buddyScore, result, rematchOf }: Props) {
  const headline =
    result === 'won' ? '🎉 You won!'
    : result === 'tied' ? '🤝 It’s a tie!'
    : `${buddyName} won this one`

  return (
    <div className="rounded-2xl p-6 text-white text-center shadow-sm" style={{ background: BRAND_GRADIENT }}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Challenge complete</p>
      <h2 className="text-xl font-black mt-1">{challengeName}</h2>
      <p className="text-lg font-black mt-4">{headline}</p>

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className={result === 'won' ? '' : 'opacity-80'}>
          <p className="text-3xl font-black leading-none">{myScore}%</p>
          <p className="text-xs text-white/70 mt-1">{myName}</p>
        </div>
        <div className="text-white/50 font-black text-sm">vs</div>
        <div className={result === 'lost' ? '' : 'opacity-80'}>
          <p className="text-3xl font-black leading-none">{buddyScore}%</p>
          <p className="text-xs text-white/70 mt-1">{buddyName}</p>
        </div>
      </div>

      <a
        href="/wrap-up"
        className="inline-block mt-5 text-sm font-bold underline underline-offset-4 text-white/90 active:opacity-70"
      >
        See full results →
      </a>
      {rematchOf && <RematchButton finishedChallengeId={rematchOf} buddyName={buddyName} />}
    </div>
  )
}

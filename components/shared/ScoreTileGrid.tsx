'use client'

import { BRAND_GRADIENT } from '@/lib/brand'

export interface TileData {
  name: string
  mainValue: string  // e.g. "23%", "2/5", "—"
  subLabel: string   // e.g. "week score", "goals today", "5/30 days active"
  isWinner: boolean
  dimmed?: boolean   // optional opacity-70 (used by Dashboard's refresh indicator)
}

interface Props {
  left: TileData
  right: TileData
  tied: boolean
  bothPerfect: boolean
  selectNone?: boolean  // adds select-none + cursor-default (WeekView)
}

function TileLabel({
  isWinner, tied, bothPerfect,
}: { isWinner: boolean; tied: boolean; bothPerfect: boolean }) {
  if (bothPerfect) return <p className="text-xs font-black text-yellow-300 mb-1">🎉 Perfect!</p>
  if (isWinner)    return <p className="text-xs font-black text-yellow-300 mb-1">⚡ AHEAD</p>
  if (tied)        return <p className="text-xs font-black text-white/50 mb-1">💪 Keep Going</p>
  return           <p className="text-xs mb-1">&nbsp;</p>
}

export default function ScoreTileGrid({ left, right, tied, bothPerfect, selectNone = false }: Props) {
  return (
    <div className={`grid grid-cols-2 gap-4 mb-4${selectNone ? ' select-none' : ''}`}>
      {[left, right].map(tile => (
        <div
          key={tile.name}
          className={[
            'rounded-2xl p-4 text-center transition-opacity duration-300',
            selectNone ? 'cursor-default' : '',
            tile.dimmed ? 'opacity-70' : 'opacity-100',
          ].filter(Boolean).join(' ')}
          style={{ background: BRAND_GRADIENT }}
        >
          <TileLabel isWinner={tile.isWinner} tied={tied} bothPerfect={bothPerfect} />
          <p className="text-sm font-bold text-white/70">{tile.name}</p>
          <p className="text-4xl font-black mt-1 text-white">{tile.mainValue}</p>
          <p className="text-xs text-white/60 mt-1">{tile.subLabel}</p>
        </div>
      ))}
    </div>
  )
}

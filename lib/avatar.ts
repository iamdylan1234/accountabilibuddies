const DICEBEAR_BASE = 'https://api.dicebear.com/9.x'
const DEFAULT_STYLE = 'avataaars'

export function getAvatarUrl(userId: string, style?: string): string {
  const s = style?.trim() || DEFAULT_STYLE
  return `${DICEBEAR_BASE}/${s}/svg?seed=${userId}`
}

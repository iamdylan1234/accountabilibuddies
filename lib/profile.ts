/**
 * Shared rule for extracting a display first name from a Profile-like object.
 * Used by the notification body, the buzz banner copy, and the /profile toggle
 * caption — keep them consistent by going through this helper.
 *
 * Rule: substring before the first space in `name`, trimmed.
 * Fallback: 'Your buddy' if name is null, empty, or whitespace-only.
 */
export function firstNameOf(profile: { name: string | null } | null): string {
  const name = profile?.name?.trim()
  if (!name) return 'Your buddy'
  const firstSpace = name.indexOf(' ')
  return firstSpace === -1 ? name : name.slice(0, firstSpace)
}

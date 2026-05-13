// Feature flags — toggle features on/off without deleting code.
//
// Use these to "soft-remove" UI features whose data, database tables, and
// supporting code we want to preserve in case we bring them back later.
// Flipping a flag to true should be the only change needed to re-enable the
// feature; gate both the UI render AND any expensive supporting work (extra
// fetches, subscriptions) on the same flag.

export const FEATURES = {
  // Reactions: emoji picker on a buddy's completed goal tile.
  // Hidden as of May 2026 — production usage was ~5% of check-ins; the
  // picker UX needs a rethink (likely one-tap default emoji instead of a
  // picker) before re-enabling. Database table, ReactionPicker component,
  // and prop wiring all preserved.
  reactions: false,
} as const

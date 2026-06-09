// Price-check learning baseline version.
//
// Bump this in a release ONLY when that release changes the default chip selection
// enough that stale learnings would fight the new baseline (e.g. the tier-aware
// defaults / attribute-surfacing changes). On the first launch after the bump, each
// user's learnings are wiped once, silently. Leave it unchanged for releases that do
// not move the defaults - those keep existing learnings.
//
// Release step: if a release moves price-check defaults, increment this by 1.
export const LEARNING_BASELINE_VERSION = 1

/** Whether the persisted learning store predates the current baseline and must be
 *  wiped once. A missing stamp counts as 0. Baseline 0 never resets. */
export function needsBaselineReset(storedVersion: number | undefined, baseline: number): boolean {
  return (storedVersion ?? 0) < baseline
}

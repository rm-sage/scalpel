export type OnboardingRelaunchAction = 'none' | 'relaunch' | 'dev-warn'

/** Decide what finishing onboarding should do given the active game version vs.
 *  the version the overlay attached to at startup. They diverge only when the
 *  first-run flow switched games in-process without a relaunch -- in that case
 *  the overlay is bound to the wrong game, so a packaged build must relaunch to
 *  rebind. Unpacked dev/E2E can't relaunch cleanly, so it signals a dev warning
 *  instead. When the versions match, nothing is needed. */
export function shouldRelaunchAfterOnboarding(
  activeVersion: 1 | 2,
  overlayAttachedVersion: 1 | 2,
  isPackaged: boolean,
): OnboardingRelaunchAction {
  if (activeVersion === overlayAttachedVersion) return 'none'
  return isPackaged ? 'relaunch' : 'dev-warn'
}

import { expect, test } from '@playwright/test'
import { launchScalpelE2E } from './helpers/electron'

test('finishing onboarding on the other game signals a restart and persists completion', async () => {
  const scalpel = await launchScalpelE2E({
    seedConfig: {
      onboardingCompleted: false,
      // User picked PoE2 in the setup flow; the (gutted-in-E2E) overlay attached
      // to the default PoE1, so finishing should detect the mismatch.
      poeVersion: 2,
      startInTray: false,
    },
  })
  try {
    const result = await scalpel.window.evaluate(() =>
      (
        window as unknown as {
          api: { finishOnboarding: () => Promise<{ ok: boolean; restarting?: true; devRestartRequired?: true }> }
        }
      ).api.finishOnboarding(),
    )
    expect(result.ok).toBe(true)
    // Unpacked E2E -> dev branch, no real relaunch.
    expect(result.devRestartRequired).toBe(true)
    expect(result.restarting).toBeUndefined()

    const settings = await scalpel.window.evaluate(() =>
      (
        window as unknown as {
          api: { getSettings: () => Promise<{ onboardingCompleted: boolean; onboardingStep?: string }> }
        }
      ).api.getSettings(),
    )
    expect(settings.onboardingCompleted).toBe(true)
    expect(settings.onboardingStep ?? '').toBe('')
  } finally {
    await scalpel.cleanup()
  }
})

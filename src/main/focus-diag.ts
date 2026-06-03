// TEMPORARY diagnostic — REMOVE before shipping the final focus-fix commit.
//
// Purpose: confirm which overlay-dismiss paths actually hand OS foreground focus
// back to the Path of Exile window. iCUE (and other foreground-watching tools)
// pick their per-application profile from the OS foreground window, so if a
// dismiss path leaves a Scalpel window (or the desktop) as foreground, the PoE
// profile — and the user's custom binds — break until the tool is closed.
//
// After each focus-restore call, this samples the real foreground-window title
// (via the ESM-only `active-win`, using the same cached dynamic-import pattern as
// src/main/game-detector.ts) and appends a line to <userData>/focus-diag.log.
// A short delay lets the OS settle the SetForegroundWindow call before sampling.
// Expected healthy line: foreground = "Path of Exile 2".

import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { recordMainBreadcrumb } from './diagnostics'

// Sample after the OS has settled the foreground change the restore just kicked
// off. focusTarget() returns before Windows actually repaints the Z-order.
const SAMPLE_DELAY_MS = 150

type ActiveWindowFn = () => Promise<{ title?: string } | undefined>
let activeWindow: ActiveWindowFn | null = null

async function getActiveWindow(): Promise<ActiveWindowFn> {
  if (activeWindow) return activeWindow
  const mod = (await import('active-win')) as { activeWindow: ActiveWindowFn }
  activeWindow = mod.activeWindow
  return activeWindow
}

function write(label: string, foreground: string): void {
  const line = `${new Date().toISOString()}  [${label}]  foreground = ${foreground}\n`
  try {
    appendFileSync(join(app.getPath('userData'), 'focus-diag.log'), line)
  } catch {
    /* best-effort */
  }
  try {
    recordMainBreadcrumb(`focus-diag: [${label}] foreground = ${foreground}`)
  } catch {
    /* best-effort */
  }
}

/** After an overlay-dismiss focus-restore, log which window the OS ended up
 *  treating as foreground. `label` identifies the dismiss path. */
export function logForegroundAfterRestore(label: string): void {
  setTimeout(() => {
    getActiveWindow()
      .then((fn) => fn())
      .then((win) => write(label, win?.title ? `"${win.title}"` : '(unknown)'))
      .catch((err) => write(label, `active-win error: ${String(err)}`))
  }, SAMPLE_DELAY_MS)
}

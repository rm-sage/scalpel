import { beforeEach, describe, expect, it, vi } from 'vitest'
const { focusHolder } = vi.hoisted(() => ({ focusHolder: { current: null as unknown } }))
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => focusHolder.current },
  screen: { getDisplayNearestPoint: () => ({ scaleFactor: 1 }) },
}))
import { closeAllOverlaysOnPoeExit, hideFocusedOrAnyVisibleSecondaryOverlay } from './focus'
import { type OverlayState, overlays } from './state'

function fakeState(opts: { visible: boolean; wasVisible?: boolean; persist?: boolean }): OverlayState {
  return {
    spec: {} as unknown as OverlayState['spec'],
    win: {
      isDestroyed: () => false,
      isVisible: () => opts.visible,
      hide: vi.fn(),
    } as unknown as OverlayState['win'],
    snapGhostActive: false,
    inProgrammaticMove: false,
    programmaticSettleTimer: null,
    isResizing: false,
    wasVisibleBeforeFocusLoss: opts.wasVisible ?? false,
    persistOverOthers: opts.persist ?? false,
  }
}

describe('closeAllOverlaysOnPoeExit', () => {
  beforeEach(() => {
    overlays.clear()
  })

  it('clears the restore flag on every secondary overlay and hides the visible ones', () => {
    const visible = fakeState({ visible: true, wasVisible: true })
    const hidden = fakeState({ visible: false, wasVisible: true })
    overlays.set('visible', visible)
    overlays.set('hidden', hidden)

    closeAllOverlaysOnPoeExit()

    // Visible window must be hidden. The hidden one may or may not have
    // hide() called (it's idempotent in production via the opacity-hide
    // patch); the contract is that the restore flag is cleared on both
    // so a stray focus event doesn't try to restore either one.
    expect(visible.win?.hide).toHaveBeenCalled()
    expect(visible.wasVisibleBeforeFocusLoss).toBe(false)
    expect(hidden.wasVisibleBeforeFocusLoss).toBe(false)
  })

  it('skips destroyed windows without throwing', () => {
    const destroyed: OverlayState = {
      spec: {} as unknown as OverlayState['spec'],
      win: {
        isDestroyed: () => true,
        isVisible: () => true,
        hide: vi.fn(),
      } as unknown as OverlayState['win'],
      snapGhostActive: false,
      inProgrammaticMove: false,
      programmaticSettleTimer: null,
      isResizing: false,
      wasVisibleBeforeFocusLoss: true,
      persistOverOthers: false,
    }
    overlays.set('destroyed', destroyed)

    expect(() => closeAllOverlaysOnPoeExit()).not.toThrow()
    expect(destroyed.win?.hide).not.toHaveBeenCalled()
  })

  it('skips overlays with no window', () => {
    const noWin: OverlayState = {
      spec: {} as unknown as OverlayState['spec'],
      win: null,
      snapGhostActive: false,
      inProgrammaticMove: false,
      programmaticSettleTimer: null,
      isResizing: false,
      wasVisibleBeforeFocusLoss: true,
      persistOverOthers: false,
    }
    overlays.set('nowin', noWin)

    expect(() => closeAllOverlaysOnPoeExit()).not.toThrow()
  })
})

describe('hideFocusedOrAnyVisibleSecondaryOverlay - persistOverOthers', () => {
  beforeEach(() => {
    overlays.clear()
    focusHolder.current = null
  })

  it('does not hide a persistent visible overlay via the any-visible sweep', () => {
    const wb = fakeState({ visible: true, persist: true })
    overlays.set('whiteboard', wb)
    const hid = hideFocusedOrAnyVisibleSecondaryOverlay()
    expect(hid).toBe(false)
    expect(wb.win?.hide).not.toHaveBeenCalled()
  })

  it('still hides a non-persistent visible overlay', () => {
    const cs = fakeState({ visible: true, persist: false })
    overlays.set('cheatsheet', cs)
    const hid = hideFocusedOrAnyVisibleSecondaryOverlay()
    expect(hid).toBe(true)
    expect(cs.win?.hide).toHaveBeenCalled()
  })

  it('hides the non-persistent overlay and leaves the persistent one alone', () => {
    const wb = fakeState({ visible: true, persist: true })
    const cs = fakeState({ visible: true, persist: false })
    overlays.set('whiteboard', wb)
    overlays.set('cheatsheet', cs)
    const hid = hideFocusedOrAnyVisibleSecondaryOverlay()
    expect(hid).toBe(true)
    expect(cs.win?.hide).toHaveBeenCalled()
    expect(wb.win?.hide).not.toHaveBeenCalled()
  })
})

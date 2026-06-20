import { describe, expect, it } from 'vitest'
import { clipboardHoldsInjectedText, shouldInjectChat } from './chat-inject-guard'

describe('shouldInjectChat', () => {
  it('allows injection when the gate is on and the game has foreground focus', () => {
    expect(shouldInjectChat(true, true)).toBe(true)
  })

  it('refuses injection when the gate is on and the game is NOT focused', () => {
    // The core safeguard: never type a paste into a browser / Discord / password
    // manager when PoE is not the foreground window.
    expect(shouldInjectChat(true, false)).toBe(false)
  })

  it('allows injection when the gate is off, regardless of focus', () => {
    expect(shouldInjectChat(false, false)).toBe(true)
    expect(shouldInjectChat(false, true)).toBe(true)
  })
})

describe('clipboardHoldsInjectedText', () => {
  it('is true when the live clipboard still holds exactly the injected text', () => {
    expect(clipboardHoldsInjectedText('/reloaditemfilter', '/reloaditemfilter')).toBe(true)
  })

  it('is false when something else changed the clipboard after the injection', () => {
    // e.g. the user copied a password while the paste was in flight -- we must NOT
    // clobber their new clipboard with the stale snapshot.
    expect(clipboardHoldsInjectedText('hunter2', '/reloaditemfilter')).toBe(false)
  })

  it('treats two empty strings as unchanged', () => {
    expect(clipboardHoldsInjectedText('', '')).toBe(true)
  })
})

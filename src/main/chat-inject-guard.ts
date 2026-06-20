/**
 * Pure decision helpers for the keystroke-injection safeguards.
 *
 * Scalpel types into PoE by writing text to the OS clipboard and injecting Ctrl+V
 * (chat commands, `/reloaditemfilter`, `/itemfilter` switching, regex-to-search).
 * Two things can leak the user's *real* clipboard (e.g. a password) instead of the
 * intended command:
 *
 *  1. Wrong window: the injection fires while PoE is NOT the foreground window, so
 *     the paste lands in a browser / Discord / password manager.
 *  2. Restore race: the user's clipboard is restored before the game consumed the
 *     paste, so a late paste grabs the restored (sensitive) clipboard.
 *
 * These helpers encode the two guard decisions. They are deliberately free of any
 * electron / native imports so they stay trivially unit-testable; callers supply the
 * live focus + clipboard state.
 */

/**
 * Whether a chat / search keystroke injection may run right now.
 *
 * When the focus gate is enabled, refuse unless the game is the foreground window so
 * we never type a paste into whatever unrelated app happens to be focused. When the
 * gate is disabled, the legacy "focus the game then inject" behaviour is allowed.
 */
export function shouldInjectChat(requireGameFocus: boolean, gameHasFocus: boolean): boolean {
  return !requireGameFocus || gameHasFocus
}

/**
 * Whether it is safe to restore the user's snapshotted clipboard after an injection:
 * only if the live clipboard still holds the exact text we wrote for the paste, i.e.
 * nothing else (a new user copy, an overlapping injection) changed it meanwhile.
 * Restoring unconditionally could clobber a clipboard the user changed during the
 * paste window.
 */
export function clipboardHoldsInjectedText(liveClipboardText: string, injectedText: string): boolean {
  return liveClipboardText === injectedText
}

/**
 * Delay (ms) before restoring the user's real clipboard after a chat / search paste.
 * Long enough that a *foreground* game has consumed the injected Ctrl+V (so a late
 * paste can't grab the restored, possibly-sensitive clipboard), short enough not to
 * strand the user's clipboard. The focus gate is the primary guarantee that the game
 * is actually foreground (and thus pumping input) during this window. The original
 * value was 50ms, which the game routinely overran on frame/zone-load hitches.
 */
export const CHAT_CLIPBOARD_RESTORE_DELAY_MS = 250
export const REGEX_CLIPBOARD_RESTORE_DELAY_MS = 250

/**
 * Delay (ms) after which the chat-paste re-entrancy lock / hotkey-suppression flag is
 * cleared. Kept short (the synthetic keystroke burst is already done by then) so chat
 * injection doesn't deaden the trigger / price-check hotkeys for longer than needed.
 */
export const INJECT_SUPPRESS_RELEASE_MS = 50

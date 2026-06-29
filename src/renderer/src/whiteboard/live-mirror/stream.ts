/** Ref-counted holder for the single PoE-window capture stream shared by every
 *  live-mirror element. The first consumer opens it; the last consumer stops
 *  it. A `source-invalidated` event (new/closed game window) reopens it for the
 *  current consumers. Consumers are notified with the stream, or null when the
 *  source can't be resolved (game detached / capture denied). */
export type StreamListener = (stream: MediaStream | null) => void

const listeners = new Set<StreamListener>()
let stream: MediaStream | null = null
let opening: Promise<void> | null = null
let unsubInvalidated: (() => void) | null = null

async function openStream(): Promise<void> {
  const info = await window.api.screen.getGameWindowSource()
  if (!info) {
    stream = null
    notify()
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      // Legacy desktop-capture constraints. If the de-risk probe in Task 1
      // required getDisplayMedia instead, swap this block for that path.
      video: {
        // Native resolution (no maxHeight cap): the live-mirror crop compares
        // the captured frame size to the client size to correct for window
        // chrome, so the frame must stay 1:1 with the window. One shared stream
        // feeds every mirror, so full-res is a single decode.
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: info.sourceId },
      },
    } as MediaStreamConstraints)
  } catch (err) {
    if (import.meta.env.DEV) console.error('[live-mirror] getUserMedia failed', err)
    stream = null
  }
  // Everyone released while we were opening - don't leak the stream.
  if (stream !== null && listeners.size === 0) {
    stopStream()
    return
  }
  notify()
}

function notify(): void {
  for (const l of listeners) l(stream)
}

function stopStream(): void {
  if (stream) for (const t of stream.getTracks()) t.stop()
  stream = null
}

async function reopen(): Promise<void> {
  // Drain any in-flight open first so we don't tear down a stream that hasn't
  // been assigned yet, and so the restart begins from a clean state.
  if (opening) await opening
  stopStream()
  opening = openStream()
  await opening
}

export async function acquireStream(listener: StreamListener): Promise<void> {
  listeners.add(listener)
  if (!unsubInvalidated) {
    unsubInvalidated = window.api.screen.onSourceInvalidated(() => {
      if (listeners.size > 0) void reopen()
    })
  }
  if (stream) {
    listener(stream)
    return
  }
  if (!opening) opening = openStream()
  await opening
  if (listeners.has(listener)) listener(stream)
}

export function releaseStream(listener: StreamListener): void {
  listeners.delete(listener)
  if (listeners.size === 0) {
    stopStream()
    opening = null
    unsubInvalidated?.()
    unsubInvalidated = null
  }
}

/** Test-only: clear module singleton state between cases. */
export function _resetStreamForTests(): void {
  listeners.clear()
  stream = null
  opening = null
  unsubInvalidated = null
}

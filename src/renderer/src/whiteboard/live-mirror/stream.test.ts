// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireStream, releaseStream, _resetStreamForTests } from './stream'

function fakeStream(): MediaStream {
  const track = { stop: vi.fn() }
  return { getTracks: () => [track] } as unknown as MediaStream
}

function installApi(getSource = vi.fn().mockResolvedValue({ sourceId: 'window:1', gameSize: { w: 1920, h: 1080 } })) {
  const onSourceInvalidated = vi.fn().mockReturnValue(() => {})
  // @ts-expect-error test shim
  window.api = { screen: { getGameWindowSource: getSource, onSourceInvalidated } }
  return { getSource, onSourceInvalidated }
}

afterEach(() => {
  _resetStreamForTests()
  vi.restoreAllMocks()
})

describe('live-mirror stream singleton', () => {
  it('opens one stream for N consumers and notifies each', async () => {
    installApi()
    const s = fakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(s)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })

    const a = vi.fn()
    const b = vi.fn()
    await acquireStream(a)
    await acquireStream(b)

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith(s)
    expect(b).toHaveBeenCalledWith(s)
  })

  it('stops all tracks when the last consumer releases', async () => {
    installApi()
    const s = fakeStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(s) } })

    const a = vi.fn()
    const b = vi.fn()
    await acquireStream(a)
    await acquireStream(b)
    releaseStream(a)
    expect(s.getTracks()[0].stop).not.toHaveBeenCalled()
    releaseStream(b)
    expect(s.getTracks()[0].stop).toHaveBeenCalledTimes(1)
  })

  it('notifies consumers with null when the source cannot be resolved', async () => {
    installApi(vi.fn().mockResolvedValue(null))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
    const a = vi.fn()
    await acquireStream(a)
    expect(a).toHaveBeenCalledWith(null)
  })

  it('does not deliver or leak a stream when the only listener releases during open', async () => {
    installApi()
    const s = fakeStream()
    let resolveGum!: (v: MediaStream) => void
    const getUserMedia = vi.fn().mockReturnValue(
      new Promise<MediaStream>((res) => {
        resolveGum = res
      }),
    )
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const a = vi.fn()
    const p = acquireStream(a)
    releaseStream(a)
    resolveGum(s)
    await p
    expect(a).not.toHaveBeenCalledWith(s)
    expect(s.getTracks()[0].stop).toHaveBeenCalled()
  })

  it('unsubscribes from source-invalidated when the last consumer releases', async () => {
    const unsub = vi.fn()
    const onSourceInvalidated = vi.fn().mockReturnValue(unsub)
    // @ts-expect-error test shim
    window.api = {
      screen: {
        getGameWindowSource: vi.fn().mockResolvedValue({ sourceId: 'window:1', gameSize: { w: 1, h: 1 } }),
        onSourceInvalidated,
      },
    }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } })
    const a = vi.fn()
    await acquireStream(a)
    releaseStream(a)
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})

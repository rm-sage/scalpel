import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeHandlers = new Map<string, (...a: unknown[]) => unknown>()
const onHandlers = new Map<string, (...a: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => '/docs' },
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => invokeHandlers.set(ch, fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => onHandlers.set(ch, fn),
  },
}))
vi.mock('../game-state', () => ({ getPoeVersion: () => 2 }))

let watchCb: (() => void) | null = null
const closeMock = vi.fn()
vi.mock('node:fs', () => ({
  watch: (_p: string, cb: () => void) => {
    watchCb = cb
    return { close: closeMock }
  },
}))

const readMock = vi.fn<(...a: unknown[]) => Promise<string>>(async () => 'X=1\r\n')
const writeMock = vi.fn<(...a: unknown[]) => Promise<{ backupPath: string | null }>>(async () => ({ backupPath: null }))
vi.mock('../game-config', () => ({
  resolveGameConfigPath: (v: number, d: string) => `${d}/poe${v}.ini`,
  readGameConfig: (p: unknown) => readMock(p),
  writeGameConfig: (p: unknown, c: unknown, o: unknown) => writeMock(p, c, o),
}))

interface FakeSender {
  sent: string[]
  destroyed: boolean
  isDestroyed(): boolean
  once(ev: string, fn: () => void): void
  send(ch: string): void
}
function fakeSender(): FakeSender {
  return {
    sent: [],
    destroyed: false,
    isDestroyed() {
      return this.destroyed
    },
    once() {},
    send(ch) {
      this.sent.push(ch)
    },
  }
}

describe('game-config handlers', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    invokeHandlers.clear()
    onHandlers.clear()
    readMock.mockClear()
    writeMock.mockClear()
    closeMock.mockClear()
    watchCb = null
    vi.resetModules()
    const { registerGameConfigHandlers } = await import('./game-config')
    registerGameConfigHandlers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('read resolves the per-game path and returns content + path', async () => {
    const result = await invokeHandlers.get('plugins:game-config-read')?.({})
    expect(readMock).toHaveBeenCalledWith('/docs/poe2.ini')
    expect(result).toEqual({ content: 'X=1\r\n', path: '/docs/poe2.ini' })
  })

  it('write forwards content to the resolved path', async () => {
    await invokeHandlers.get('plugins:game-config-write')?.({}, 'Y=2\r\n')
    expect(writeMock).toHaveBeenCalledWith('/docs/poe2.ini', 'Y=2\r\n', expect.anything())
  })

  it('write rejects a non-string payload', async () => {
    await expect(invokeHandlers.get('plugins:game-config-write')?.({}, 123)).rejects.toThrow()
  })

  it('notifies all live subscribers on change, debounced', () => {
    const a = fakeSender()
    const b = fakeSender()
    onHandlers.get('plugins:game-config-watch')?.({ sender: a })
    onHandlers.get('plugins:game-config-watch')?.({ sender: b })
    watchCb?.()
    vi.advanceTimersByTime(150)
    expect(a.sent).toEqual(['plugins:game-config-changed'])
    expect(b.sent).toEqual(['plugins:game-config-changed'])
  })

  it('keeps notifying remaining subscribers after one unwatches', () => {
    const a = fakeSender()
    const b = fakeSender()
    onHandlers.get('plugins:game-config-watch')?.({ sender: a })
    onHandlers.get('plugins:game-config-watch')?.({ sender: b })
    onHandlers.get('plugins:game-config-unwatch')?.({ sender: a })
    expect(closeMock).not.toHaveBeenCalled()
    watchCb?.()
    vi.advanceTimersByTime(150)
    expect(a.sent).toEqual([])
    expect(b.sent).toEqual(['plugins:game-config-changed'])
  })

  it('closes the watcher when the last subscriber unwatches', () => {
    const a = fakeSender()
    onHandlers.get('plugins:game-config-watch')?.({ sender: a })
    onHandlers.get('plugins:game-config-unwatch')?.({ sender: a })
    expect(closeMock).toHaveBeenCalled()
  })

  it('skips a destroyed subscriber', () => {
    const a = fakeSender()
    onHandlers.get('plugins:game-config-watch')?.({ sender: a })
    a.destroyed = true
    watchCb?.()
    vi.advanceTimersByTime(150)
    expect(a.sent).toEqual([])
  })

  it('suppresses the change event triggered by its own write', async () => {
    const a = fakeSender()
    onHandlers.get('plugins:game-config-watch')?.({ sender: a })
    await invokeHandlers.get('plugins:game-config-write')?.({}, 'Z=3\r\n')
    watchCb?.()
    vi.advanceTimersByTime(150)
    expect(a.sent).toEqual([])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Captured options passed to net.request, plus tunable response state.
const capturedOpts: Array<{ url: string; useSessionCookies?: boolean; referrerPolicy?: string }> = []
let responseBody = '{"result":[]}'
let statusCode = 200

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), handle: vi.fn(), removeListener: vi.fn() },
  app: { userAgentFallback: 'Scalpel-Test/1.0', getPath: () => '/tmp/test-scalpel', on: vi.fn() },
  net: {
    request: vi.fn((opts: { url: string; useSessionCookies?: boolean; referrerPolicy?: string }) => {
      capturedOpts.push(opts)
      let responseCb: ((resp: unknown) => void) | null = null
      return {
        on: (event: string, cb: unknown) => {
          if (event === 'response') responseCb = cb as typeof responseCb
        },
        setHeader: vi.fn(),
        abort: vi.fn(),
        end: vi.fn(() => {
          queueMicrotask(() => {
            if (!responseCb) return
            let dataCb: ((chunk: unknown) => void) | null = null
            let endCb: (() => void) | null = null
            responseCb({
              statusCode,
              headers: {},
              on: (event: string, cb: unknown) => {
                if (event === 'data') dataCb = cb as typeof dataCb
                if (event === 'end') endCb = cb as typeof endCb
              },
            })
            ;(dataCb as ((chunk: unknown) => void) | null)?.(responseBody)
            ;(endCb as (() => void) | null)?.()
          })
        }),
      }
    }),
  },
}))

import { fetchLeagueList } from './leagues'

beforeEach(() => {
  capturedOpts.length = 0
  responseBody = '{"result":[]}'
  statusCode = 200
})

describe('fetchLeagueList', () => {
  it('requests the league endpoint without the session cookie jar (#429 / #910)', async () => {
    responseBody = JSON.stringify({ result: [{ id: 'Standard' }, { id: 'Hardcore' }] })
    await fetchLeagueList(2)
    expect(capturedOpts).toHaveLength(1)
    expect(capturedOpts[0].useSessionCookies).toBe(false)
  })

  it('returns deduped pc-realm league ids', async () => {
    responseBody = JSON.stringify({
      result: [
        { id: 'Mirage', realm: 'pc' },
        { id: 'Mirage', realm: 'pc' },
        { id: 'XboxLeague', realm: 'xbox' },
        { id: 'Standard' },
      ],
    })
    const list = await fetchLeagueList(1)
    expect(list).toEqual(['Mirage', 'Standard'])
  })

  it('returns null when the response is not valid JSON', async () => {
    responseBody = 'not json'
    const list = await fetchLeagueList(2)
    expect(list).toBeNull()
  })
})

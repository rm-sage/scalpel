import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_USER_DATA = '/test/userData'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => TEST_USER_DATA) },
}))

const mockFs = {
  files: new Map<string, string>(),
}

vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const v = mockFs.files.get(p)
    if (v == null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    return v
  },
  existsSync: (p: string) => mockFs.files.has(p),
  writeFileSync: (p: string, data: string) => {
    mockFs.files.set(p, data)
  },
  mkdirSync: () => {},
}))

beforeEach(() => {
  mockFs.files.clear()
  vi.resetModules()
})

const unpackedPath = join(TEST_USER_DATA, 'plugins', 'unpacked.json')

function readMockJson(path: string): unknown {
  const value = mockFs.files.get(path)
  if (value == null) throw new Error(`Expected mock file to exist: ${path}`)
  return JSON.parse(value)
}

describe('readUnpackedIds', () => {
  it('returns [] when file does not exist', async () => {
    const { readUnpackedIds } = await import('./unpacked-list')
    expect(readUnpackedIds()).toEqual([])
  })

  it('returns [] when file is unparseable', async () => {
    mockFs.files.set(unpackedPath, 'not json')
    const { readUnpackedIds } = await import('./unpacked-list')
    expect(readUnpackedIds()).toEqual([])
  })

  it('returns [] when file is not an array', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify({ foo: 'bar' }))
    const { readUnpackedIds } = await import('./unpacked-list')
    expect(readUnpackedIds()).toEqual([])
  })

  it('returns ids from a valid array', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify(['alpha', 'beta']))
    const { readUnpackedIds } = await import('./unpacked-list')
    expect(readUnpackedIds()).toEqual(['alpha', 'beta'])
  })

  it('filters out non-string entries', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify(['alpha', 42, null, 'beta']))
    const { readUnpackedIds } = await import('./unpacked-list')
    expect(readUnpackedIds()).toEqual(['alpha', 'beta'])
  })
})

describe('addUnpackedId', () => {
  it('appends an id when not present and returns true', async () => {
    const { addUnpackedId } = await import('./unpacked-list')
    const changed = addUnpackedId('my-plugin')
    expect(changed).toBe(true)
    expect(readMockJson(unpackedPath)).toEqual(['my-plugin'])
  })

  it('does not duplicate an id and returns false', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify(['my-plugin']))
    const { addUnpackedId } = await import('./unpacked-list')
    const changed = addUnpackedId('my-plugin')
    expect(changed).toBe(false)
    expect(readMockJson(unpackedPath)).toEqual(['my-plugin'])
  })
})

describe('removeUnpackedId', () => {
  it('removes an id and returns true', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify(['alpha', 'beta']))
    const { removeUnpackedId } = await import('./unpacked-list')
    const changed = removeUnpackedId('alpha')
    expect(changed).toBe(true)
    expect(readMockJson(unpackedPath)).toEqual(['beta'])
  })

  it('returns false when id is not present', async () => {
    mockFs.files.set(unpackedPath, JSON.stringify(['beta']))
    const { removeUnpackedId } = await import('./unpacked-list')
    const changed = removeUnpackedId('alpha')
    expect(changed).toBe(false)
  })
})

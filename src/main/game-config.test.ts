import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readGameConfig, resolveGameConfigPath, writeGameConfig } from './game-config'

describe('resolveGameConfigPath', () => {
  it('resolves the PoE2 config path', () => {
    expect(resolveGameConfigPath(2, '/docs')).toBe(
      join('/docs', 'My Games', 'Path of Exile 2', 'poe2_production_Config.ini'),
    )
  })
  it('resolves the PoE1 config path', () => {
    expect(resolveGameConfigPath(1, '/docs')).toBe(join('/docs', 'My Games', 'Path of Exile', 'production_Config.ini'))
  })
})

describe('readGameConfig', () => {
  it('reads file contents verbatim', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scalpel-ini-'))
    const file = join(dir, 'c.ini')
    writeFileSync(file, '[A]\r\nx=1\r\n')
    expect(await readGameConfig(file)).toBe('[A]\r\nx=1\r\n')
  })
  it('rejects with a clear message when the file is missing', async () => {
    await expect(readGameConfig(join(tmpdir(), 'nope-scalpel.ini'))).rejects.toThrow(/config file not found/i)
  })
})

describe('writeGameConfig', () => {
  it('writes content atomically and backs up on first write only', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scalpel-ini-'))
    const file = join(dir, 'c.ini')
    writeFileSync(file, 'old=1\r\n')
    const backedUp = new Set<string>()
    const now = () => 1717372800000

    const first = await writeGameConfig(file, 'new=1\r\n', { backedUp, now })
    expect(readFileSync(file, 'utf8')).toBe('new=1\r\n')
    expect(first.backupPath).not.toBeNull()
    expect(existsSync(first.backupPath as string)).toBe(true)
    expect(readFileSync(first.backupPath as string, 'utf8')).toBe('old=1\r\n')

    const second = await writeGameConfig(file, 'newer=1\r\n', { backedUp, now })
    expect(second.backupPath).toBeNull()
    expect(readdirSync(dir).filter((f) => f.endsWith('.bak'))).toHaveLength(1)
  })
  it('leaves no .tmp file behind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scalpel-ini-'))
    const file = join(dir, 'c.ini')
    writeFileSync(file, 'a=1\r\n')
    await writeGameConfig(file, 'b=1\r\n', { backedUp: new Set(), now: () => 1 })
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })
})

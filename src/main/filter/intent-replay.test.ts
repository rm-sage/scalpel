import { describe, expect, it } from 'vitest'
import { replayIntents } from './intent-replay'
import type { IntentLog } from './intents'
import { validateBlock } from './validate'
import { writeFilterSelective } from './writer'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFilterFile } from './parser'

function moveLog(value: string, fromTier: string, toTier: string): IntentLog {
  return {
    filterName: 't',
    intents: [
      {
        type: 'move-basetype',
        target: { typePath: 'currency', tier: toTier },
        payload: { value, fromTier },
        timestamp: 0,
      },
    ],
  }
}

describe('replayIntents move-basetype', () => {
  it('removes the whole block when the move empties its only condition', () => {
    const upstream = [
      'Show # $type->currency $tier->src',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 40',
      '',
      'Show # $type->currency $tier->dst',
      '\tBaseType == "Divine Orb"',
      '\tSetFontSize 45',
      '',
    ].join('\n')

    const res = replayIntents(upstream, 't.filter', moveLog('Chaos Orb', 'src', 'dst'), { forceApply: true })
    const srcIndex = res.filter.blocks.findIndex((b) => b.tierTag?.tier === 'src')
    // The emptied source block is marked for removal, not left as a catch-all.
    expect(res.removedBlocks.has(srcIndex)).toBe(true)
    expect(res.modifiedBlocks.has(srcIndex)).toBe(false)
    const dst = res.filter.blocks.find((b) => b.tierTag?.tier === 'dst')!
    expect(dst.conditions.find((c) => c.type === 'BaseType')!.values).toContain('Chaos Orb')

    // End-to-end: the src block (and its bare catch-all) is gone from the output.
    const dir = mkdtempSync(join(tmpdir(), 'replay-'))
    const p = join(dir, 'out.filter')
    writeFilterSelective({ ...res.filter, path: p }, res.modifiedBlocks, res.removedBlocks)
    const out = readFileSync(p, 'utf-8')
    expect(out).not.toContain('$tier->src')
    const reparsed = parseFilterFile(p, out)
    expect(reparsed.blocks).toHaveLength(1) // only dst remains
    for (const b of reparsed.blocks) expect(validateBlock(b)).toEqual([])
  })

  it('keeps the block (dropping only the empty condition) when it has other conditions', () => {
    const upstream = [
      'Show # $type->currency $tier->src',
      '\tRarity Normal',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 40',
      '',
      'Show # $type->currency $tier->dst',
      '\tBaseType == "Divine Orb"',
      '\tSetFontSize 45',
      '',
    ].join('\n')

    const res = replayIntents(upstream, 't.filter', moveLog('Chaos Orb', 'src', 'dst'), { forceApply: true })
    const srcIndex = res.filter.blocks.findIndex((b) => b.tierTag?.tier === 'src')
    expect(res.removedBlocks.has(srcIndex)).toBe(false)
    expect(res.modifiedBlocks.has(srcIndex)).toBe(true)
    const src = res.filter.blocks[srcIndex]
    expect(src.conditions.some((c) => c.type === 'BaseType')).toBe(false) // empty BaseType dropped
    expect(src.conditions.some((c) => c.type === 'Rarity')).toBe(true) // other condition kept
    expect(validateBlock(src)).toEqual([])
  })
})

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayIntents } from './intent-replay'
import type { IntentLog } from './intents'
import { parseFilterFile } from './parser'
import { validateBlock } from './validate'
import { writeFilterSelective } from './writer'

// Representative slice: section header, tab indent, multi-value + single-value
// BaseType blocks, a socket-letter condition, blank-line separators.
const SLICE_LF = [
  '#===============================================',
  '# [[0100]] Currency',
  '#===============================================',
  '',
  'Show # $type->currency $tier->t1',
  '\tBaseType == "Divine Orb" "Mirror of Kalandra"',
  '\tSetFontSize 45',
  '\tSetTextColor 255 255 255 255',
  '',
  '# single-value block (move target for the empty-condition path)',
  'Show # $type->currency $tier->t2',
  '\tBaseType == "Chaos Orb"',
  '\tSetFontSize 40',
  '',
  '# [[0200]] Weapons',
  'Show # $type->weapon $tier->6l',
  '\tSockets >= 6WWWWWW',
  '\tLinkedSockets 6',
  '\tSetFontSize 45',
  '',
].join('\n')

for (const [label, content] of [
  ['LF (PoE2-style)', SLICE_LF],
  ['CRLF (PoE1-style)', SLICE_LF.replace(/\n/g, '\r\n')],
] as const) {
  describe(`sync property: ${label}`, () => {
    it('produces a valid, comment-preserving, uniform-EOL filter', () => {
      const original = content
      const originalBlocks = parseFilterFile('t.filter', original).blocks.length

      const log: IntentLog = {
        filterName: 't',
        intents: [
          {
            type: 'set-visibility',
            target: { typePath: 'currency', tier: 't1' },
            payload: { visibility: 'Hide' },
            timestamp: 0,
          },
          {
            type: 'move-basetype',
            target: { typePath: 'currency', tier: 't1' },
            payload: { value: 'Chaos Orb', fromTier: 't2' },
            timestamp: 0,
          },
          {
            type: 'set-action',
            target: { typePath: 'weapon', tier: '6l' },
            payload: { action: 'SetTextColor', values: ['10', '20', '30', '255'] },
            timestamp: 0,
          },
        ],
      }

      const dir = mkdtempSync(join(tmpdir(), 'syncprop-'))
      const p = join(dir, 'o.filter')
      const res = replayIntents(original, p, log, { forceApply: true })
      const { fallbackBlocks } = writeFilterSelective(res.filter, res.modifiedBlocks, res.removedBlocks)
      const out = readFileSync(p, 'utf-8')
      const reparsed = parseFilterFile(p, out)

      // (a) the move emptied t2's only condition, so t2 is dropped entirely
      expect(reparsed.blocks).toHaveLength(originalBlocks - 1)
      expect(out).not.toContain('$tier->t2')
      // (b) section-structure comments (gaps) preserved; the removed block's own
      //     leading comment is gone with it.
      for (const c of [
        '# [[0100]] Currency',
        '# [[0200]] Weapons',
        '#===============================================',
      ]) {
        expect(out).toContain(c)
      }
      expect(out).not.toContain('move target for the empty-condition path')
      // (c) uniform EOL matching the source
      if (original.includes('\r\n')) {
        expect(/[^\r]\n/.test(out)).toBe(false)
      } else {
        expect(out.includes('\r')).toBe(false)
      }
      // (d) every block valid, no dangling/catch-all, moved value + socket intact
      for (const b of reparsed.blocks) expect(validateBlock(b)).toEqual([])
      expect(out).not.toMatch(/BaseType ==\s*$/m)
      expect(out).toContain('"Chaos Orb"')
      expect(out).toContain('6WWWWWW')
      // edits applied cleanly (no fallbacks needed on this clean slice)
      expect(fallbackBlocks).toEqual([])
    })
  })
}

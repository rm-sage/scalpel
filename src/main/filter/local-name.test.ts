import { describe, expect, it } from 'vitest'
import { applyLocalNameHeader } from './local-name'

describe('applyLocalNameHeader', () => {
  it('rewrites the online #name to the local name (space-separated, matching import)', () => {
    const c = '#name:.5regular\r\nShow\r\n\tSetFontSize 40\r\n'
    const out = applyLocalNameHeader(c, '.5regular-local')
    expect(out).toContain('#name: .5regular-local')
    expect(out).not.toContain('#name:.5regular\r')
  })

  it('handles a #name that already has a leading space', () => {
    const c = '#name: My Filter\nShow\n'
    expect(applyLocalNameHeader(c, 'My Filter-local')).toContain('#name: My Filter-local')
  })

  it('preserves CRLF line endings (does not introduce bare LF)', () => {
    const c = '#name:.5regular\r\nShow\r\n\tBaseType == "Chaos Orb"\r\n'
    const out = applyLocalNameHeader(c, '.5regular-local')
    expect(out).toContain('\r\nShow\r\n\tBaseType == "Chaos Orb"\r\n')
    expect(/[^\r]\n/.test(out)).toBe(false)
  })

  it('is a no-op when there is no #name line', () => {
    const c = 'Show\n\tSetFontSize 40\n'
    expect(applyLocalNameHeader(c, 'x-local')).toBe(c)
  })

  it('only rewrites the header line, not a later comment that mentions #name:', () => {
    const c = '#name:.5regular\n# note: #name: not the header\nShow\n'
    const out = applyLocalNameHeader(c, '.5regular-local')
    expect(out.split('\n')[0]).toBe('#name: .5regular-local')
    expect(out).toContain('# note: #name: not the header')
  })

  it('treats the local name literally (no $-pattern interpretation)', () => {
    const c = '#name:Foo\nShow\n'
    expect(applyLocalNameHeader(c, 'a$&b-local')).toContain('#name: a$&b-local')
  })
})

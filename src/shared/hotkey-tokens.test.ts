import { describe, expect, it } from 'vitest'
import { PHYSICAL_CODES, decodePhysicalToken, encodePhysicalKey, isPhysicalToken } from './hotkey-tokens'

describe('encodePhysicalKey', () => {
  it('encodes a physical code and glyph into a single token', () => {
    expect(encodePhysicalKey('Semicolon', 'Æ')).toBe('Phys:Semicolon:Æ')
  })

  it('keeps a glyph that is itself a colon', () => {
    expect(encodePhysicalKey('Semicolon', ':')).toBe('Phys:Semicolon::')
  })

  it('keeps a glyph that is a plus sign', () => {
    expect(encodePhysicalKey('Equal', '+')).toBe('Phys:Equal:+')
  })
})

describe('decodePhysicalToken', () => {
  it('round-trips a basic token', () => {
    expect(decodePhysicalToken('Phys:Semicolon:Æ')).toEqual({ code: 'Semicolon', glyph: 'Æ' })
  })

  it('decodes a glyph that is a colon', () => {
    expect(decodePhysicalToken('Phys:Semicolon::')).toEqual({ code: 'Semicolon', glyph: ':' })
  })

  it('decodes a glyph that is a plus sign', () => {
    expect(decodePhysicalToken('Phys:Equal:+')).toEqual({ code: 'Equal', glyph: '+' })
  })

  it('returns null for a non-physical token', () => {
    expect(decodePhysicalToken('F8')).toBeNull()
    expect(decodePhysicalToken('A')).toBeNull()
  })
})

describe('isPhysicalToken', () => {
  it('is true only for the Phys: prefix', () => {
    expect(isPhysicalToken('Phys:Quote:Ø')).toBe(true)
    expect(isPhysicalToken('F')).toBe(false)
    expect(isPhysicalToken('')).toBe(false)
  })
})

describe('PHYSICAL_CODES', () => {
  it('covers the OEM/punctuation positions Danish letters sit on', () => {
    // Danish: æ at Semicolon, ø at Quote, å at BracketLeft
    expect(PHYSICAL_CODES).toContain('Semicolon')
    expect(PHYSICAL_CODES).toContain('Quote')
    expect(PHYSICAL_CODES).toContain('BracketLeft')
  })
})

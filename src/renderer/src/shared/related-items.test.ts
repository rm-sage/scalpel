import { describe, it, expect } from 'vitest'
import { findRelated } from './related-items'

describe('findRelated', () => {
  it('returns the curated PoE1 entry for a known PoE1 query name', () => {
    const entry = findRelated('Tabula Rasa', 1)
    expect(entry).not.toBeNull()
  })

  it('returns null for Tabula Rasa under version 2 (PoE2 dataset has no such entry)', () => {
    // This is the #418 fix: PoE2 must NOT inherit the PoE1 entry for shared names.
    expect(findRelated('Tabula Rasa', 2)).toBeNull()
  })

  it('returns null for Lifesprig under version 2 (PoE2 dataset has no such entry)', () => {
    expect(findRelated('Lifesprig', 2)).toBeNull()
  })

  it('returns null when the curated dataset has no match', () => {
    expect(findRelated('Nothing Like This Exists', 1)).toBeNull()
  })

  it('resolves a PoE2 query name under version 2', () => {
    // Primary Calamity Fragment exists in the PoE2 dataset.
    expect(findRelated('Primary Calamity Fragment', 2)).not.toBeNull()
  })

  it('returns null for Primary Calamity Fragment under version 1 (PoE1 dataset has no such entry)', () => {
    expect(findRelated('Primary Calamity Fragment', 1)).toBeNull()
  })

  it('defaults to the running game version when called single-arg (plugin SDK surface)', () => {
    // getCurrentPoeVersion defaults to 1 before initPoeVersion runs, so the single-arg
    // form (the published SDK signature) resolves against the PoE1 dataset.
    expect(findRelated('Tabula Rasa')).not.toBeNull()
  })

  it('returns null for items that exist in uniquesByBase but are not curated', () => {
    // Items in unique-info-poe2.json (uniquesByBase) are NOT in the related-items datasets.
    // The price-check sister intentionally shows no entry for them; "uniques on the same
    // base" surfaces on the filter page's UniquesForBase carousel instead.
    expect(findRelated("Cospri's Will", 1)).toBeNull()
  })
})

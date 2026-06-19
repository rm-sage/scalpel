import { describe, it, expect } from 'vitest'
import { resolveLeagueOptions } from './league-options'
import { getGameFeatures } from '@shared/game-features'

describe('resolveLeagueOptions', () => {
  it('returns the cached list when leaguesPoe1 is non-empty for version 1', () => {
    const settings = { leaguesPoe1: ['Settlers', 'Hardcore Settlers'], leaguesPoe2: [] }
    expect(resolveLeagueOptions(settings, 1)).toEqual(['Settlers', 'Hardcore Settlers'])
  })

  it('returns the cached list when leaguesPoe2 is non-empty for version 2', () => {
    const settings = { leaguesPoe1: [], leaguesPoe2: ['Dawn', 'Hardcore Dawn'] }
    expect(resolveLeagueOptions(settings, 2)).toEqual(['Dawn', 'Hardcore Dawn'])
  })

  it('falls back to bundled when leaguesPoe1 is empty for version 1', () => {
    const settings = { leaguesPoe1: [], leaguesPoe2: [] }
    expect(resolveLeagueOptions(settings, 1)).toEqual(getGameFeatures(1).leagues)
  })

  it('falls back to bundled when leaguesPoe2 is empty for version 2', () => {
    const settings = { leaguesPoe1: [], leaguesPoe2: [] }
    expect(resolveLeagueOptions(settings, 2)).toEqual(getGameFeatures(2).leagues)
  })

  it('falls back to bundled when leaguesPoe1 is missing for version 1', () => {
    const settings = {}
    expect(resolveLeagueOptions(settings, 1)).toEqual(getGameFeatures(1).leagues)
  })

  it('falls back to bundled when leaguesPoe2 is missing for version 2', () => {
    const settings = {}
    expect(resolveLeagueOptions(settings, 2)).toEqual(getGameFeatures(2).leagues)
  })

  it('falls back to bundled when settings is null', () => {
    expect(resolveLeagueOptions(null, 1)).toEqual(getGameFeatures(1).leagues)
    expect(resolveLeagueOptions(null, 2)).toEqual(getGameFeatures(2).leagues)
  })

  it('falls back to bundled when settings is undefined', () => {
    expect(resolveLeagueOptions(undefined, 1)).toEqual(getGameFeatures(1).leagues)
    expect(resolveLeagueOptions(undefined, 2)).toEqual(getGameFeatures(2).leagues)
  })

  it('version 1 selects leaguesPoe1 not leaguesPoe2', () => {
    const settings = { leaguesPoe1: ['Alpha'], leaguesPoe2: ['Beta'] }
    expect(resolveLeagueOptions(settings, 1)).toEqual(['Alpha'])
  })

  it('version 2 selects leaguesPoe2 not leaguesPoe1', () => {
    const settings = { leaguesPoe1: ['Alpha'], leaguesPoe2: ['Beta'] }
    expect(resolveLeagueOptions(settings, 2)).toEqual(['Beta'])
  })
})

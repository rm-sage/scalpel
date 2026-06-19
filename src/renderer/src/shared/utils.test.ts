import { describe, expect, it } from 'vitest'
import { promoteChaos, stripIpcErrorWrapper } from './utils'

describe('promoteChaos', () => {
  it('promotes to divine when divineValue >= 1', () => {
    expect(promoteChaos(400, 200, 1, 2)).toEqual({ text: '2', currencyKey: 'divine' })
  })

  it('stays in chaos below one divine (PoE1)', () => {
    expect(promoteChaos(50, 200, 1)).toEqual({ text: '50', currencyKey: 'chaos' })
  })

  it('uses exalted as the PoE2 baseline', () => {
    expect(promoteChaos(50, 200, 2)).toEqual({ text: '50', currencyKey: 'exalted' })
  })

  it('noPromote keeps the price in the baseline currency even past one divine (PoE1)', () => {
    expect(promoteChaos(220, 220, 1, 1, true)).toEqual({ text: '220', currencyKey: 'chaos' })
  })

  it('noPromote keeps the price in the baseline currency even past one divine (PoE2)', () => {
    expect(promoteChaos(141, 141, 2, 1, true)).toEqual({ text: '141', currencyKey: 'exalted' })
  })
})

describe('stripIpcErrorWrapper', () => {
  it('strips the full wrapper with inner Error: prefix', () => {
    expect(stripIpcErrorWrapper("Error invoking remote method 'bulk-exchange': Error: Rate limited")).toBe(
      'Rate limited',
    )
  })

  it('strips a wrapper without the inner Error: prefix (non-Error rejection)', () => {
    expect(stripIpcErrorWrapper("Error invoking remote method 'trade-search': boom")).toBe('boom')
  })

  it('passes through a message with no wrapper unchanged', () => {
    expect(stripIpcErrorWrapper("GGG's trade API timed out")).toBe("GGG's trade API timed out")
  })
})

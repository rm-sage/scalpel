// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PoeVersionProvider } from './poe-version-context'

// PNG imports resolve to asset URLs in vite; in vitest they return the path string.
vi.mock('../assets/other/poe-ninja.png', () => ({ default: 'ninja.png' }))

// Mock the currency icon map so CurrencyIcon renders <img> elements with
// predictable src values regardless of vitest asset resolution.
vi.mock('./currency-icons', () => ({
  getCurrencyIconMap: () => ({
    chaos: 'chaos.png',
    divine: 'divine.png',
    exa: 'exalted.png',
    exalted: 'exalted.png',
  }),
}))

import { NinjaPriceChip } from './NinjaPriceChip'

function wrap(node: React.ReactNode, version: 1 | 2 = 1): React.ReactElement {
  return <PoeVersionProvider version={version}>{node}</PoeVersionProvider>
}

describe('NinjaPriceChip', () => {
  it('PoE2 Exalted Orb without chaosPerDivine renders 1/N fraction from divineValue', () => {
    // divineValue = 1/141 means the rate is 141c per divine
    const priceInfo = { chaosValue: 1, divineValue: 1 / 141, graph: undefined }
    const { container } = render(wrap(<NinjaPriceChip baseType="Exalted Orb" priceInfo={priceInfo} />, 2))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('1/141')
    // The icon should be divine (alt="div")
    const img = container.querySelector('img[alt="div"]')
    expect(img).not.toBeNull()
  })

  it('PoE2 Divine Orb renders baseline chaos price unpromoted', () => {
    const priceInfo = { chaosValue: 141, divineValue: 1, graph: undefined }
    const { container } = render(wrap(<NinjaPriceChip baseType="Divine Orb" priceInfo={priceInfo} />, 2))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('141')
    // noPromote on 'rate' role: icon should be the PoE2 baseline currency (exa), not divine
    const img = container.querySelector('img[alt="ex"]')
    expect(img).not.toBeNull()
  })

  it('ordinary item PoE1 renders promoted divine chip', () => {
    const priceInfo = { chaosValue: 440, divineValue: 2, graph: undefined }
    const { container } = render(wrap(<NinjaPriceChip baseType="Mirror of Kalandra" priceInfo={priceInfo} />, 1))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('2')
    const img = container.querySelector('img[alt="div"]')
    expect(img).not.toBeNull()
  })

  it('PoE1 Chaos Orb with positive price renders 1/N fraction', () => {
    // divineValue = 1/220 means the rate is 220c per divine
    const priceInfo = { chaosValue: 1, divineValue: 1 / 220, graph: undefined }
    const { container } = render(wrap(<NinjaPriceChip baseType="Chaos Orb" priceInfo={priceInfo} />, 1))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('1/220')
    const img = container.querySelector('img[alt="div"]')
    expect(img).not.toBeNull()
  })

  it('chaosValue 0 renders nothing', () => {
    const priceInfo = { chaosValue: 0, divineValue: 0, graph: undefined }
    const { container } = render(wrap(<NinjaPriceChip baseType="Chaos Orb" priceInfo={priceInfo} />, 1))
    expect(container.firstChild).toBeNull()
  })
})

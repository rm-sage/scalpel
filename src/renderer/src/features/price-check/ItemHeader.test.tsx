// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PoeVersionProvider } from '../../shared/poe-version-context'

// PNG imports resolve to asset URLs in vite; in vitest they return the path string.
vi.mock('../../assets/other/poe-ninja.png', () => ({ default: 'ninja.png' }))
vi.mock('../../assets/currency/thaumaturgic-dust.png', () => ({ default: 'dust.png' }))

// Mock the currency icon map so CurrencyIcon renders <img> elements with
// predictable src values regardless of vitest asset resolution.
vi.mock('../../shared/currency-icons', () => ({
  getCurrencyIconMap: () => ({
    chaos: 'chaos.png',
    divine: 'divine.png',
    exa: 'exalted.png',
    exalted: 'exalted.png',
  }),
}))

import { ItemHeader } from './ItemHeader'

type HeaderProps = Parameters<typeof ItemHeader>[0]

function renderHeader(version: 1 | 2, props: Partial<HeaderProps>): ReturnType<typeof render> {
  const baseType = props.baseType ?? ''
  const heroName = props.heroName ?? baseType
  return render(
    <PoeVersionProvider version={version}>
      <ItemHeader heroIcon={null} color="#fff" isDivCard={false} {...props} baseType={baseType} heroName={heroName} />
    </PoeVersionProvider>,
  )
}

describe('ItemHeader pair-currency display', () => {
  it('shows Divine Orb in the baseline currency, not promoted to "1 div" (PoE2)', () => {
    const { getByText, queryByText } = renderHeader(2, {
      baseType: 'Divine Orb',
      priceInfo: { chaosValue: 141, divineValue: 1 },
    })
    expect(getByText('141')).toBeInTheDocument()
    expect(queryByText('1')).toBeNull()
  })

  it('shows Exalted Orb as a divine fraction (PoE2)', () => {
    const { getByText } = renderHeader(2, {
      baseType: 'Exalted Orb',
      priceInfo: { chaosValue: 1, divineValue: 1 / 141 },
      chaosPerDivine: 141.3,
    })
    expect(getByText('1/141')).toBeInTheDocument()
  })

  it('shows Chaos Orb as a divine fraction (PoE1)', () => {
    const { getByText } = renderHeader(1, {
      baseType: 'Chaos Orb',
      priceInfo: { chaosValue: 1, divineValue: 1 / 220 },
      chaosPerDivine: 220,
    })
    expect(getByText('1/220')).toBeInTheDocument()
  })

  it('shows Divine Orb in the baseline currency, not promoted to "1 div" (PoE1)', () => {
    const { getByText, queryByText } = renderHeader(1, {
      baseType: 'Divine Orb',
      priceInfo: { chaosValue: 220, divineValue: 1 },
    })
    expect(getByText('220')).toBeInTheDocument()
    expect(queryByText('1')).toBeNull()
  })

  it('leaves ordinary items on the normal promoting chip', () => {
    const { getByText } = renderHeader(1, {
      baseType: 'Mirror of Kalandra',
      priceInfo: { chaosValue: 440, divineValue: 2 },
      chaosPerDivine: 220,
    })
    expect(getByText('2')).toBeInTheDocument()
  })
})

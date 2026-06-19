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

import { PriceChip } from './PriceChip'

function wrap(node: React.ReactNode): React.ReactElement {
  return <PoeVersionProvider version={1}>{node}</PoeVersionProvider>
}

describe('PriceChip', () => {
  it('renders price without trend when no graph is provided', () => {
    const { container, queryByTestId } = render(wrap(<PriceChip chaosValue={47} />))
    expect(container.querySelector('.font-semibold')?.textContent).toBe('47')
    expect(queryByTestId('trend-up')).toBeNull()
    expect(queryByTestId('trend-down')).toBeNull()
    expect(queryByTestId('trend-flat')).toBeNull()
    expect(queryByTestId('sparkline-overlay')).toBeNull()
  })

  it('renders the trend arrow and sparkline overlay when graph is provided', () => {
    const graph = [0, 0, 0, 0, 0, 0, 20]
    const { getByTestId, queryByTestId } = render(wrap(<PriceChip chaosValue={100} graph={graph} />))
    expect(getByTestId('trend-up')).toBeDefined()
    expect(queryByTestId('sparkline-overlay')).toBeDefined()
  })

  it('suppresses trend when hideTrend is true even when graph is provided', () => {
    const graph = [0, 0, 0, 0, 0, 0, 20]
    const { queryByTestId } = render(wrap(<PriceChip chaosValue={100} graph={graph} hideTrend />))
    expect(queryByTestId('trend-up')).toBeNull()
    expect(queryByTestId('sparkline-overlay')).toBeNull()
  })

  it('renders a down-trend arrow for a negative graph', () => {
    const graph = [0, 0, 0, 0, 0, 0, -25]
    const { getByTestId } = render(wrap(<PriceChip chaosValue={50} graph={graph} />))
    expect(getByTestId('trend-down')).toBeDefined()
  })

  it('renders a flat-trend icon for a graph within the threshold', () => {
    const graph = [0, 0, 0, 0, 0, 0, 5]
    const { getByTestId } = render(wrap(<PriceChip chaosValue={50} graph={graph} />))
    expect(getByTestId('trend-flat')).toBeDefined()
  })

  it('noPromote keeps the chip in the baseline currency', () => {
    const { container } = render(wrap(<PriceChip chaosValue={250} chaosPerDivine={200} noPromote />))
    // 250c at 200c/div would normally promote to "1.3"; noPromote pins 250 chaos.
    expect(container.querySelector('.font-semibold')?.textContent).toBe('250')
    // Icon must be chaos (alt="c"), NOT divine.
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('c')
  })

  it('displayOverride replaces the formatted value and currency icon', () => {
    const { container } = render(
      wrap(<PriceChip chaosValue={141} noPromote displayOverride={{ text: '1/141', currencyKey: 'divine' }} />),
    )
    expect(container.querySelector('.font-semibold')?.textContent).toBe('1/141')
    // Icon must be divine (alt="div"), not chaos.
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('div')
  })
})

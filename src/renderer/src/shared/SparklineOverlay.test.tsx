// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SparklineOverlay } from './SparklineOverlay'

describe('SparklineOverlay', () => {
  it('renders the correct number of polyline points for a full graph', () => {
    const graph = [10, 5, -3, 8, 20, 15, 18]
    const { getAllByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    const segments = getAllByTestId('sparkline-segment')
    // No nulls - all 7 points in one segment.
    expect(segments).toHaveLength(1)
    // points attribute has 7 coordinate pairs.
    const pts = segments[0].getAttribute('points')!.trim().split(' ')
    expect(pts).toHaveLength(7)
  })

  it('splits null entries into separate polyline elements', () => {
    const graph = [10, null, 5, 8, null, 20, 15]
    const { getAllByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    const segments = getAllByTestId('sparkline-segment')
    // Three contiguous runs: [10], [5, 8], [20, 15].
    expect(segments).toHaveLength(3)
  })

  it('colors the total-change label blue for an up trend', () => {
    const graph = [0, 0, 0, 0, 0, 0, 25]
    const { getByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    const label = getByTestId('sparkline-total')
    expect(label.style.color).toBe('rgb(74, 158, 255)')
  })

  it('colors the total-change label red for a down trend', () => {
    const graph = [0, 0, 0, 0, 0, 0, -25]
    const { getByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    const label = getByTestId('sparkline-total')
    expect(label.style.color).toBe('rgb(239, 83, 80)')
  })

  it('uses a muted color for a flat trend total-change label', () => {
    const graph = [0, 0, 0, 0, 0, 0, 5]
    const { getByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    const label = getByTestId('sparkline-total')
    expect(label.style.color).toBe('rgb(136, 136, 136)')
  })

  it('renders peak and valley dots with no labels when currentPrice is omitted', () => {
    const graph = [10, 5, -8, 3, 25, 12, 18]
    const { getByTestId, queryByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    // Dots still render so the user can see where the extrema are.
    expect(getByTestId('sparkline-peak-dot')).toBeInTheDocument()
    expect(getByTestId('sparkline-valley-dot')).toBeInTheDocument()
    // No price chips and no fallback labels - peak/valley values are only
    // surfaced as price chips when currentPrice is provided.
    expect(queryByTestId('sparkline-peak-chip')).toBeNull()
    expect(queryByTestId('sparkline-valley-chip')).toBeNull()
  })

  it('omits the valley marker when peak equals valley (flat data)', () => {
    const graph = [4, 4, 4, 4, 4, 4, 4]
    const { getByTestId, queryByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    expect(getByTestId('sparkline-peak-dot')).toBeInTheDocument()
    expect(queryByTestId('sparkline-valley-dot')).toBeNull()
  })

  it('renders price chips at peak/valley when currentPrice is provided', () => {
    // currentChaos=100, todayPct=18, peakPct=25, valleyPct=-8
    // baseline = 100 / 1.18 = 84.745, peak = 84.745 * 1.25 = 105.93 -> formats to "106"
    // valley = 84.745 * 0.92 = 77.965 -> formats to "78"
    const graph = [10, 5, -8, 3, 25, 12, 18]
    const { getByTestId, queryByTestId } = render(
      <SparklineOverlay
        graph={graph}
        visible
        cursor={{ viewportX: 100, viewportY: 100, scale: 1 }}
        currentPrice={{ chaosValue: 100 }}
      />,
    )
    // Chips render, text labels do not.
    expect(getByTestId('sparkline-peak-chip').textContent).toContain('106')
    expect(getByTestId('sparkline-valley-chip').textContent).toContain('78')
    expect(queryByTestId('sparkline-peak-label')).toBeNull()
    expect(queryByTestId('sparkline-valley-label')).toBeNull()
  })

  it('renders a current-price footer bar when currentPrice is provided', () => {
    const graph = [10, 5, -8, 3, 25, 12, 18]
    const { getByTestId } = render(
      <SparklineOverlay
        graph={graph}
        visible
        cursor={{ viewportX: 100, viewportY: 100, scale: 1 }}
        currentPrice={{ chaosValue: 42 }}
      />,
    )
    expect(getByTestId('sparkline-current-price').textContent).toContain('42')
  })

  it('omits the current-price footer bar when currentPrice is absent', () => {
    const graph = [10, 5, -8, 3, 25, 12, 18]
    const { queryByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    expect(queryByTestId('sparkline-current-price')).toBeNull()
  })

  it('does not render extrema markers when graph is all null', () => {
    const graph = [null, null, null, null, null, null, null]
    const { queryByTestId } = render(
      <SparklineOverlay graph={graph} visible cursor={{ viewportX: 100, viewportY: 100, scale: 1 }} />,
    )
    expect(queryByTestId('sparkline-peak-dot')).toBeNull()
    expect(queryByTestId('sparkline-valley-dot')).toBeNull()
  })

  it('keeps footer and peak/valley chips in the baseline currency when noPromote is set', () => {
    const graph = [10, 5, -8, 3, 25, 12, 18]
    const { getByTestId } = render(
      <SparklineOverlay
        graph={graph}
        visible
        cursor={{ viewportX: 100, viewportY: 100, scale: 1 }}
        currentPrice={{ chaosValue: 400, chaosPerDivine: 200 }}
        noPromote
      />,
    )
    // 400c at 200c/div would normally promote to "2 divine"; noPromote pins chaos.
    expect(getByTestId('sparkline-current-price').textContent).toBe('400 chaos')
    // Peak historical value also stays chaos-denominated - the chip inner span
    // contains the numeric value (unpromoted). baseline=400/1.18=338.98,
    // peak=338.98*1.25=423.7 -> rounds to "424" chaos, not "2.1 divine".
    expect(getByTestId('sparkline-peak-chip-inner').querySelector('span')!.textContent).toContain('424')
  })
})

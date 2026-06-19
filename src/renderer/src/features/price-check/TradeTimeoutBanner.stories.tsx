import type { Meta, StoryObj } from '@storybook/react-vite'
import { TradeTimeoutBanner } from './TradeTimeoutBanner'

/** Rate-limit countdown banner shown when the trade API has timed the user out.
 *  Ticks every 500 ms; ring color lerps red -> yellow -> green as the wait
 *  shrinks. When `until` is in the past the banner flips to a static
 *  "try again" state -- the parent clears it when a new search starts.
 *
 *  Stories use `render` functions so `Date.now()` is evaluated at render time,
 *  not at module load. */
const meta: Meta<typeof TradeTimeoutBanner> = {
  title: 'PriceCheck/TradeTimeoutBanner',
  component: TradeTimeoutBanner,
}
export default meta

type Story = StoryObj<typeof TradeTimeoutBanner>

const Host = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="w-[420px] bg-neutral-900 rounded">{children}</div>
)

/** Mid-countdown -- ring sits in the yellow-ish zone, around 45 seconds left. */
export const CountingDown: Story = {
  render: () => (
    <Host>
      <TradeTimeoutBanner until={Date.now() + 45_000} />
    </Host>
  ),
}

/** Short remainder -- ring is near green, about 6 seconds left. */
export const AlmostDone: Story = {
  render: () => (
    <Host>
      <TradeTimeoutBanner until={Date.now() + 6_000} />
    </Host>
  ),
}

/** Expired state -- green headline, "try again" sub-line, 0:00 ring. */
export const Expired: Story = {
  render: () => (
    <Host>
      <TradeTimeoutBanner until={Date.now() - 1_000} />
    </Host>
  ),
}

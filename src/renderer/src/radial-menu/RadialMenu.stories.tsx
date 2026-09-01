import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  RADIAL_PLUGIN_ICON,
  type RadialBackdrop,
  type RadialOpenPayload,
  type RadialSlice,
} from '@shared/contracts/radial'
import { RadialMenuView } from './RadialMenu'

/** Four-slice ring, the shape most users end up with. */
export const samplePayload: RadialOpenPayload = {
  center: { x: 450, y: 350 },
  slices: [
    { id: 's0', icon: 'Filter', label: 'Filter Check', action: { kind: 'filter' } },
    { id: 's1', icon: 'Buy', label: 'Price Check', action: { kind: 'pricecheck' } },
    { id: 's2', icon: 'Setting', label: 'Settings', action: { kind: 'appmacro', action: 'openSettings' } },
    { id: 's3', icon: 'Message', label: '/hideout', action: { kind: 'chat', command: '/hideout', autoSubmit: true } },
  ],
}

const extraSlices: RadialSlice[] = [
  { id: 's4', icon: 'AllApplication', label: 'Cheat Sheets', action: { kind: 'cheatsheet' } },
  { id: 's5', icon: 'Search', label: 'Regex', action: { kind: 'appmacro', action: 'openRegex' } },
  { id: 's6', icon: 'Diamond', label: 'Div Cards', action: { kind: 'appmacro', action: 'openDivCards' } },
  {
    id: 's7',
    icon: 'Message',
    label: '/kingsmarch',
    action: { kind: 'chat', command: '/kingsmarch', autoSubmit: true },
  },
]

/** The radial overlay's ring: a backdrop disc in the theme's panel colour, an
 *  accent-coloured goo bubble at the cursor, and a blob that stretches out of it
 *  toward whichever sector the pointer is in, ending up as a puck behind that
 *  slice's icon. Move the mouse around the canvas to drive it -- selection is a
 *  polar hit test against the centre, so the whole wedge is a target and it
 *  starts at the bubble's edge.
 *
 *  Every colour is a theme token, and preview.tsx imports the renderer's
 *  styles.css, so the `:root` defaults stand in for the live palette that
 *  bootstrapTheme() installs in the real window. The host below therefore takes
 *  its ground from `bg-bg-solid` rather than a fixed neutral -- point the theme
 *  vars somewhere else and the story follows.
 *
 *  The component's root is `fixed inset-0` (in the real app it covers the entire
 *  game window), so the host also sets `transform: translateZ(0)` to become the
 *  containing block for it. Without that the ring would escape into the whole
 *  Storybook canvas. */
const meta: Meta<typeof RadialMenuView> = {
  title: 'Radial Menu / RadialMenuView',
  component: RadialMenuView,
  // `samplePayload` is a shared fixture, not a story; CSF would otherwise turn
  // every named export in this file into a sidebar entry.
  excludeStories: ['samplePayload'],
  args: { onFire: () => {}, onCancel: () => {} },
  // Fullscreen, not the default padded layout: the root is `fixed inset-0`, so
  // any padding around the host would offset it from the viewport and make the
  // story's pointer math disagree with the real overlay's.
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative w-[900px] h-[700px] overflow-hidden bg-bg-solid" style={{ transform: 'translateZ(0)' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof RadialMenuView>

export const FourSlices: Story = {
  args: { payload: samplePayload },
}

export const EightSlices: Story = {
  args: { payload: { center: samplePayload.center, slices: [...samplePayload.slices, ...extraSlices] } },
}

/** The user's size knob at its low end (settings: Radial Menu -> Menu size).
 *  Every length derives from it - bubble, ring, deadzone, puck, backdrop disc
 *  and the goo blur - so the liquid behaves the same, just smaller. The icons
 *  and labels deliberately do not scale: a small ring is smaller, not squintier. */
export const SmallScale: Story = {
  args: { payload: { ...samplePayload, scale: 0.6 } },
}

/** Plugin-backed slices, whose icons main resolves out of the plugin tab
 *  registry and hangs on the payload. Both shapes the registry accepts are here:
 *  raw SVG markup (currentColor, so it inherits the ring's themed glyph colour
 *  and flips to the on-accent colour on the puck) and an image URL (which
 *  carries its own palette and cannot). */
/** The frosted backdrop. In the app this is one real frame of the game window,
 *  captured by main at open and delivered a beat later on its own channel; here
 *  it is a lurid stand-in chosen to prove the point, because the whole job of
 *  the layer is to survive arbitrary, saturated, high-contrast art.
 *
 *  It is positioned by the crop's own game-CSS-px `origin`, not by the disc, so
 *  the pixels line up with what they are covering even when the ring's centre
 *  has been clamped away from where the capture was taken. The values below sit
 *  it a little off-centre on purpose, which is what a clamped open looks like.
 *
 *  The treatment is radial, which this art makes obvious: full blur and tint at
 *  the centre, both falling off to the untouched capture toward the rim, and the
 *  disc itself feathering out so there is no hard frosted circle. Drive the
 *  "edge" slider in the DevPanel story to see where the fade begins. */
const fakeBackdrop: RadialBackdrop = {
  nonce: 1,
  origin: { x: 450 - 280 + 40, y: 350 - 280 - 30 },
  width: 560,
  height: 560,
  dataUrl:
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560">
        <rect width="560" height="560" fill="#123"/>
        <circle cx="150" cy="180" r="130" fill="#c2410c"/>
        <circle cx="400" cy="380" r="170" fill="#0e7490"/>
        <rect x="230" y="60" width="90" height="440" fill="#f5d76e"/>
        <rect x="0" y="430" width="560" height="130" fill="#1f7a3f"/>
      </svg>`,
    ),
}

export const BlurredBackdrop: Story = {
  args: { payload: { ...samplePayload, nonce: 1 }, backdrop: fakeBackdrop },
}

/** The developer tuning panel, which main gates on the developerMode setting.
 *  It writes the composite's custom properties straight onto the menu root, so
 *  the sliders retune the disc above with no render of the ring; Raw view drops
 *  the blur, the grade and the tint at once, which is how a bad capture is told
 *  apart from a grade that is eating a good one. Hold open is on by default, so
 *  clicking around in here never fires a slice or dismisses the menu. */
export const DevPanel: Story = {
  args: { payload: { ...samplePayload, nonce: 1, dev: true }, backdrop: fakeBackdrop },
}

/** Plugin slices in their default dress: the plugin's own art in a round token,
 *  which is what RADIAL_PLUGIN_ICON opts into. The third slice is the escape
 *  hatch - a plugin action wearing a chosen IconPark glyph, which now beats the
 *  enrichment instead of being overridden by it. */
export const PluginBadges: Story = {
  args: {
    payload: {
      center: samplePayload.center,
      slices: [
        {
          id: 'b0',
          icon: RADIAL_PLUGIN_ICON,
          label: 'Calculator',
          action: { kind: 'appmacro', action: 'plugin:scalpel.calculator' },
          iconSvg:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 16h2m4 0h2"/></svg>',
        },
        {
          id: 'b1',
          icon: RADIAL_PLUGIN_ICON,
          label: 'Now Playing',
          action: { kind: 'appmacro', action: 'plugin-overlay:scalpel.now-playing' },
          iconSvg:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d4a24c"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Ccircle cx="12" cy="12" r="3" fill="%23222"/%3E%3C/svg%3E',
        },
        {
          id: 'b2',
          icon: 'Diamond',
          label: 'Chosen glyph',
          action: { kind: 'appmacro', action: 'plugin:scalpel.calculator' },
          iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="red"/></svg>',
        },
        // ...and a sentinel with no registered art at all: falls back to the
        // Components glyph rather than drawing an empty token.
        {
          id: 'b3',
          icon: RADIAL_PLUGIN_ICON,
          label: 'Uninstalled',
          action: { kind: 'appmacro', action: 'plugin:gone' },
        },
      ],
    },
  },
}

export const PluginIcons: Story = {
  args: {
    payload: {
      center: samplePayload.center,
      slices: [
        {
          id: 'p0',
          icon: 'Components',
          label: 'Calculator',
          action: { kind: 'appmacro', action: 'plugin:scalpel.calculator' },
          iconSvg:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 16h2m4 0h2"/></svg>',
        },
        {
          id: 'p1',
          icon: 'Components',
          label: 'Now Playing',
          action: { kind: 'appmacro', action: 'plugin-overlay:scalpel.now-playing' },
          iconSvg:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d4a24c"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Ccircle cx="12" cy="12" r="3" fill="%23222"/%3E%3C/svg%3E',
        },
        ...samplePayload.slices.slice(0, 2),
      ],
    },
  },
}

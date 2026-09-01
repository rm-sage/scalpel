/** House IconPark config: two-tone, primary painted with `currentColor` so a
 *  glyph takes its colour from whatever wraps it, secondary a faint white wash.
 *
 *  A leaf on purpose. Most of the app reaches this through `shared/constants`,
 *  which re-exports it - but constants also pulls ~1.6MB of item/div-card JSON,
 *  and importing it from a lightweight window (the radial ring) grew that
 *  window's shared chunk from 168kB to 1.9MB. Anything that wants only the icon
 *  config should import it from here. */
export const IP = {
  theme: 'two-tone' as const,
  fill: ['currentColor', 'rgba(255,255,255,0.2)'] as [string, string],
  style: { display: 'flex' },
}

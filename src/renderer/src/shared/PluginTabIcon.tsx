/** Icon a plugin registered for its title-bar tab. The registry accepts two
 *  shapes - inline SVG markup or an image URL (typically a data: URL) - so every
 *  consumer would otherwise repeat the fork and the size clamp.
 *
 *  Sizing lives here for the same reason TitleBar clamps: CSS beats the SVG's
 *  own width/height attrs, and the descendant selector reaches an <svg> wrapped
 *  in any depth of the plugin's own markup (iconpark output nests one in a
 *  span). Class strings are written out per size so Tailwind can see them. */
const SIZES = {
  4: { wrap: '', svg: '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:block', img: 'w-4 h-4 block' },
  5: { wrap: '', svg: '[&_svg]:w-5 [&_svg]:h-5 [&_svg]:block', img: 'w-5 h-5 block' },
  // Fill whatever box the caller put us in, rather than clamping to a px size.
  // `object-cover` on the image branch is what makes an image edge-to-edge in a
  // round badge: the alternative, contain, letterboxes it into a stamp floating
  // in the middle of the circle. The crop that costs is inherent to putting
  // rectangular art in a circle.
  fill: {
    wrap: 'w-full h-full',
    svg: '[&_svg]:w-full [&_svg]:h-full [&_svg]:block',
    img: 'w-full h-full block object-cover',
  },
} as const

export interface PluginTabIconProps {
  icon: string
  size: keyof typeof SIZES
  /** Applied to the SVG branch only - plugin SVGs typically paint currentColor,
   *  while an image URL carries its own colours. */
  color?: string
  className?: string
}

export function PluginTabIcon({ icon, size, color, className = '' }: PluginTabIconProps): JSX.Element {
  if (icon.trimStart().startsWith('<svg')) {
    return (
      <span
        className={`flex items-center justify-center ${SIZES[size].wrap} ${SIZES[size].svg} ${className}`}
        style={color ? { color } : undefined}
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    )
  }
  return <img src={icon} alt="" className={`${SIZES[size].img} ${className}`} />
}

/** A plugin's icon as a round token: the art edge to edge, clipped to a circle,
 *  over a theme-token backing that only shows through where the art is
 *  transparent, ringed by a currentColor stroke that ties it to the glyphs
 *  around it. Used on the radial ring and in its icon picker, so it lives here
 *  beside the fork it wraps rather than being written out twice.
 *
 *  The stroke inherits while the art is pinned, and the split is the point.
 *  The badge carries its own background, so a caller that repaints its glyphs
 *  on some state - the ring flips them to an on-accent colour when the goo puck
 *  arrives - would put a dark glyph on a dark token at exactly the wrong moment
 *  if the art inherited too. The stroke sits on the background, not the token,
 *  so it is exactly the thing that SHOULD follow those repaints. Its 1.5px
 *  weight matches the IconPark glyphs (strokeWidth 4 on a 48 viewBox at ~20px).
 *
 *  Square art is the norm and fills exactly. Non-square INLINE SVG still
 *  letterboxes inside the square box, because honouring its aspect ratio is the
 *  browser's default for a viewBox and overriding it would mean rewriting the
 *  plugin's own markup. */
export function PluginIconBadge({
  icon,
  size,
  testId,
  className = '',
}: {
  icon: string
  /** Diameter in px. */
  size: number
  testId?: string
  className?: string
}): JSX.Element {
  return (
    <span
      data-testid={testId}
      className={`flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-bg-card border-[1.5px] border-current ${className}`}
      style={{ width: size, height: size }}
    >
      <PluginTabIcon icon={icon} size="fill" color="var(--text)" />
    </span>
  )
}

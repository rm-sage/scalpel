import type { StatFilter } from '../../trade'
import type { ResolvedOverride } from './overrides'
import { baseId } from '../stat-id'

// token -> how to force-default-ON. 'native' = already on by default upstream; kept as no-op so data can declare intent.
const NON_STAT_TARGETS: Record<
  string,
  { kind: 'type'; type: string } | { kind: 'id'; id: string } | { kind: 'native' }
> = {
  rune_socket_count: { kind: 'native' },
  abyssal_socket_count: { kind: 'native' },
  links: { kind: 'native' },
  uses_remaining: { kind: 'native' },
  seed_number: { kind: 'native' },
  conqueror_name: { kind: 'native' },
  ring_size_variant: { kind: 'native' },
  corrupted_implicits: { kind: 'native' },
  charm_slot_count: { kind: 'native' },
  instilled_mods: { kind: 'native' },
  cultivated_mods: { kind: 'native' },
  granted_skill_level: { kind: 'type', type: 'skill' },
  anointments: { kind: 'type', type: 'enchant' },
  socket_colors: { kind: 'id', id: 'socket.white_sockets' },
}

/** Apply unique override rules to the assembled StatFilter list.
 *
 *  Order of operations: mode pass first, then nonStatFilters, then defaultFilters
 *  (so defaultFilters wins on misc.corrupted).
 *
 *  Returns a new array; input rows are spread-modified (pure). */
export function applyUniqueOverrides(
  filters: StatFilter[],
  o: ResolvedOverride,
  ctx: { pct: number; corrupted: boolean },
): StatFilter[] {
  let result: StatFilter[]

  // ─── Mode pass ───────────────────────────────────────────────────────────────

  if (o.mode === 'none') {
    result = filters.map((row) => {
      if (row.foulborn) return row
      if (row.type === 'explicit' || row.type === 'pseudo' || row.type === 'defence' || row.type === 'weapon') {
        return { ...row, enabled: false, premium: undefined }
      }
      return row
    })
  } else if (o.mode === 'all_explicits') {
    result = filters.map((row) => {
      if (row.id === 'misc.corrupted') {
        // Under all_explicits every rolled mod prices the item, so corruption status segments the market;
        // the later defaultFilters pass may additionally pin chipState.
        return { ...row, enabled: true }
      }
      if (row.type === 'explicit' && row.value != null && !row.fixedRoll && !row.foulborn) {
        const bid = baseId(row.id)
        const spec = o.mods.get(bid)
        const isLower = spec?.direction === 'lower' || o.lowerIsBetter.has(bid)
        // Flag premium: under all_explicits the rolled mods ARE the item's signature, so they
        // must survive the renderer's auto-Base-mode on uniques (which keeps only premium/
        // foulborn/perfectRoll/learned rows). Without this they are enabled here but the UI
        // strips them on open (issue: Against the Darkness affixes not on by default).
        return { ...applyDirectionBounds(row, o, ctx, isLower), enabled: true, premium: true }
      }
      return row
    })
  } else if (o.mode === 'stat_list') {
    result = filters.map((row) => {
      if (row.foulborn) return row
      const bid = baseId(row.id)
      const spec = o.mods.get(bid)
      if (spec != null) {
        const isLower = spec.direction === 'lower' || o.lowerIsBetter.has(bid)
        const tier = spec.tier ?? 'primary'
        if (tier === 'secondary') {
          const bounded = applyDirectionBounds(row, o, ctx, isLower)
          return { ...bounded, enabled: false }
        }
        // primary: enabled + premium, apply direction bounds
        const bounded = applyDirectionBounds(row, o, ctx, isLower)
        return { ...bounded, enabled: true, premium: true }
      }
      // unlisted explicit or pseudo -> disabled
      if (row.type === 'explicit' || row.type === 'pseudo') {
        return { ...row, enabled: false }
      }
      // defence/weapon/implicit/enchant/socket/misc/timeless/gem/skill -> untouched
      return row
    })
  } else {
    result = filters
  }

  // ─── nonStatFilters pass ─────────────────────────────────────────────────────

  for (const token of o.nonStatFilters) {
    const target = NON_STAT_TARGETS[token]
    if (!target || target.kind === 'native') continue
    if (target.kind === 'type') {
      result = result.map((row) => (row.type === target.type ? { ...row, enabled: true } : row))
    } else if (target.kind === 'id') {
      result = result.map((row) => (row.id === target.id ? { ...row, enabled: true } : row))
    }
  }

  // ─── defaultFilters pass (wins over mode pass) ───────────────────────────────

  if (o.defaultFilters.corrupted === false) {
    result = result.map((row) => {
      if (row.id !== 'misc.corrupted') return row
      return { ...row, enabled: true, chipState: ctx.corrupted ? 'yes' : 'no' }
    })
  }

  return result
}

/** Compute direction-aware bounds for a single row.
 *  Returns a shallow copy of the row with updated min/max. */
function applyDirectionBounds(
  row: StatFilter,
  o: ResolvedOverride,
  ctx: { pct: number },
  isLower: boolean,
): StatFilter {
  if (row.value == null) return row
  const bid = baseId(row.id)
  const spec = o.mods.get(bid)
  const p = spec?.prefill ?? ctx.pct

  if (isLower) {
    // Direction LOWER: prefill a MAX bound (lower roll is better)
    const max = row.value >= 0 ? Math.ceil(row.value / p) : Math.ceil(row.value * p)
    return { ...row, min: null, max }
  }

  // Direction HIGHER
  if (spec?.prefill != null) {
    // Has an explicit prefill: recompute min
    let min = row.value >= 0 ? Math.floor(row.value * p) : Math.ceil(row.value * (2 - p))
    // Clamp to modRange.min when below it and value >= modRange.min
    if (row.modRange != null && row.value >= row.modRange.min && min < row.modRange.min) {
      min = row.modRange.min
    }
    return { ...row, min }
  }

  // Direction HIGHER without spec.prefill: leave producer bounds untouched
  return row
}

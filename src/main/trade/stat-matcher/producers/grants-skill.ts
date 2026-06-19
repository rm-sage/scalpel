import type { StatFilter } from '../../trade'
import { matchModToStat } from '../mod-matcher'

type GrantsSkillItemInfo = {
  grantedSkills?: string[]
  itemClass?: string
}

// A few granted skills appear under two trade stat ids that share the exact
// display text "Grants Skill: Level # <Skill>" -- GGG splits them per item
// class. The clipboard carries identical text for both, so matchModToStat
// (text-only) can't tell them apart; it returns whichever entry the live stats
// list happens to place first. The item's class is the only discriminator, so
// pin the stat id per class here.
//
// Each mapping below was verified by a live trade2 search (checking which item
// each stat id actually returns), NOT by the internal skill-effect name -- the
// trade index does not follow that name (Blink's chest effect is literally
// "SorceressBlinkReservation" yet the chest searches under plain skill.blink).
// Always confirm against a real search before touching these.
//
//   Blink          Amulets -> skill.blink_reservation
//                  Body Armours (Sands of Silk) -> skill.blink
//   Lightning Bolt Amulets (Choir of the Storm) -> skill.unique_breach_lightning_bolt
//                  Staves (Voltaic Staff bases) -> skill.lightning_bolt
//   Decompose      Boots (Corpsewade) -> skill.corpse_cloud_triggered
//                  Wands (Acrid Wand bases) -> skill.corpse_cloud
const AMBIGUOUS_GRANTED_SKILLS: Record<string, { byClass: Record<string, string>; fallback: string }> = {
  Blink: {
    byClass: { Amulets: 'skill.blink_reservation' },
    fallback: 'skill.blink',
  },
  'Lightning Bolt': {
    byClass: { Amulets: 'skill.unique_breach_lightning_bolt' },
    fallback: 'skill.lightning_bolt',
  },
  Decompose: {
    byClass: { Boots: 'skill.corpse_cloud_triggered' },
    fallback: 'skill.corpse_cloud',
  },
}

// Strip "Level N " prefix from the granted-skill label so the level lives
// only in the scrub box, not in the chip text.
// e.g. "Grants Skill: Level 15 Runic Tempering" -> "Runic Tempering"
function skillName(line: string): string {
  return line.replace(/^Grants Skill:\s+Level \d+\s+/, '')
}

// For skills with class-specific duplicate stat ids, pick the id GGG ties to
// this item's class; otherwise keep the plain text match. The pin is
// order-independent: even if the live stats list reorders the duplicates, the
// table -- not the matcher's first-hit -- decides the id for every class.
function resolveStatId(skill: string, matchedId: string, itemClass: string | undefined): string {
  const ambiguous = AMBIGUOUS_GRANTED_SKILLS[skill]
  if (!ambiguous) return matchedId
  return (itemClass && ambiguous.byClass[itemClass]) || ambiguous.fallback
}

// One price-check chip per granted skill, disabled by default.
// Level is pre-dialed into the min box.
export function buildGrantsSkillFilters(itemInfo: GrantsSkillItemInfo | undefined): StatFilter[] {
  if (!itemInfo?.grantedSkills?.length) return []

  const out: StatFilter[] = []
  for (const line of itemInfo.grantedSkills) {
    const matched = matchModToStat(line, false, 'skill')
    if (!matched) continue
    const level = matched.value ?? 0
    const skill = skillName(line)
    out.push({
      id: resolveStatId(skill, matched.statId, itemInfo.itemClass),
      text: `Grants Skill: ${skill}`,
      value: level,
      min: level,
      max: null,
      enabled: false,
      type: 'skill',
    })
  }
  return out
}

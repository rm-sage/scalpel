import { beforeEach, describe, expect, it } from 'vitest'
import { _setStatEntriesForTests } from '../index'
import { buildGrantsSkillFilters } from './grants-skill'

const RUNIC_TEMPERING_ENTRY = {
  id: 'skill.runic_tempering',
  text: 'Grants Skill: Level # Runic Tempering',
  type: 'skill',
}

const FROST_SHIELD_ENTRY = {
  id: 'skill.frost_shield',
  text: 'Grants Skill: Level # Frost Shield',
  type: 'skill',
}

// Two stat ids share the exact text "Grants Skill: Level # Blink": the Sands of
// Silk body armour searches under skill.blink, amulets under
// skill.blink_reservation (verified against live trade2 saved searches).
const BLINK_ENTRY = {
  id: 'skill.blink',
  text: 'Grants Skill: Level # Blink',
  type: 'skill',
}

const BLINK_RESERVATION_ENTRY = {
  id: 'skill.blink_reservation',
  text: 'Grants Skill: Level # Blink',
  type: 'skill',
}

beforeEach(() => {
  _setStatEntriesForTests([RUNIC_TEMPERING_ENTRY, FROST_SHIELD_ENTRY])
})

describe('buildGrantsSkillFilters', () => {
  it('returns empty array when itemInfo is undefined', () => {
    expect(buildGrantsSkillFilters(undefined)).toEqual([])
  })

  it('returns empty array when grantedSkills is empty', () => {
    expect(buildGrantsSkillFilters({ grantedSkills: [] })).toEqual([])
  })

  it('emits one filter for a single granted skill', () => {
    const filters = buildGrantsSkillFilters({
      grantedSkills: ['Grants Skill: Level 15 Runic Tempering'],
    })
    expect(filters).toHaveLength(1)
    const f = filters[0]
    expect(f.id).toBe('skill.runic_tempering')
    expect(f.text).toBe('Grants Skill: Runic Tempering')
    expect(f.value).toBe(15)
    expect(f.min).toBe(15)
    expect(f.max).toBeNull()
    expect(f.enabled).toBe(false)
    expect(f.type).toBe('skill')
  })

  it('emits two filters for two granted skills', () => {
    const filters = buildGrantsSkillFilters({
      grantedSkills: ['Grants Skill: Level 15 Runic Tempering', 'Grants Skill: Level 10 Frost Shield'],
    })
    expect(filters).toHaveLength(2)
    expect(filters[0].id).toBe('skill.runic_tempering')
    expect(filters[0].min).toBe(15)
    expect(filters[1].id).toBe('skill.frost_shield')
    expect(filters[1].min).toBe(10)
  })

  it('skips granted skills not present in the stat list', () => {
    const filters = buildGrantsSkillFilters({
      grantedSkills: ['Grants Skill: Level 5 Unknown Skill'],
    })
    expect(filters).toEqual([])
  })

  it('skips unmatched skills and keeps matched ones', () => {
    const filters = buildGrantsSkillFilters({
      grantedSkills: ['Grants Skill: Level 20 Unknown Skill', 'Grants Skill: Level 15 Runic Tempering'],
    })
    expect(filters).toHaveLength(1)
    expect(filters[0].id).toBe('skill.runic_tempering')
  })

  describe('Blink class disambiguation (two stat ids, identical text)', () => {
    it('uses skill.blink for the Sands of Silk body armour, keeping the level min', () => {
      _setStatEntriesForTests([BLINK_ENTRY, BLINK_RESERVATION_ENTRY])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 18 Blink'],
        itemClass: 'Body Armours',
      })
      expect(filters).toHaveLength(1)
      expect(filters[0].id).toBe('skill.blink')
      expect(filters[0].min).toBe(18)
    })

    it('uses skill.blink_reservation for an amulet, keeping the level min', () => {
      _setStatEntriesForTests([BLINK_ENTRY, BLINK_RESERVATION_ENTRY])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 20 Blink'],
        itemClass: 'Amulets',
      })
      expect(filters).toHaveLength(1)
      expect(filters[0].id).toBe('skill.blink_reservation')
      expect(filters[0].min).toBe(20)
    })

    it('pins the stat id regardless of stats-list ordering', () => {
      // Reservation entry seeded first: a text-only match would return it for
      // every class. The class table must still route the body armour to
      // skill.blink and the amulet to skill.blink_reservation.
      _setStatEntriesForTests([BLINK_RESERVATION_ENTRY, BLINK_ENTRY])
      const armour = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 18 Blink'],
        itemClass: 'Body Armours',
      })
      expect(armour[0].id).toBe('skill.blink')
      const amulet = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 20 Blink'],
        itemClass: 'Amulets',
      })
      expect(amulet[0].id).toBe('skill.blink_reservation')
    })

    it('falls back to skill.blink when item class is unknown', () => {
      _setStatEntriesForTests([BLINK_RESERVATION_ENTRY, BLINK_ENTRY])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 20 Blink'],
      })
      expect(filters[0].id).toBe('skill.blink')
    })
  })

  // Same dual-id collision shape as Blink, verified against live trade2 searches:
  // the amulet/boots get the "special" id, the staff/wand get the plain id.
  describe('Lightning Bolt class disambiguation', () => {
    const LIGHTNING_BOLT = { id: 'skill.lightning_bolt', text: 'Grants Skill: Level # Lightning Bolt', type: 'skill' }
    const BREACH_LIGHTNING_BOLT = {
      id: 'skill.unique_breach_lightning_bolt',
      text: 'Grants Skill: Level # Lightning Bolt',
      type: 'skill',
    }

    it('uses skill.unique_breach_lightning_bolt for Choir of the Storm (amulet)', () => {
      _setStatEntriesForTests([LIGHTNING_BOLT, BREACH_LIGHTNING_BOLT])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 13 Lightning Bolt'],
        itemClass: 'Amulets',
      })
      expect(filters[0].id).toBe('skill.unique_breach_lightning_bolt')
      expect(filters[0].min).toBe(13)
    })

    it('uses skill.lightning_bolt for a Voltaic Staff', () => {
      _setStatEntriesForTests([BREACH_LIGHTNING_BOLT, LIGHTNING_BOLT])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 13 Lightning Bolt'],
        itemClass: 'Staves',
      })
      expect(filters[0].id).toBe('skill.lightning_bolt')
    })
  })

  describe('Decompose class disambiguation', () => {
    const CORPSE_CLOUD = { id: 'skill.corpse_cloud', text: 'Grants Skill: Level # Decompose', type: 'skill' }
    const CORPSE_CLOUD_TRIGGERED = {
      id: 'skill.corpse_cloud_triggered',
      text: 'Grants Skill: Level # Decompose',
      type: 'skill',
    }

    it('uses skill.corpse_cloud_triggered for Corpsewade (boots)', () => {
      _setStatEntriesForTests([CORPSE_CLOUD, CORPSE_CLOUD_TRIGGERED])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 9 Decompose'],
        itemClass: 'Boots',
      })
      expect(filters[0].id).toBe('skill.corpse_cloud_triggered')
      expect(filters[0].min).toBe(9)
    })

    it('uses skill.corpse_cloud for an Acrid Wand', () => {
      _setStatEntriesForTests([CORPSE_CLOUD_TRIGGERED, CORPSE_CLOUD])
      const filters = buildGrantsSkillFilters({
        grantedSkills: ['Grants Skill: Level 9 Decompose'],
        itemClass: 'Wands',
      })
      expect(filters[0].id).toBe('skill.corpse_cloud')
    })
  })
})

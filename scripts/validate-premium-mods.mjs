#!/usr/bin/env node
/**
 * Validate src/shared/data/items/premium-mods.json against the JSON Schema
 * and run additional semantic checks.
 *
 * Usage:
 *   node scripts/validate-premium-mods.mjs
 *   node scripts/validate-premium-mods.mjs --require-verified
 *   node scripts/validate-premium-mods.mjs --require-verified --online
 *
 * Exports: validatePremiumMods(data, opts), checkStatIdsOnline(data)
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const Ajv = require('ajv')

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SCHEMA_PATH = join(root, 'src', 'shared', 'data', 'items', 'premium-mods.schema.json')
const DATA_PATH = join(root, 'src', 'shared', 'data', 'items', 'premium-mods.json')

// Mirrors getTradeUrls(1).stats / getTradeUrls(2).stats in src/shared/endpoints.ts
// (script cannot import TS); keep in sync if the trade host or paths move.
const TRADE_STATS_POE1 = 'https://www.pathofexile.com/api/trade/data/stats'
const TRADE_STATS_POE2 = 'https://www.pathofexile.com/api/trade2/data/stats'

let _validate = null

function getValidator() {
  if (_validate) return _validate
  const ajv = new Ajv({ allErrors: true })
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  _validate = ajv.compile(schema)
  return _validate
}

/**
 * Validate premium-mods data offline (schema + semantic checks).
 *
 * @param {object} data - Parsed premium-mods.json content
 * @param {{ requireVerified?: boolean }} opts
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validatePremiumMods(data, { requireVerified = false } = {}) {
  const errors = []
  const warnings = []

  // Schema validation
  const validate = getValidator()
  const schemaValid = validate(data)
  if (!schemaValid) {
    for (const err of validate.errors ?? []) {
      // ajv v8 uses instancePath; ajv v6 used dataPath
      const path = err.instancePath || err.dataPath || '(root)'
      errors.push(`Schema: ${path} ${err.message}`)
    }
  }

  // Semantic checks per game
  for (const game of ['poe1', 'poe2']) {
    const record = data[game]
    if (!record || typeof record !== 'object') continue

    for (const [name, entry] of Object.entries(record)) {
      if (Array.isArray(entry)) {
        // Legacy string[] entry
        warnings.push(`legacy text entry, migrate to v2 object: ${game}/${name}`)
        continue
      }

      if (typeof entry !== 'object' || entry === null) continue

      // requireVerified check
      if (requireVerified && entry.confidence !== 'verified') {
        errors.push(`${game}/${name}: confidence must be 'verified' (is '${entry.confidence}')`)
      }

      // Duplicate stat ids within one entry's mods
      if (Array.isArray(entry.mods)) {
        const seen = new Set()
        for (const mod of entry.mods) {
          if (mod && typeof mod.id === 'string') {
            if (seen.has(mod.id)) {
              errors.push(`${game}/${name}: duplicate mod id '${mod.id}'`)
            }
            seen.add(mod.id)
          }
        }
      }
    }
  }

  return { errors, warnings }
}

/**
 * Fetch trade stat ids from live PoE1 and PoE2 APIs and check that all
 * stat ids referenced in the data exist in the respective game's stats.
 *
 * Not run in CI (requires network). Used via --online CLI flag.
 *
 * @param {object} data - Parsed premium-mods.json content
 * @returns {Promise<{ errors: string[], warnings: string[] }>}
 */
export async function checkStatIdsOnline(data) {
  const errors = []
  const warnings = []

  async function fetchStatIds(url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Scalpel-PremiumMods',
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    const json = await res.json()
    const ids = new Set()
    for (const result of json.result ?? []) {
      for (const entry of result.entries ?? []) {
        if (entry.id) ids.add(entry.id)
      }
    }
    return ids
  }

  const results = await Promise.allSettled([
    fetchStatIds(TRADE_STATS_POE1),
    fetchStatIds(TRADE_STATS_POE2),
  ])

  const games = ['poe1', 'poe2']
  const gameStatsMap = {}
  for (let i = 0; i < games.length; i++) {
    const game = games[i]
    const result = results[i]
    if (result.status === 'rejected') {
      errors.push(`${game}: fetch failed - ${result.reason?.message ?? result.reason}`)
      gameStatsMap[game] = null
    } else {
      gameStatsMap[game] = result.value
    }
  }

  for (const game of games) {
    const record = data[game]
    if (!record || typeof record !== 'object') continue
    const knownIds = gameStatsMap[game]
    if (!knownIds) continue // fetch failed for this game

    for (const [name, entry] of Object.entries(record)) {
      if (Array.isArray(entry)) continue
      if (typeof entry !== 'object' || entry === null) continue

      if (Array.isArray(entry.mods)) {
        for (const mod of entry.mods) {
          if (mod && typeof mod.id === 'string' && !knownIds.has(mod.id)) {
            errors.push(`${game}/${name}: stat id '${mod.id}' not found in trade API`)
          }
        }
      }
    }
  }

  return { errors, warnings }
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const requireVerified = args.includes('--require-verified')
  const online = args.includes('--online')

  let data
  try {
    const raw = readFileSync(DATA_PATH, 'utf8')
    data = JSON.parse(raw)
  } catch (err) {
    console.error('Failed to read premium-mods.json:', err.message)
    process.exit(1)
  }

  const { errors, warnings } = validatePremiumMods(data, { requireVerified })

  let onlineErrors = []
  let onlineWarnings = []
  if (online) {
    try {
      const result = await checkStatIdsOnline(data)
      onlineErrors = result.errors
      onlineWarnings = result.warnings
    } catch (err) {
      console.error('Online check failed:', err.message)
      process.exit(1)
    }
  }

  const allErrors = [...errors, ...onlineErrors]
  const allWarnings = [...warnings, ...onlineWarnings]

  for (const w of allWarnings) {
    console.warn('WARN:', w)
  }
  for (const e of allErrors) {
    console.error('ERROR:', e)
  }

  if (allErrors.length === 0) {
    console.log(
      `OK: premium-mods.json is valid (${allWarnings.length} warning${allWarnings.length !== 1 ? 's' : ''})`,
    )
  } else {
    console.error(`FAIL: ${allErrors.length} error${allErrors.length !== 1 ? 's' : ''}`)
    process.exit(1)
  }
}

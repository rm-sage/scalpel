#!/usr/bin/env node
/**
 * Generate src/shared/data/items/premium-mods-manifest.json from the
 * bundled premium-mods.json.
 *
 * Curation flow: edit premium-mods.json -> run this script -> commit both files.
 *
 * Usage: node scripts/build-premium-mods-manifest.js
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

// Must equal PREMIUM_MODS_SCHEMA_VERSION in src/shared/data/items/premium-mods-types.ts
const SCHEMA_VERSION = 2

const DATA_DIR = path.join(__dirname, '..', 'src', 'shared', 'data', 'items')
const DATA_FILE = path.join(DATA_DIR, 'premium-mods.json')
const MANIFEST_FILE = path.join(DATA_DIR, 'premium-mods-manifest.json')

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

const raw = fs.readFileSync(DATA_FILE, 'utf8')

// Validate before hashing - a bad dataset must never receive a fresh manifest.
// Import is dynamic so the CJS script can load the ESM validator module.
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')
const validatorUrl = pathToFileURL(path.join(__dirname, 'validate-premium-mods.mjs')).href

;(async () => {
  const { validatePremiumMods } = await import(validatorUrl)
  const data = JSON.parse(raw)
  const { errors, warnings } = validatePremiumMods(data)

  for (const w of warnings) {
    console.warn('WARN:', w)
  }
  if (errors.length > 0) {
    for (const e of errors) {
      console.error('ERROR:', e)
    }
    console.error('Aborting: premium-mods.json failed validation.')
    process.exit(1)
  }

  const hash = sha256(raw)
  const manifest = { schemaVersion: SCHEMA_VERSION, hash, generatedAt: new Date().toISOString() }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log('Wrote', MANIFEST_FILE)
  console.log('hash:', hash)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})

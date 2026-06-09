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
const SCHEMA_VERSION = 1

const DATA_DIR = path.join(__dirname, '..', 'src', 'shared', 'data', 'items')
const DATA_FILE = path.join(DATA_DIR, 'premium-mods.json')
const MANIFEST_FILE = path.join(DATA_DIR, 'premium-mods-manifest.json')

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

const raw = fs.readFileSync(DATA_FILE, 'utf8')
const hash = sha256(raw)
const manifest = { schemaVersion: SCHEMA_VERSION, hash, generatedAt: new Date().toISOString() }

fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('Wrote', MANIFEST_FILE)
console.log('hash:', hash)

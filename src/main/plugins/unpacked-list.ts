import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { unpackedJsonPath } from './paths'

/** Read the list of side-loaded (unpacked) plugin ids from userData/plugins/unpacked.json.
 *  Returns [] when the file is missing, unparseable, or not a JSON array.
 *  Non-string entries are filtered. */
export function readUnpackedIds(): string[] {
  const p = unpackedJsonPath()
  if (!existsSync(p)) return []
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8'))
    if (!Array.isArray(raw)) return []
    return raw.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

/** Write the list of unpacked plugin ids. Creates the parent directory if needed. */
export function writeUnpackedIds(ids: string[]): void {
  const p = unpackedJsonPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(ids))
}

/** Add an id if not already present. Returns true if the list was modified. */
export function addUnpackedId(id: string): boolean {
  const ids = readUnpackedIds()
  if (ids.includes(id)) return false
  ids.push(id)
  writeUnpackedIds(ids)
  return true
}

/** Remove an id if present. Returns true if the list was modified. */
export function removeUnpackedId(id: string): boolean {
  const ids = readUnpackedIds()
  const next = ids.filter((x) => x !== id)
  if (next.length === ids.length) return false
  writeUnpackedIds(next)
  return true
}

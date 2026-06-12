// Strip the |option suffix from a flattened stat id.
export function baseId(id: string): string {
  const i = id.indexOf('|')
  return i === -1 ? id : id.slice(0, i)
}

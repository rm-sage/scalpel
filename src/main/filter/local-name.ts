/**
 * Rewrite a filter's `#name:` header to the local copy's name.
 *
 * Scalpel imports an online filter into a `<name>-local.filter` copy and rewrites
 * the `#name:` header to that local name so PoE recognises it as a distinct local
 * filter. The same rewrite must be re-applied whenever sync overwrites the local
 * copy with upstream content, otherwise the header reverts to the online name.
 *
 * No-op when the content has no `#name:` line. Only the first `#name:` line (the
 * header) is rewritten. The local name is inserted literally (a replacer function
 * avoids `$`-pattern interpretation). Line endings are preserved because `.` does
 * not match `\r`/`\n`, so the trailing CR/LF is left intact.
 */
export function applyLocalNameHeader(content: string, localFileName: string): string {
  return content.replace(/^#name:.+$/m, () => `#name: ${localFileName}`)
}

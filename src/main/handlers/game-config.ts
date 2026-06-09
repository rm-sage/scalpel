import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { app, ipcMain } from 'electron'
import type { IpcMainEvent, WebContents } from 'electron'
import { readGameConfig, resolveGameConfigPath, writeGameConfig } from '../game-config'
import { getPoeVersion } from '../game-state'

const backedUp = new Set<string>()
const subscribers = new Set<WebContents>()
let watcher: FSWatcher | null = null
let debounce: NodeJS.Timeout | null = null
/** Suppress the change notification our own write triggers. */
let ignoreChangesUntil = 0

function currentPath(): string {
  return resolveGameConfigPath(getPoeVersion(), app.getPath('documents'))
}

function emitChange(): void {
  if (Date.now() < ignoreChangesUntil) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    for (const wc of subscribers) {
      if (!wc.isDestroyed()) wc.send('plugins:game-config-changed')
    }
  }, 150)
}

function startWatching(): void {
  if (watcher) return
  watcher = watch(currentPath(), emitChange)
}

function removeSubscriber(wc: WebContents): void {
  if (!subscribers.delete(wc)) return
  if (subscribers.size === 0) {
    watcher?.close()
    watcher = null
    if (debounce) {
      clearTimeout(debounce)
      debounce = null
    }
  }
}

export function registerGameConfigHandlers(): void {
  ipcMain.handle('plugins:game-config-read', async () => {
    const path = currentPath()
    return { content: await readGameConfig(path), path }
  })

  ipcMain.handle('plugins:game-config-write', async (_evt, content: string) => {
    if (typeof content !== 'string') throw new Error('game-config write expects a string')
    const result = await writeGameConfig(currentPath(), content, { backedUp, now: () => Date.now() })
    ignoreChangesUntil = Date.now() + 500
    return result
  })

  ipcMain.on('plugins:game-config-watch', (evt: IpcMainEvent) => {
    const wc = evt.sender
    if (subscribers.has(wc)) return
    subscribers.add(wc)
    wc.once('destroyed', () => removeSubscriber(wc))
    startWatching()
  })

  ipcMain.on('plugins:game-config-unwatch', (evt: IpcMainEvent) => {
    removeSubscriber(evt.sender)
  })
}

import { afterEach, describe, expect, it } from 'vitest'
import { _resetForTests, getRegisteredPluginTabs, removePluginTab, setPluginTab } from './tab-registry'

afterEach(() => _resetForTests())

describe('tab-registry', () => {
  it('stores label and icon by plugin id', () => {
    setPluginTab('acme.tool', 'Acme', '<svg/>')
    expect(getRegisteredPluginTabs().get('acme.tool')).toEqual({ label: 'Acme', icon: '<svg/>' })
  })

  it('overwrites an existing registration for the same id', () => {
    setPluginTab('acme.tool', 'Acme', '<svg/>')
    setPluginTab('acme.tool', 'Acme 2', '<rect/>')
    expect(getRegisteredPluginTabs().get('acme.tool')).toEqual({ label: 'Acme 2', icon: '<rect/>' })
  })

  it('removes a registration', () => {
    setPluginTab('acme.tool', 'Acme', '<svg/>')
    removePluginTab('acme.tool')
    expect(getRegisteredPluginTabs().has('acme.tool')).toBe(false)
  })
})

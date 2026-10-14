import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake service worker answering the DE endpoints.
function stub(handler) {
  const calls = []
  vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage(msg, cb) {
    calls.push(msg.url)
    Promise.resolve(handler(msg.url)).then((data) => cb(data instanceof Error ? { error: data.message } : { data }))
  } } })
  return calls
}

async function load() {
  vi.resetModules()
  return import('../deApi.js')
}

describe('deApi', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('lists Shared and Synchronized DEs first, deduped, with a corrected total', async () => {
    stub((url) => {
      if (url.includes('/folder?$where=')) return { entry: [{ id: '10', type: 'shared_data', parentId: '0' }] }
      if (url.includes('/children')) return { entry: [] }
      if (url.includes('category/10?')) return { count: 1, items: [{ id: 'S', name: 'Shared Orders' }] }
      if (url.includes('category/0?')) return { count: 40, items: [{ id: 'S', name: 'Shared Orders' }, { id: 'L', name: 'Local Orders', customerKey: 'LK', categoryId: 5 }] }
      return {}
    })
    const { searchDataExtensions } = await load()
    const r = await searchDataExtensions('s10', 'orders')
    expect(r.items.map((d) => [d.id, d.sourceType])).toEqual([['S', 'shared'], ['L', null]])
    expect(r.items[1]).toMatchObject({ customerKey: 'LK', categoryId: 5 })
    expect(r.total).toBe(40)
  })

  it('builds a folder path and caches folders', async () => {
    const calls = stub((url) => {
      const id = url.match(/folder\/(\d+)/)[1]
      return { 3: { name: 'Sub', parentId: '2' }, 2: { name: 'Top', parentId: '1' }, 1: { name: 'Data Extensions', parentId: '0' } }[id]
    })
    const { fetchDEFolderPath } = await load()
    expect(await fetchDEFolderPath('s10', 3)).toBe('Data Extensions > Top > Sub')
    expect(await fetchDEFolderPath('s10', 2)).toBe('Data Extensions > Top')
    expect(calls).toHaveLength(3)
  })

  it('sorts fields with primary keys first and retries after a failure', async () => {
    let fail = true
    stub(() => (fail ? new Error('boom') : { fields: [{ name: 'b', ordinal: 2 }, { name: 'a', ordinal: 1 }, { name: 'pk', ordinal: 3, isPrimaryKey: true }] }))
    const { fetchDEFieldList } = await load()
    await expect(fetchDEFieldList('s10', 'X')).rejects.toThrow('boom')
    fail = false
    expect((await fetchDEFieldList('s10', 'X')).map((f) => f.name)).toEqual(['pk', 'a', 'b'])
  })

  it('recognises system DEs', async () => {
    const { isSystemDE } = await load()
    expect(isSystemDE('QueryStudioResults_123')).toBe(true)
    expect(isSystemDE('Customers')).toBe(false)
  })
})

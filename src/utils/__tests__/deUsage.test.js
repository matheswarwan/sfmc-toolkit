import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tablesInSql, matchQuery, buildActivityIndex } from '../deUsage.js'

const names = (sql) => tablesInSql(sql).map((t) => t.name).sort()

describe('tablesInSql', () => {
  it('finds FROM and JOIN tables, brackets and aliases', () => {
    expect(names('SELECT a.Id FROM [My Orders] a INNER JOIN Customers c ON c.Id = a.Id')).toEqual(['Customers', 'My Orders'])
  })

  it('finds tables in subqueries and comma joins', () => {
    expect(names('SELECT Id FROM A WHERE Id IN (SELECT Id FROM [Sub DE])')).toEqual(['A', 'Sub DE'])
    expect(names('SELECT x.Id FROM A x, B y WHERE x.Id = y.Id')).toEqual(['A', 'B'])
  })

  it('marks ENT. references', () => {
    expect(tablesInSql('SELECT * FROM ENT.[Shared One] s JOIN Local l ON 1=1')).toEqual(
      expect.arrayContaining([{ name: 'Shared One', ent: true }, { name: 'Local', ent: false }]))
    expect(tablesInSql('SELECT * FROM [ENT].Shared2')[0]).toEqual({ name: 'Shared2', ent: true })
  })

  it('ignores comments and string literals', () => {
    expect(names("SELECT 'FROM Fake' AS t FROM Real -- JOIN Old\n/* FROM Gone */")).toEqual(['Real'])
  })

  it('does not match a longer name', () => {
    expect(names('SELECT * FROM Orders_Archive')).toEqual(['Orders_Archive'])
  })
})

describe('matchQuery', () => {
  const de = { id: 'DE-1', name: 'Orders', customerKey: 'ORD_KEY' }

  it('writes when the target key or id matches', () => {
    expect(matchQuery({ targetKey: 'ord_key', queryText: 'SELECT 1 FROM X' }, de)).toEqual({ writes: true, reads: false, viaEnt: false })
    expect(matchQuery({ targetId: 'de-1', queryText: '' }, de)?.writes).toBe(true)
  })

  it('does not count a same-named target with a different key', () => {
    expect(matchQuery({ targetKey: 'OTHER', targetName: 'Orders', queryText: 'SELECT 1 FROM X' }, de)).toBeNull()
  })

  it('falls back to the target name when the query has no key or id', () => {
    expect(matchQuery({ targetName: 'orders', queryText: '' }, de)?.writes).toBe(true)
  })

  it('reads by name, case-insensitive, and not on a longer name', () => {
    expect(matchQuery({ targetKey: 'T', queryText: 'select * from orders o' }, de)).toEqual({ writes: false, reads: true, viaEnt: false })
    expect(matchQuery({ targetKey: 'T', queryText: 'SELECT * FROM ENT.Orders' }, de)?.viaEnt).toBe(true)
    expect(matchQuery({ targetKey: 'T', queryText: 'SELECT * FROM Orders_Archive' }, de)).toBeNull()
  })
})

describe('buildActivityIndex', () => {
  it('indexes Query activities by object id with their step', () => {
    const index = buildActivityIndex([
      { id: 'A1', steps: [{ step: 1, name: 'Load', activities: [{ objectTypeId: 300, activityObjectId: 'Q-1' }, { objectTypeId: 423, activityObjectId: 'S-1' }] },
        { step: 2, activities: [{ objectTypeId: 300, activityObjectId: 'q-2' }] }] },
      { id: 'A2', steps: [{ activities: [{ objectTypeId: '300', activityObjectId: 'Q-1' }] }] },
    ])
    expect(index.get('q-1')).toEqual([{ automationId: 'A1', step: 1, stepName: 'Load' }, { automationId: 'A2', step: 1, stepName: '' }])
    expect(index.get('q-2')).toEqual([{ automationId: 'A1', step: 2, stepName: '' }])
    expect(index.has('s-1')).toBe(false)
  })
})

describe('findDEUsage', () => {
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
    return import('../deUsage.js')
  }
  const de = { id: 'DE-1', name: 'Orders', customerKey: 'ORD' }
  const queries = [
    { queryDefinitionId: 'Q1', name: 'Build orders', targetKey: 'ORD', targetUpdateTypeName: 'Overwrite', queryText: 'SELECT * FROM Raw' },
    { queryDefinitionId: 'Q2', name: 'Use orders', targetKey: 'X', queryText: 'SELECT * FROM Orders' },
    { queryDefinitionId: 'Q3', name: 'Other', targetKey: 'Y', queryText: 'SELECT * FROM Else' },
    { queryDefinitionId: 'Q4', name: 'No text in list', targetKey: 'Z' },
  ]
  const handler = (url) => {
    if (url.includes('/automation/v1/queries/?')) return { count: 4, items: queries.map((q) => ({ ...q })) }
    if (url.includes('/automation/v1/queries/Q4')) return { queryText: 'SELECT * FROM [Orders]' }
    if (url.includes('/automation/definition/')) return { totalResults: 2, entry: [{ id: 'A1', name: 'Nightly', status: 'Scheduled' }, { id: 'A2', name: 'Broken' }] }
    if (url.endsWith('/automations/A1')) return { id: 'A1', steps: [{ step: 1, activities: [{ objectTypeId: 300, activityObjectId: 'Q1' }] }, { step: 2, activities: [{ objectTypeId: 300, activityObjectId: 'Q2' }] }] }
    if (url.endsWith('/automations/A2')) return new Error('SFMC API error 500')
    return {}
  }

  beforeEach(() => vi.unstubAllGlobals())

  it('finds writers and readers, maps them to automations and reports each stage', async () => {
    stub(handler)
    const { findDEUsage } = await load()
    const seen = {}
    const r = await findDEUsage('s7', de, { onStage: (id, s) => { seen[id] = s.state } })
    expect(r.matches.map((m) => [m.query.queryDefinitionId, m.writes, m.reads])).toEqual([['Q1', true, false], ['Q2', false, true], ['Q4', false, true]])
    expect(r.matches[0].automations).toEqual([{ automationId: 'A1', step: 1, stepName: '', name: 'Nightly', status: 'Scheduled', lastRunTime: null, lastRunStatus: '' }])
    expect(r.matches[2].automations).toEqual([])
    expect(r.automationErrors).toBe(1)
    expect(seen).toEqual({ queries: 'done', match: 'done', automations: 'done', steps: 'done' })
  })

  it('reuses the cache for the next DE and skips automations with no match', async () => {
    const calls = stub(handler)
    const { findDEUsage } = await load()
    await findDEUsage('s7', de)
    const before = calls.length
    const seen = {}
    const r = await findDEUsage('s7', { id: 'N', name: 'Nothing', customerKey: 'N' }, { onStage: (id, s) => { seen[id] = s.state } })
    expect(calls.length).toBe(before)
    expect(r.matches).toEqual([])
    expect(seen).toEqual({ queries: 'cached', match: 'done', automations: 'skipped', steps: 'skipped' })
  })

  it('stops when asked', async () => {
    stub(handler)
    const { findDEUsage } = await load()
    await expect(findDEUsage('s7', de, { shouldStop: () => true })).rejects.toMatchObject({ stopped: true })
  })
})

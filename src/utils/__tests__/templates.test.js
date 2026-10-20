import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orphanContacts } from '../templates/orphanContacts.js'
import { dataViewArchive, archiveFields } from '../templates/dataViewArchive.js'

describe('Orphan contacts template', () => {
  const o = { ...orphanContacts.defaults }

  it('plans the pending DE (sendable), both checks in order, archive last', () => {
    const p = orphanContacts.plan(o)
    expect(p.des.map((d) => d.name)).toEqual(['Contact Deletion Pending', 'Contact Deletion Archive'])
    expect(p.des[0]).toMatchObject({ key: 'contact-deletion-pending-de', sendableField: 'SubscriberKey' })
    expect(p.queries.map((q) => [q.ref, q.updateType, q.target])).toEqual([['leadsUsers', 0, 'pending'], ['contacts', 1, 'pending'], ['archive', 1, 'archive']])
    expect(p.automation.steps.map((s) => s.queries)).toEqual([['leadsUsers'], ['contacts'], ['archive']])
  })

  it('reads the list by name and only flags CRM IDs', () => {
    const p = orphanContacts.plan({ ...o, listName: 'My List' })
    expect(p.queries[0].sql).toContain('FROM [My List] AS contact')
    expect(p.queries[0].sql).toMatch(/LIKE '005%' AND sfUser\.Id IS NULL/)
    expect(p.queries[0].sql).toMatch(/LIKE '00Q%' AND lead\.Id IS NULL/)
    expect(p.queries[1].sql).toMatch(/LIKE '003%' AND crm\.Id IS NULL/)
  })

  it('a single check overwrites; no check is refused', () => {
    const p = orphanContacts.plan({ ...o, checkLeadsUsers: false, archive: false })
    expect(p.queries.map((q) => [q.ref, q.updateType])).toEqual([['contacts', 0]])
    expect(() => orphanContacts.plan({ ...o, checkLeadsUsers: false, checkContacts: false })).toThrow('Pick at least one check')
  })
})

describe('Data view archive template', () => {
  it('keys each archive DE on the event and copies the last N days with Update', () => {
    const p = dataViewArchive.plan({ ...dataViewArchive.defaults, views: ['_Sent', '_Click', '_Job'], days: 5 })
    expect(p.des.map((d) => d.name)).toEqual(['Archive_Sent', 'Archive_Click', 'Archive_Job'])
    const keys = (name) => p.des.find((d) => d.name === name).fields.filter((f) => f.isPrimaryKey).map((f) => f.name)
    expect(keys('Archive_Sent')).toEqual(['JobID', 'ListID', 'BatchID', 'SubscriberID', 'EventDate'])
    expect(keys('Archive_Click')).toContain('LinkName')
    expect(keys('Archive_Job')).toEqual(['JobID'])
    expect(p.queries.every((q) => q.updateType === 1)).toBe(true)
    expect(p.queries[0].sql).toContain('WHERE EventDate >= DATEADD(day, -5, GETDATE())')
    expect(p.queries[1].sql).toContain("LEFT(ISNULL(LinkName, ''), 500) AS LinkName")
    expect(p.queries[2].sql).toContain('WHERE CreatedDate >=')
    expect(p.automation.steps).toHaveLength(1)
  })

  it('maps data view types and keeps key fields not nullable', () => {
    const f = Object.fromEntries(archiveFields('_Open').map((x) => [x.name, x]))
    expect(f.EventDate).toMatchObject({ type: 'date', isPrimaryKey: true, isNullable: false })
    expect(f.IsUnique).toMatchObject({ type: 'boolean', isNullable: true })
    expect(f.SubscriberKey).toMatchObject({ type: 'text', length: 254 })
  })
})

describe('createFromPlan', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  function stub(handler) {
    const calls = []
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage(msg, cb) {
      calls.push(msg)
      Promise.resolve(handler(msg)).then((data) => cb(data instanceof Error ? { error: data.message } : { data }))
    } } })
    return calls
  }
  const answer = (msg) => {
    if (msg.url.includes('/folder?')) return { entry: [{ id: '100', name: 'Data Extensions', type: 'dataextension' }] }
    if (msg.url.includes('/folders/?')) return { items: [{ categoryId: 7, name: 'Query', parentId: 0 }] }
    if (msg.url.endsWith('/customobjects/')) return { id: `de-${msg.body.name}`, customerKey: msg.body.customerKey }
    if (msg.url.endsWith('/automation/v1/queries')) return { queryDefinitionId: `q-${msg.body.name}` }
    if (msg.url.endsWith('/automation/v1/automations')) return { id: 'auto-1' }
    return {}
  }

  it('creates DEs, queries and an unscheduled automation wired together', async () => {
    const calls = stub(answer)
    const { createFromPlan } = await import('../templates/index.js')
    const plan = orphanContacts.plan({ ...orphanContacts.defaults, archive: false })
    const r = await createFromPlan('s13', plan)
    expect(r.failed).toBeNull()
    expect(r.created.map((c) => c.kind)).toEqual(['de', 'query', 'query', 'automation'])
    const de = calls.find((c) => c.url.endsWith('/customobjects/')).body
    expect(de).toMatchObject({ isSendable: true, sendableCustomObjectField: 'SubscriberKey', categoryID: 100, customerKey: 'contact-deletion-pending-de' })
    const qs = calls.filter((c) => c.url.endsWith('/automation/v1/queries')).map((c) => c.body)
    expect(qs.map((q) => [q.targetUpdateTypeName, q.targetId, q.categoryId])).toEqual([['Overwrite', 'de-Contact Deletion Pending', 7], ['Update', 'de-Contact Deletion Pending', 7]])
    const auto = calls.find((c) => c.url.endsWith('/automation/v1/automations')).body
    expect(auto.steps.map((s) => s.activities.map((a) => a.activityObjectId))).toEqual([[`q-${qs[0].name}`], [`q-${qs[1].name}`]])
    expect(auto.schedule).toBeUndefined()
    expect(calls.some((c) => /start|run/i.test(c.url.split('/fuelapi')[1] || ''))).toBe(false)
  })

  it('stops at the first failure and reports what was created', async () => {
    stub((msg) => (msg.url.endsWith('/automation/v1/queries') ? new Error('SFMC API error 400: invalid object name AllContactsList') : answer(msg)))
    const { createFromPlan } = await import('../templates/index.js')
    const r = await createFromPlan('s13', orphanContacts.plan(orphanContacts.defaults))
    expect(r.created.map((c) => c.kind)).toEqual(['de', 'de'])
    expect(r.failed).toMatchObject({ kind: 'query', status: 'failed' })
    expect(r.failed.error).toContain('AllContactsList')
  })

  it('creates a non-sendable DE when SFMC refuses the sendable settings', async () => {
    let first = true
    stub((msg) => {
      if (msg.url.endsWith('/customobjects/') && msg.body.isSendable && first) { first = false; return new Error('SFMC API error 400: sendable relationship invalid') }
      return answer(msg)
    })
    const { createFromPlan } = await import('../templates/index.js')
    const r = await createFromPlan('s13', orphanContacts.plan({ ...orphanContacts.defaults, archive: false, checkContacts: false }))
    expect(r.created[0].note).toMatch(/not sendable/)
  })
})

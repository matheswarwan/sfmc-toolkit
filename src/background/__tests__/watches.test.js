import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetched = []
let status = 6
vi.mock('../fetchProxy.js', () => ({
  sfmcFetch: async ({ url }) => { fetched.push(url); return { name: 'Daily load', status, lastRunTime: '2026-10-19T10:00:00', lastRunStatus: 'Complete' } },
}))

function fakeChrome() {
  const data = {}
  const badge = []
  globalThis.chrome = {
    runtime: { lastError: undefined, getURL: (p) => p },
    storage: { local: {
      get: (keys, cb) => cb(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((k) => k in data).map((k) => [k, structuredClone(data[k])]))),
      set: async (obj) => { Object.assign(data, structuredClone(obj)) },
    } },
    action: { setBadgeText: async (o) => badge.push(o.text), setBadgeBackgroundColor: async () => {} },
  }
  return { data, badge }
}

describe('checkWatches (feedback #50)', () => {
  beforeEach(() => { vi.resetModules(); fetched.length = 0; status = 6 })

  it('records a baseline, then turns a pause into a notice and a badge', async () => {
    const { data, badge } = fakeChrome()
    data.toolkit_watches = { 's4:A1': { stack: 's4', id: 'A1', name: 'Daily load', on: { paused: true, activated: true, runs: false, fails: true }, last: null } }
    const { checkWatches } = await import('../watches.js')
    expect(await checkWatches('s4', { force: true })).toEqual({ checked: 1, notices: 0 })
    expect(data.toolkit_watches['s4:A1'].last.statusName).toBe('Scheduled')
    status = 4
    expect(await checkWatches('s4', { force: true })).toEqual({ checked: 1, notices: 1 })
    expect(data.toolkit_watch_notices[0]).toMatchObject({ kind: 'paused', name: 'Daily load', read: false })
    expect(badge.at(-1)).toBe('1')
    expect(fetched[0]).toBe('https://mc.s4.marketingcloudapps.com/AutomationStudioFuel3/fuelapi/automation/v1/automations/A1')
  })

  it('waits 15 minutes between page-load checks and ignores other stacks', async () => {
    const { data } = fakeChrome()
    data.toolkit_watches = { 's4:A1': { stack: 's4', id: 'A1', name: 'x', on: {}, last: null } }
    const { checkWatches } = await import('../watches.js')
    await checkWatches('s4')
    expect(await checkWatches('s4')).toEqual({ checked: 0, notices: 0 })
    expect(await checkWatches('s7', { force: true })).toEqual({ checked: 0, notices: 0 })
    expect(fetched).toHaveLength(1)
  })
})

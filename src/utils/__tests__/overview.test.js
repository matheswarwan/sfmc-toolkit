import { describe, it, expect, vi, beforeEach } from 'vitest'
import { summarizeAutomations, summarizeJourneys } from '../overview.js'

describe('overviews (feedback #50)', () => {
  it('counts automations by status and lists what needs a look', () => {
    const now = Date.parse('2026-10-20T12:00:00Z')
    const s = summarizeAutomations([
      { id: 'a', name: 'A', status: 6, lastRunStatus: 'Complete', lastRunTime: '2026-10-20T10:00:00Z' },
      { id: 'b', name: 'B', status: 'Scheduled', lastRunStatus: 'Error', lastRunTime: '2026-10-20T09:00:00Z' },
      { id: 'c', name: 'C', status: 4 },
      { id: 'd', name: 'D', status: 3, lastRunTime: '2026-10-19T12:00:00Z' },
    ], now)
    expect(s.total).toBe(4)
    expect(s.byStatus).toEqual([{ label: 'Scheduled', count: 2 }, { label: 'Paused', count: 1 }, { label: 'Running', count: 1 }])
    expect(s.failedLastRun).toBe(1)
    expect(s.attention.map((x) => [x.automation.id, x.reason])).toEqual([['b', 'Last run: Error'], ['d', 'Running for more than 6 hours']])
  })
  it('counts journeys and live ones', () => {
    const s = summarizeJourneys([{ status: 'Published' }, { status: 'Draft' }, { status: 'Published' }, { status: 'Stopped' }])
    expect(s).toMatchObject({ total: 4, live: 2 })
    expect(s.byStatus[0]).toEqual({ label: 'Published', count: 2 })
  })
})

describe('run trends and journey channels', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

  it('adds up runs per day and failures per automation', async () => {
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage(msg, cb) {
      if (msg.url.includes('definition_id=A')) return cb({ data: { entry: [
        { startTime: '2026-10-20T08:00:00Z', status: 'Complete' }, { startTime: '2026-10-19T08:00:00Z', status: 'Error' }] } })
      if (msg.url.includes('definition_id=B')) return cb({ error: 'SFMC API error 500' })
      cb({ data: {} })
    } } })
    const { runTrends } = await import('../overview.js')
    const now = Date.parse('2026-10-20T12:00:00Z')
    const r = await runTrends('s4', [
      { id: 'A', name: 'A', lastRunTime: '2026-10-20T08:00:00Z' }, { id: 'B', name: 'B', lastRunTime: '2026-10-19T08:00:00Z' }, { id: 'C', name: 'Old', lastRunTime: '2025-01-01' },
    ], { days: 7, now })
    expect(r.read).toBe(2)
    expect(r.errors).toBe(1)
    expect(r.days.find((d) => d.key === '2026-10-19')).toEqual({ key: '2026-10-19', ok: 0, failed: 1 })
    expect(r.days.find((d) => d.key === '2026-10-20')).toEqual({ key: '2026-10-20', ok: 1, failed: 0 })
    expect(r.perAutomation[0]).toMatchObject({ runs: 2, failed: 1 })
  })

  it('finds which live journeys send email, SMS or push', async () => {
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage(msg, cb) {
      if (msg.url.includes('/interactions/j1')) return cb({ data: { activities: [{ type: 'EMAILV2', name: 'Welcome' }, { type: 'WAIT' }, { type: 'SMSSYNC', name: 'Text' }] } })
      if (msg.url.includes('/interactions/j2')) return cb({ data: { activities: [{ type: 'PUSHNOTIFICATIONACTIVITY', name: 'Push' }] } })
      cb({ data: {} })
    } } })
    const { journeyChannels } = await import('../overview.js')
    const r = await journeyChannels('s4', [{ id: 'j1', name: 'One', status: 'Published' }, { id: 'j2', name: 'Two', status: 'Published' }, { id: 'j3', name: 'Draft', status: 'Draft' }])
    expect(r.checked).toBe(2)
    expect(r.sendingEmail).toBe(1)
    expect(r.rows[0]).toMatchObject({ email: ['Welcome'], sms: ['Text'] })
    expect(r.rows[1].push).toEqual(['Push'])
  })
})

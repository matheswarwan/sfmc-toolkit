import { describe, it, expect } from 'vitest'
import { diffAutomation, automationStatusName, addNotices, unreadCount, DEFAULT_ON } from '../watches.js'

describe('watched automations (feedback #50)', () => {
  it('names SFMC status codes and keeps names it does not know', () => {
    expect(automationStatusName(4)).toBe('Paused')
    expect(automationStatusName('6')).toBe('Scheduled')
    expect(automationStatusName(-1)).toBe('Error')
    expect(automationStatusName('Running')).toBe('Running')
    expect(automationStatusName(null)).toBe('')
  })
  it('notices pausing, activation, failed runs; runs only when asked; nothing on the first look', () => {
    const prev = { status: 6, lastRunTime: '2026-10-19T10:00:00', lastRunStatus: 'Complete' }
    expect(diffAutomation(null, prev)).toEqual([])
    expect(diffAutomation(prev, { ...prev, status: 4 }).map((c) => c.kind)).toEqual(['paused'])
    expect(diffAutomation({ ...prev, status: 4 }, prev).map((c) => c.kind)).toEqual(['activated'])
    const ran = { ...prev, lastRunTime: '2026-10-20T10:00:00', lastRunStatus: 'Complete' }
    expect(diffAutomation(prev, ran)).toEqual([])
    expect(diffAutomation(prev, ran, { ...DEFAULT_ON, runs: true }).map((c) => c.kind)).toEqual(['runs'])
    expect(diffAutomation(prev, { ...ran, lastRunStatus: 'Error' }).map((c) => [c.kind, c.text])).toEqual([['fails', 'run failed (Error)']])
    expect(diffAutomation(prev, { ...ran, lastRunStatus: 'Error' }, { ...DEFAULT_ON, fails: false })).toEqual([])
  })
  it('keeps notices newest first and counts unread', () => {
    const w = { stack: 's4', id: 'A1', name: 'Daily' }
    let list = addNotices([], w, [{ kind: 'paused', text: 'is now Paused' }], 1)
    list = addNotices(list, w, [{ kind: 'fails', text: 'run failed' }], 2)
    expect(list.map((n) => n.kind)).toEqual(['fails', 'paused'])
    expect(unreadCount(list)).toBe(2)
    expect(unreadCount([{ ...list[0], read: true }, list[1]])).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { collectFeedbackMetadata, metadataLines } from '../feedbackMeta.js'

describe('feedback metadata', () => {
  it('collects only technical details', () => {
    const m = collectFeedbackMetadata({ route: '/journeys/j1', stack: 's10', businessUnit: 'Acme', theme: 'dark',
      apiErrors: [{ method: 'GET', path: 'jbinteractions.s10.marketingcloudapps.com/fuelapi/x', status: 401, error: 'no' }], now: new Date('2026-10-14T00:00:00Z') })
    expect(m).toMatchObject({ section: '/journeys/j1', stack: 's10', businessUnit: 'Acme', theme: 'dark', time: '2026-10-14T00:00:00.000Z' })
    expect(Object.keys(m)).toEqual(['appVersion', 'section', 'stack', 'businessUnit', 'theme', 'browser', 'language', 'window', 'screen', 'time', 'recentApiErrors', 'recentApiCalls'])
    const lines = Object.fromEntries(metadataLines(m))
    expect(lines['App Version']).toBe('unknown')
    expect(lines['API error 1']).toBe('GET jbinteractions.s10.marketingcloudapps.com/fuelapi/x (401): no')
  })
  it('lists recent API calls with status, time and counts', () => {
    const m = collectFeedbackMetadata({ apiCalls: [
      { method: 'GET', path: 'x/automations?$top=50&$skip=50', status: 200, ms: 120, items: 0, total: 80 },
      { method: 'GET', path: 'x/filters', status: 400, ms: 30, error: 'Order field is invalid' },
    ] })
    const lines = Object.fromEntries(metadataLines(m))
    expect(lines['API call 1']).toBe('GET x/automations?$top=50&$skip=50 (200, 120 ms) 0 items, total 80')
    expect(lines['API call 2']).toBe('GET x/filters (400, 30 ms) failed: Order field is invalid')
  })
  it('says when there were no API errors', () => {
    expect(Object.fromEntries(metadataLines(collectFeedbackMetadata({})))['Recent API errors']).toBe('none')
  })
})

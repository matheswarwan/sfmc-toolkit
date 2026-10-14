import { describe, it, expect } from 'vitest'
import { collectFeedbackMetadata, metadataLines } from '../feedbackMeta.js'

describe('feedback metadata', () => {
  it('collects only technical details', () => {
    const m = collectFeedbackMetadata({ route: '/journeys/j1', stack: 's10', businessUnit: 'Acme', theme: 'dark',
      apiErrors: [{ method: 'GET', path: 'jbinteractions.s10.marketingcloudapps.com/fuelapi/x', status: 401, error: 'no' }], now: new Date('2026-10-14T00:00:00Z') })
    expect(m).toMatchObject({ section: '/journeys/j1', stack: 's10', businessUnit: 'Acme', theme: 'dark', time: '2026-10-14T00:00:00.000Z' })
    expect(Object.keys(m)).toEqual(['appVersion', 'section', 'stack', 'businessUnit', 'theme', 'browser', 'language', 'window', 'screen', 'time', 'recentApiErrors'])
    const lines = Object.fromEntries(metadataLines(m))
    expect(lines['App Version']).toBe('unknown')
    expect(lines['API error 1']).toBe('GET jbinteractions.s10.marketingcloudapps.com/fuelapi/x (401): no')
  })
  it('says when there were no API errors', () => {
    expect(Object.fromEntries(metadataLines(collectFeedbackMetadata({})))['Recent API errors']).toBe('none')
  })
})

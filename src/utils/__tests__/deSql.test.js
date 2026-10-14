import { describe, it, expect } from 'vitest'
import { buildDESelect } from '../deSql.js'
import { sqlName } from '../format.js'

describe('buildDESelect', () => {
  it('returns nothing when no field is ticked', () => {
    expect(buildDESelect([])).toBe('')
    expect(buildDESelect([{ de: 'A', fields: [] }])).toBe('')
  })

  it('selects from one DE without aliases', () => {
    expect(buildDESelect([{ de: 'My DE', fields: ['Email', 'First Name'] }]))
      .toBe('SELECT\n    Email,\n    [First Name]\nFROM [My DE]')
  })

  it('joins on a shared column name, case-insensitively', () => {
    expect(buildDESelect([
      { de: 'Subscribers', fields: ['SubscriberKey', 'Email'] },
      { de: 'Orders', fields: ['OrderId', 'subscriberkey'] },
    ])).toBe('SELECT\n    t1.SubscriberKey,\n    t1.Email,\n    t2.OrderId,\n    t2.subscriberkey\nFROM Subscribers t1\nINNER JOIN Orders t2\n    ON t1.SubscriberKey = t2.subscriberkey')
  })

  it('flags a join it had to guess', () => {
    const sql = buildDESelect([{ de: 'A', fields: ['x'] }, { de: 'B', fields: ['y'] }])
    expect(sql.startsWith('-- MUST REVIEW: A and B share no selected column')).toBe(true)
    expect(sql).toContain('ON t1.x = t2.y')
  })

  it('brackets names that need it', () => {
    expect(sqlName('Plain_1')).toBe('Plain_1')
    expect(sqlName('has space')).toBe('[has space]')
    expect(sqlName('a]b')).toBe('[a]]b]')
    expect(sqlName('1st')).toBe('[1st]')
  })
})

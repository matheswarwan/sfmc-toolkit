import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultsTable from '../ResultsTable.vue'

const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }))

describe('ResultsTable: more than 2,500 rows (feedback)', () => {
  it('says how many rows exist and offers to load more', async () => {
    const w = mount(ResultsTable, { props: { rows, columns: ['id'], totalCount: 6000, canLoadMore: true } })
    expect(w.text()).toContain('Showing 2,500 of 6,000 rows')
    const buttons = w.findAll('button').filter((b) => /Load (next|all)/.test(b.text()))
    expect(buttons.map((b) => b.text())).toEqual(['Load next 2,500', 'Load all'])
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(Object.keys(w.emitted())).toEqual(expect.arrayContaining(['load-more', 'load-all']))
  })

  it('caps Load all and says so for very large results', () => {
    const w = mount(ResultsTable, { props: { rows, columns: ['id'], totalCount: 120000, canLoadMore: true, loadAllLimit: 50000 } })
    expect(w.text()).toContain('Load all (up to 50,000)')
  })

  it('shows no load buttons when everything is loaded', () => {
    const w = mount(ResultsTable, { props: { rows: rows.slice(0, 10), columns: ['id'], totalCount: 10, canLoadMore: true } })
    expect(w.text()).toContain('10 rows')
    expect(w.text()).not.toContain('Load next')
  })
})

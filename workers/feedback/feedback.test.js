import { describe, it, expect } from 'vitest'
import worker, { validate } from './index.js'

function fakeDb() {
  const calls = []
  return {
    calls,
    prepare(sql) { return { bind: (...args) => ({ run: async () => { calls.push({ sql, args }); return { meta: { last_row_id: 41 } } } }) } },
  }
}
const post = (body) => new Request('https://w.example/feedback', { method: 'POST', body: JSON.stringify(body), headers: { 'CF-Connecting-IP': '1.2.3.4' } })
const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('feedback worker', () => {
  it('accepts SFMC Query Saver 1.4.0 posts unchanged', async () => {
    const db = fakeDb()
    const res = await worker.fetch(post({ message: ' hi ', screen: 'popup', version: '1.4.0' }), { FEEDBACK_DB: db })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 41 })
    expect(db.calls).toHaveLength(1)
    expect(db.calls[0].args.slice(0, 10)).toEqual(['hi', null, null, 'popup', '1.4.0', null, null, null, null, 0])
  })

  it('stores details, metadata and the screenshot in its own table', async () => {
    const db = fakeDb()
    await worker.fetch(post({ message: 'm', details: 'd', kind: 'problem', app: 'toolkit', metadata: { stack: 's10' }, screenshot: PNG }), { FEEDBACK_DB: db })
    expect(db.calls[0].args.slice(0, 10)).toEqual(['m', 'd', 'problem', 'unknown', 'unknown', 'toolkit', null, null, '{"stack":"s10"}', 1])
    expect(db.calls[1].sql).toContain('feedback_screenshots')
    expect(db.calls[1].args.slice(0, 2)).toEqual([41, PNG])
  })

  it('rejects bad input', () => {
    expect(validate({ message: '  ' }).error).toBe('message is required')
    expect(validate({ message: 'x', screenshot: 'data:text/html;base64,PGI+' }).error).toMatch(/image data URL/)
    expect(validate({ message: 'x', screenshot: 'data:image/png;base64,' + 'A'.repeat(2_000_000) }).error).toMatch(/too large/)
    expect(validate({ message: 'x', metadata: { big: 'y'.repeat(30000) } }).error).toMatch(/too large/)
  })

  it('answers CORS preflight and nothing else', async () => {
    expect((await worker.fetch(new Request('https://w.example/feedback', { method: 'OPTIONS' }), {})).status).toBe(204)
    expect((await worker.fetch(new Request('https://w.example/other'), {})).status).toBe(404)
  })
})

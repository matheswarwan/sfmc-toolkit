// "Where used": runs one kind's analysis (kinds.js), loading the sources it asks for
// (sources.js) one after another, from the cache when they are fresh. Progress goes
// to onStage(id, { state, done, total, note }) with state 'running' | 'done' |
// 'cached' | 'skipped' | 'error'. A source that fails does not end the scan: its
// stage shows the error and its sections say they may be incomplete.
import { KINDS } from './kinds.js'
import { SOURCES, StoppedError, cachedSource, rememberSource, clearUsageCache } from './sources.js'

export { KINDS, PROFILE_LABELS } from './kinds.js'
export { clearUsageCache, StoppedError }

const count = (v) => ({ done: v?.items?.length ?? 0, total: v?.total ?? v?.items?.length ?? 0 })

export function usageStages(target) {
  return KINDS[target.kind].stages(target)
}

/** @returns {Promise<{ sections, note?, title? }>} */
export async function findUsage(stack, target, { onStage = () => {}, shouldStop = () => false } = {}) {
  const kind = KINDS[target.kind]
  if (!kind) throw new Error(`Unknown kind: ${target.kind}`)
  const touched = new Set()
  const loading = {}
  const report = (id, s) => { touched.add(id); onStage(id, s) }
  const checkStop = () => { if (shouldStop()) throw new StoppedError() }

  const ctx = {
    stack,
    stop: shouldStop,
    checkStop,
    stage: report,
    get(id) {
      if (loading[id]) return loading[id]
      const src = SOURCES[id]
      loading[id] = (async () => {
        checkStop()
        const hit = cachedSource(stack, id)
        if (hit) { report(id, { state: 'cached', ...count(hit) }); return hit }
        report(id, { state: 'running', done: 0, total: 0 })
        try {
          const value = await src.load({
            stack,
            stop: shouldStop,
            get: ctx.get,
            progress: (done, total, note = '') => { if (!shouldStop()) report(id, { state: 'running', done, total, note }) },
          })
          checkStop()
          rememberSource(stack, id, value)
          const note = value.errors ? `${value.errors} could not be read` : value.unavailable ? 'not available in this account' : value.capped ? 'capped' : ''
          report(id, { state: 'done', ...count(value), note })
          return value
        } catch (e) {
          if (e?.stopped || shouldStop()) throw new StoppedError()
          report(id, { state: 'error', done: 0, total: 0, note: e.message })
          return null
        }
      })()
      return loading[id]
    },
  }

  const result = await kind.analyze(target, ctx)
  checkStop()
  const found = (result.sections || []).reduce((n, s) => n + (s.items?.length || 0), 0)
  report('analyse', { state: 'done', done: 0, total: 0, note: `${found} found` })
  for (const s of kind.stages(target)) if (!touched.has(s.id)) onStage(s.id, { state: 'skipped', done: 0, total: 0, note: 'not needed' })
  return result
}

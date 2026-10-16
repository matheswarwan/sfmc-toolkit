// One "Where used" scan at a time for the whole app. The state lives at module level,
// so a scan keeps going while the panel is closed or another section is open.
import { reactive } from 'vue'
import { findDEUsage, clearDEUsageCache, USAGE_STAGES } from '@/utils/deUsage.js'

const state = reactive({
  open: false,
  de: null,
  stack: null,
  running: false,
  error: '',
  result: null,
  stages: {}, // id → { state, done, total, note }
  runId: 0,
})

function freshStages() {
  return Object.fromEntries(USAGE_STAGES.map((s) => [s.id, { state: 'waiting', done: 0, total: 0, note: '' }]))
}

/** Starts a scan for `de` (or shows the one already running or finished for it). */
async function start(stack, de, { refresh = false } = {}) {
  state.open = true
  const same = state.de?.id === de.id && state.stack === stack
  if (same && !refresh && (state.running || state.result)) return
  if (refresh) clearDEUsageCache(stack)
  const runId = ++state.runId
  Object.assign(state, { de, stack, running: true, error: '', result: null, stages: freshStages() })
  try {
    const result = await findDEUsage(stack, de, {
      onStage: (id, s) => { if (runId === state.runId) state.stages[id] = { done: 0, total: 0, note: '', ...s } },
      shouldStop: () => runId !== state.runId,
    })
    if (runId === state.runId) state.result = result
  } catch (e) {
    if (runId === state.runId) state.error = e.stopped ? 'Stopped.' : e.message
  } finally {
    if (runId === state.runId) state.running = false
  }
}

function stop() {
  if (!state.running) return
  state.runId++
  state.running = false
  state.error = 'Stopped.'
  for (const s of Object.values(state.stages)) if (s.state === 'running') s.state = 'stopped'
}

/** Overall progress 0..1: each stage counts equally, a running one by its share done. */
function progress() {
  const list = USAGE_STAGES.map((s) => state.stages[s.id] || {})
  const part = (s) => {
    if (['done', 'skipped', 'cached'].includes(s.state)) return 1
    if (s.state === 'running' && s.total) return Math.min(1, s.done / s.total)
    return 0
  }
  return list.reduce((n, s) => n + part(s), 0) / (list.length || 1)
}

export function useDEUsage() {
  return { state, start, stop, progress, stages: USAGE_STAGES }
}

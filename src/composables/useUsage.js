// One "Where used" scan at a time for the whole app. The state lives at module level,
// so a scan keeps going while the panel is closed or another section is open.
import { reactive } from 'vue'
import { findUsage, usageStages, clearUsageCache, KINDS } from '@/utils/usage/index.js'

const state = reactive({
  open: false,
  target: null,
  stack: null,
  running: false,
  error: '',
  result: null,
  order: [], // [{ id, label }]
  stages: {}, // id → { state, done, total, note }
  history: [], // targets to go back to after following a link in the results
  runId: 0,
})

export function targetKey(t) {
  if (!t) return ''
  const id = t.de ? (t.de.id || t.de.customerKey || t.de.name) : t.event?.id || t.asset?.id || t.location?.id || t.activityObjectId || t.id || t.profileType || ''
  return `${t.kind}:${String(id).toLowerCase()}:${t.field || ''}`
}

export const targetTitle = (t) => (t ? KINDS[t.kind].title(t) : '')
export const targetKindLabel = (t) => (t ? (t.de?.dataView ? 'Data view' : KINDS[t.kind].label) : '')

/** Starts a scan (or shows the one already running or finished for the same thing). */
async function start(stack, target, { refresh = false, keepHistory = false } = {}) {
  state.open = true
  const same = targetKey(state.target) === targetKey(target) && state.stack === stack
  if (same && !refresh && (state.running || state.result)) return
  if (!keepHistory) state.history = []
  if (refresh) clearUsageCache(stack)
  const runId = ++state.runId
  const order = usageStages(target)
  Object.assign(state, {
    target, stack, running: true, error: '', result: null, order,
    stages: Object.fromEntries(order.map((s) => [s.id, { state: 'waiting', done: 0, total: 0, note: '' }])),
  })
  try {
    const result = await findUsage(stack, target, {
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

/** Follows a link in the results to another thing, remembering where it came from. */
function follow(target) {
  if (state.target) state.history.push(state.target)
  start(state.stack, target, { keepHistory: true })
}
function back() {
  const prev = state.history.pop()
  if (prev) start(state.stack, prev, { keepHistory: true })
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
  const part = (s) => {
    if (!s) return 0
    if (['done', 'skipped', 'cached', 'error'].includes(s.state)) return 1
    if (s.state === 'running' && s.total) return Math.min(1, s.done / s.total)
    return 0
  }
  return state.order.reduce((n, s) => n + part(state.stages[s.id]), 0) / (state.order.length || 1)
}

export function useUsage() {
  return { state, start, stop, follow, back, progress }
}

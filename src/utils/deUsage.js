// Where a data extension is used: the SQL Query activities that write to it (target)
// or read from it (FROM / JOIN), and the automations those queries are steps of.
// SFMC has no "which automations use this activity" call, so the automations are
// read one by one and indexed by activity; the index and the query list are cached
// per stack until Refresh.
import { sfmcFetch } from './sfmcApi.js'
import { searchActivities, searchAutomations } from './automationApi.js'
import { extractDataExtensions } from './sqlParser.js'
import { runInBatches } from './batchRunner.js'

const AS = (stack) => `https://mc.${stack}.marketingcloudapps.com/AutomationStudioFuel3/fuelapi`
const QUERY_TYPE = 300
const PAGE = 50
const MAX_PAGES = 40 // 2,000 queries or automations
const CACHE_TTL = 30 * 60 * 1000

const norm = (s) => String(s ?? '').trim().toLowerCase()

// Comments and string literals blanked out; [bracketed names] kept as they are.
function stripSql(sql) {
  return String(sql || '').replace(/\[[^\]]*\]|'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m[0] === '[' ? m : ' '))
}

const TABLE_RE = /\b(?:FROM|JOIN)\s+((?:\[[^\]]+\]|\w+)\s*\.\s*)?(\[[^\]]+\]|[\w-]+)/gi

/**
 * The tables a query reads, with whether they were written as ENT.<name>. Covers
 * subqueries (regex over the SQL without comments and strings) and comma joins
 * (the parser), case-insensitive and deduped by name.
 * @returns {{ name: string, ent: boolean }[]}
 */
export function tablesInSql(sql) {
  const found = new Map()
  const add = (name, ent) => {
    const n = String(name || '').replace(/^\[|\]$/g, '').trim()
    if (!n || n === '(') return
    const k = n.toLowerCase()
    const prev = found.get(k)
    found.set(k, { name: prev?.name || n, ent: !!(prev?.ent || ent) })
  }
  const text = stripSql(sql)
  let m
  while ((m = TABLE_RE.exec(text)) !== null) {
    const prefix = (m[1] || '').replace(/[\s.[\]]/g, '').toLowerCase()
    add(m[2], prefix === 'ent')
  }
  for (const t of extractDataExtensions(text)) add(t, false)
  return [...found.values()]
}

/**
 * How one query activity uses the DE: writes (it is the target) and reads (it is in
 * FROM or JOIN). Null when it does neither.
 */
export function matchQuery(q, de) {
  const key = norm(de.customerKey)
  const id = norm(de.id)
  const name = norm(de.name)
  const hasTarget = q.targetKey || q.targetId
  const writes = hasTarget
    ? (!!key && norm(q.targetKey) === key) || (!!id && norm(q.targetId) === id)
    : !!name && norm(q.targetName) === name
  const read = tablesInSql(q.queryText).find((t) => norm(t.name) === name)
  if (!writes && !read) return null
  return { writes, reads: !!read, viaEnt: !!read?.ent }
}

/**
 * activityObjectId (lower case) → where it runs: [{ automationId, step, stepName }].
 * Only Query activities (type 300) are indexed.
 */
export function buildActivityIndex(automations) {
  const index = new Map()
  for (const a of automations) {
    ;(a?.steps || []).forEach((step, si) => {
      for (const act of step?.activities || []) {
        if (Number(act?.objectTypeId) !== QUERY_TYPE || !act.activityObjectId) continue
        const k = norm(act.activityObjectId)
        const list = index.get(k) || []
        if (!list.some((e) => e.automationId === a.id && e.step === (step.step ?? si + 1))) {
          list.push({ automationId: a.id, step: step.step ?? si + 1, stepName: step.name || '' })
        }
        index.set(k, list)
      }
    })
  }
  return index
}

// ── Cache per stack ──────────────────────────────────────
const cache = new Map() // stack → { queries, automations, index, ts }

function cached(stack, key) {
  const c = cache.get(stack)
  if (!c || Date.now() - c.ts > CACHE_TTL) { cache.delete(stack); return null }
  return c[key] ?? null
}
function remember(stack, values) {
  const c = cache.get(stack) || { ts: Date.now() }
  cache.set(stack, { ...c, ...values })
}
export function clearDEUsageCache(stack) {
  if (stack) cache.delete(stack); else cache.clear()
}

export class StoppedError extends Error {
  constructor() { super('Stopped.'); this.stopped = true }
}

/** The stages a scan goes through, in order (ids used by onStage). */
export const USAGE_STAGES = [
  { id: 'queries', label: 'Loading Query activities' },
  { id: 'match', label: 'Checking each query for this data extension' },
  { id: 'automations', label: 'Loading automations' },
  { id: 'steps', label: 'Reading automation steps' },
]

async function pagesOf(fetchPage, onProgress, stop) {
  let all = []
  let total = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    if (stop()) throw new StoppedError()
    const r = await fetchPage(page)
    total = r.total
    all = all.concat(r.items)
    onProgress(all.length, total)
    if (!r.items.length || all.length >= total) break
  }
  return { items: all, total, capped: all.length < total }
}

/**
 * Finds where `de` is used. Reports progress with onStage(id, { state, done, total,
 * note }) where state is 'running' | 'done' | 'skipped' | 'cached'. Throws
 * StoppedError when shouldStop() turns true.
 * @returns {{ matches, queriesScanned, queriesCapped, automationsScanned, automationsCapped, automationErrors, fromCache }}
 */
export async function findDEUsage(stack, de, { onStage = () => {}, shouldStop = () => false } = {}) {
  const stop = shouldStop
  let fromCache = true

  // 1. Every Query activity (with its SQL).
  let queries = cached(stack, 'queries')
  if (queries) onStage('queries', { state: 'cached', done: queries.items.length, total: queries.total })
  else {
    fromCache = false
    onStage('queries', { state: 'running', done: 0, total: 0 })
    queries = await pagesOf(
      async (page) => searchActivities(stack, 'queries', '', page + 1, PAGE),
      (done, total) => onStage('queries', { state: 'running', done, total }), stop)
    // The list normally carries queryText; fetch any query that came without it.
    const missing = queries.items.filter((q) => q.queryText == null && q.queryDefinitionId)
    if (missing.length) {
      await runInBatches(missing, 10, async (q) => {
        const d = await sfmcFetch(`${AS(stack)}/automation/v1/queries/${encodeURIComponent(q.queryDefinitionId)}`, 'GET')
        Object.assign(q, { queryText: d?.queryText ?? '', targetKey: q.targetKey ?? d?.targetKey, targetName: q.targetName ?? d?.targetName, targetId: q.targetId ?? d?.targetId })
      }, { shouldStop: stop, onProgress: (d, t) => onStage('queries', { state: 'running', done: queries.items.length, total: queries.total, note: `fetching SQL ${d} of ${t}` }) })
      if (stop()) throw new StoppedError()
    }
    remember(stack, { queries })
    onStage('queries', { state: 'done', done: queries.items.length, total: queries.total })
  }

  // 2. Match each query.
  const matches = []
  queries.items.forEach((q, i) => {
    const m = matchQuery(q, de)
    if (m) matches.push({ query: q, ...m, automations: [] })
    if (i % 200 === 0) onStage('match', { state: 'running', done: i, total: queries.items.length })
  })
  onStage('match', { state: 'done', done: queries.items.length, total: queries.items.length, note: `${matches.length} found` })

  let automations = cached(stack, 'automations')
  let index = cached(stack, 'index')
  const result = () => ({
    matches,
    queriesScanned: queries.items.length,
    queriesCapped: queries.capped,
    automationsScanned: automations?.items.length ?? 0,
    automationsCapped: !!automations?.capped,
    automationErrors: automations?.errors ?? 0,
    fromCache,
  })

  // 3 and 4. Automations, only when a query matched.
  if (!matches.length) {
    onStage('automations', { state: 'skipped', note: 'no matching queries' })
    onStage('steps', { state: 'skipped' })
    return result()
  }
  if (automations && index) {
    onStage('automations', { state: 'cached', done: automations.items.length, total: automations.total })
    onStage('steps', { state: 'cached', done: automations.items.length, total: automations.items.length })
  } else {
    fromCache = false
    onStage('automations', { state: 'running', done: 0, total: 0 })
    const list = await pagesOf(
      async (page) => { const r = await searchAutomations(stack, '', page * PAGE); return { items: r.entries, total: r.total } },
      (done, total) => onStage('automations', { state: 'running', done, total }), stop)
    onStage('automations', { state: 'done', done: list.items.length, total: list.total })

    onStage('steps', { state: 'running', done: 0, total: list.items.length })
    const settled = await runInBatches(list.items, 10,
      (a) => sfmcFetch(`${AS(stack)}/automation/v1/automations/${encodeURIComponent(a.id)}`, 'GET'),
      { shouldStop: stop, onProgress: (done, total) => onStage('steps', { state: 'running', done, total }) })
    if (stop()) throw new StoppedError()
    const details = settled.map((s, i) => (s.status === 'fulfilled' && s.value ? { ...s.value, id: s.value.id || list.items[i].id } : null))
    const errors = details.filter((d) => !d).length
    index = buildActivityIndex(details.filter(Boolean))
    automations = { ...list, errors, byId: new Map(list.items.map((a) => [a.id, a])) }
    remember(stack, { automations, index })
    onStage('steps', { state: 'done', done: list.items.length, total: list.items.length, note: errors ? `${errors} could not be read` : '' })
  }

  for (const m of matches) {
    m.automations = (index.get(norm(m.query.queryDefinitionId)) || []).map((e) => {
      const a = automations.byId.get(e.automationId) || {}
      return { ...e, name: a.name || e.automationId, status: a.status ?? '', lastRunTime: a.lastRunTime || null, lastRunStatus: a.lastRunStatus ?? '' }
    })
  }
  return result()
}

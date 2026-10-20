// Automation Studio calls (from SFMC Automation Viewer), through the service worker.
import { sfmcFetch } from './sfmcApi.js'
import { activityEndpoint } from './activityTypes.js'
import { RESULTS_PAGE_SIZE } from './paging.js'

export const AUTOMATION_PAGE_SIZE = RESULTS_PAGE_SIZE
const AS = (stack) => `https://mc.${stack}.marketingcloudapps.com/AutomationStudioFuel3/fuelapi`

export async function searchAutomations(stack, query, skip = 0, top = AUTOMATION_PAGE_SIZE) {
  const name = query.trim()
  const where = name ? `&$where=${encodeURIComponent(`name like ${name}`)}` : ''
  const data = await sfmcFetch(`${AS(stack)}/legacy/v1/beta/automations/automation/definition/?$top=${top}&$skip=${skip}&$sort=${encodeURIComponent('lastRunTime desc')}&view=gridView${where}`, 'GET')
  const entries = data?.entry || []
  return { entries, total: data?.totalResults ?? entries.length }
}

/**
 * The next page after the automations in `have`, without repeats. When the $skip page
 * brings nothing new (SFMC repeated the first page or returned none, feedback #28),
 * asks for everything from the start up to one page more and keeps the new ones.
 */
export async function loadMoreAutomations(stack, query, have) {
  const known = new Set(have.map((a) => a.id))
  const r = await searchAutomations(stack, query, have.length)
  let entries = r.entries.filter((a) => !known.has(a.id))
  if (!entries.length) {
    const all = await searchAutomations(stack, query, 0, have.length + AUTOMATION_PAGE_SIZE)
    entries = all.entries.filter((a) => !known.has(a.id))
  }
  return { entries, total: r.total }
}

/** The automation and its error notifications (null when those can't be read). */
export async function fetchAutomation(stack, id) {
  const [details, notifications] = await Promise.all([
    sfmcFetch(`${AS(stack)}/automation/v1/automations/${encodeURIComponent(id)}`, 'GET'),
    sfmcFetch(`${AS(stack)}/legacy/v1/beta/automations/notifications/${encodeURIComponent(id)}/`, 'GET').catch(() => null),
  ])
  return { details, notifications }
}

/**
 * Full details of one step activity. Wait (467) and Journey (952) have no endpoint;
 * nor do types SFMC offers no API for: those return the step's own activity object.
 * Filters also get their filter definition, File Transfers their full record.
 */
export async function fetchActivityDetails(stack, activity) {
  const url = activityEndpoint(stack, activity)
  if (!url) return { ...activity, _fromStep: true }
  const details = await sfmcFetch(url, 'GET')
  if (activity.objectTypeId === 303 && details?.filterDefinitionId) {
    details.additionalStepDetails = await sfmcFetch(`${AS(stack)}/automation/v1/filterdefinitions/${details.filterDefinitionId}`, 'GET').catch(() => null)
  } else if (activity.objectTypeId === 53 && details?.id) {
    details.additionalStepDetails = await sfmcFetch(`${AS(stack)}/automation/v1/filetransfers/${details.id}`, 'GET').catch(() => null)
  }
  return details
}

// ── Activities by type ─────────────────────────────────────
export const ACTIVITY_SEARCH_TYPES = [
  { id: 'query', label: 'Query', endpoint: 'queries', objectTypeId: 300 },
  { id: 'script', label: 'Script', endpoint: 'scripts', objectTypeId: 423 },
  { id: 'import', label: 'Import', endpoint: 'imports', objectTypeId: 43 },
  { id: 'dataextract', label: 'Data Extract', endpoint: 'dataextracts', objectTypeId: 73 },
  { id: 'filetransfer', label: 'File Transfer', endpoint: 'filetransfers', objectTypeId: 53 },
  { id: 'filter', label: 'Filter', endpoint: 'filters', objectTypeId: 303 },
]

// Endpoints that refuse $orderBy=modifiedDate (filters on some stacks: "Order field is
// invalid, the following field is not allowed: 'modifiedDate'", feedback #29). Those
// are listed in SFMC's own order, and each page is sorted here.
const unsortable = new Set()
const isOrderError = (e) => /order field is invalid/i.test(e?.message || '')
const byModifiedDesc = (a, b) => String(b.modifiedDate || '').localeCompare(String(a.modifiedDate || ''))

/** One page of activities, newest first. `unsorted` is true when SFMC could not sort the list. */
export async function searchActivities(stack, endpoint, query, page = 1, pageSize = RESULTS_PAGE_SIZE) {
  const name = query.trim()
  const filter = name ? `&$filter=${encodeURIComponent(`name like "${name}"`)}` : ''
  const url = (orderBy) => `${AS(stack)}/automation/v1/${endpoint}/?$page=${page}&$pageSize=${pageSize}${orderBy ? `&$orderBy=${encodeURIComponent('modifiedDate desc')}` : ''}&retrievalType=1${filter}`
  const key = `${stack}:${endpoint}`
  let data
  if (!unsortable.has(key)) {
    try {
      data = await sfmcFetch(url(true), 'GET')
    } catch (e) {
      if (!isOrderError(e)) throw e
      unsortable.add(key)
    }
  }
  const unsorted = unsortable.has(key)
  if (unsorted) data = await sfmcFetch(url(false), 'GET')
  const items = data?.items || []
  if (unsorted) items.sort(byModifiedDesc)
  return { items, total: data?.count ?? data?.totalCount ?? items.length, unsorted }
}

/** Every activity of a type, 50 per request, at most 40 requests (2,000). */
export async function fetchAllActivities(stack, endpoint, onPage) {
  let all = []
  let total = 0
  for (let page = 1; page <= 40; page++) {
    const r = await searchActivities(stack, endpoint, '', page, 50)
    total = r.total
    all = all.concat(r.items)
    onPage?.(all.length, total)
    if (!r.items.length || all.length >= total) break
  }
  return { items: all, total, capped: all.length < total }
}

// ── Run history (feedback #41) ─────────────────────────────
// The requests Automation Studio's run log makes (from the user's HAR, 2026-10-20).
// The response bodies were not in the HAR, so runs are read by the likely field
// names and each run keeps its raw record.
const ymd = (d) => d.toISOString().slice(0, 10)
const pick = (o, names) => {
  for (const n of names) {
    const k = Object.keys(o || {}).find((x) => x.toLowerCase() === n.toLowerCase())
    if (k && o[k] != null && o[k] !== '') return o[k]
  }
  return null
}

export function normalizeRun(r) {
  const start = pick(r, ['startTime', 'start', 'startedTime', 'startDate'])
  const end = pick(r, ['endTime', 'completedTime', 'end', 'endDate'])
  const ms = start && end ? Date.parse(end) - Date.parse(start) : null
  return {
    id: pick(r, ['id', 'instanceId', 'automationInstanceId']),
    start,
    end,
    durationMs: Number.isFinite(ms) && ms >= 0 ? ms : null,
    status: pick(r, ['status', 'statusName', 'runStatus', 'state']),
    message: pick(r, ['statusMessage', 'message', 'errorMessage', 'details']),
    raw: r,
  }
}

/** Runs of one automation between `days` ago and today, newest first. `id` is the legacy (list) ID. */
export async function fetchRunHistory(stack, id, { days = 30, top = 50, now = new Date() } = {}) {
  const begin = new Date(now.getTime() - days * 86400000)
  const url = `${AS(stack)}/legacy/v1/beta/automations/automation/instance/?definition_id=${encodeURIComponent(id)}&$top=${top}`
    + `&begin_date=${ymd(begin)}&end_date=${ymd(now)}&order_by=${encodeURIComponent('StartTime desc')}&to_server_time=1`
  const data = await sfmcFetch(url, 'GET')
  const list = data?.entry ?? data?.items ?? (Array.isArray(data) ? data : [])
  return { runs: list.map(normalizeRun), total: data?.totalResults ?? data?.count ?? list.length }
}

/** Automation Studio's health summary for one automation (shape not known; shown as is). */
export async function fetchAutomationHealth(stack, id) {
  return sfmcFetch(`${AS(stack)}/legacy/v1/beta/automations/automation/definition/health/${encodeURIComponent(id)}/`, 'GET')
}

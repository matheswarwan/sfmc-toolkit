// Automation Studio calls (from SFMC Automation Viewer), through the service worker.
import { sfmcFetch } from './sfmcApi.js'
import { activityEndpoint } from './activityTypes.js'
import { RESULTS_PAGE_SIZE } from './paging.js'

export const AUTOMATION_PAGE_SIZE = RESULTS_PAGE_SIZE
const AS = (stack) => `https://mc.${stack}.marketingcloudapps.com/AutomationStudioFuel3/fuelapi`

export async function searchAutomations(stack, query, skip = 0) {
  const name = query.trim()
  const where = name ? `&$where=${encodeURIComponent(`name like ${name}`)}` : ''
  const data = await sfmcFetch(`${AS(stack)}/legacy/v1/beta/automations/automation/definition/?$top=${AUTOMATION_PAGE_SIZE}&$skip=${skip}&$sort=${encodeURIComponent('lastRunTime desc')}&view=gridView${where}`, 'GET')
  const entries = data?.entry || []
  return { entries, total: data?.totalResults ?? entries.length }
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

export async function searchActivities(stack, endpoint, query, page = 1, pageSize = RESULTS_PAGE_SIZE) {
  const name = query.trim()
  const filter = name ? `&$filter=${encodeURIComponent(`name like "${name}"`)}` : ''
  const data = await sfmcFetch(`${AS(stack)}/automation/v1/${endpoint}/?$page=${page}&$pageSize=${pageSize}&$orderBy=${encodeURIComponent('modifiedDate desc')}&retrievalType=1${filter}`, 'GET')
  const items = data?.items || []
  return { items, total: data?.count ?? data?.totalCount ?? items.length }
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

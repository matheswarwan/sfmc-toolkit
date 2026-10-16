// What "Where used" reads from SFMC, one source per kind of thing. Each source loads
// once per stack and is cached for 30 minutes (or until Rescan); loading reports
// progress so the Process panel can show it.
import { sfmcFetch } from '../sfmcApi.js'
import { searchActivities, searchAutomations } from '../automationApi.js'
import { fetchEventDefinitions } from '../journeyApi.js'
import { CLOUD_PAGE_ASSET_TYPE_IDS } from '../cloudPagesApi.js'
import { activityEndpoint } from '../activityTypes.js'
import { runInBatches } from '../batchRunner.js'
import { buildActivityIndex } from './match.js'

const AS = (stack) => `https://mc.${stack}.marketingcloudapps.com/AutomationStudioFuel3/fuelapi`
const JB = (stack) => `https://jbinteractions.${stack}.marketingcloudapps.com/fuelapi/interaction/v1`
const CB = (stack) => `https://content-builder.${stack}.marketingcloudapps.com/fuelapi`
const PAGE = 50
const MAX_PAGES = 40 // 2,000 of each
const CACHE_TTL = 30 * 60 * 1000

// Content Builder asset types by group.
export const ASSET_GROUPS = {
  email: [207, 208, 209],
  template: [4, 206, 214],
  block: [195, 196, 197, 198, 199, 200, 201, 202, 203, 210, 211, 212, 213, 215, 216, 217, 219, 220, 221, 222, 223, 224, 225, 226],
  cloudpage: CLOUD_PAGE_ASSET_TYPE_IDS,
}
export function assetGroup(asset) {
  const id = Number(asset?.assetType?.id)
  return Object.keys(ASSET_GROUPS).find((g) => ASSET_GROUPS[g].includes(id)) || 'other'
}

export class StoppedError extends Error {
  constructor() { super('Stopped.'); this.stopped = true }
}

async function pagesOf(fetchPage, progress, stop, maxPages = MAX_PAGES) {
  let all = []
  let total = 0
  for (let page = 0; page < maxPages; page++) {
    if (stop()) throw new StoppedError()
    const r = await fetchPage(page)
    total = r.total
    all = all.concat(r.items)
    progress(all.length, total)
    if (!r.items.length || all.length >= total) break
  }
  return { items: all, total, capped: all.length < total }
}

/** Every activity of one Automation Studio type, with details fetched where the list leaves `field` out. */
function activitySource(endpoint, label, { needs, detailUrl } = {}) {
  return {
    label,
    async load({ stack, progress, stop }) {
      const list = await pagesOf((p) => searchActivities(stack, endpoint, '', p + 1, PAGE), progress, stop)
      if (needs) {
        const missing = list.items.filter((it) => it[needs] == null)
        if (missing.length) {
          await runInBatches(missing, 10, async (it) => {
            const url = detailUrl(stack, it)
            if (!url) return
            const d = await sfmcFetch(url, 'GET')
            for (const [k, v] of Object.entries(d || {})) if (it[k] == null) it[k] = v
          }, { shouldStop: stop, onProgress: (d, t) => progress(list.items.length, list.total, `details ${d} of ${t}`) })
          if (stop()) throw new StoppedError()
        }
      }
      return list
    },
  }
}

export const SOURCES = {
  queries: activitySource('queries', 'Loading SQL Query activities', {
    needs: 'queryText',
    detailUrl: (s, q) => (q.queryDefinitionId ? `${AS(s)}/automation/v1/queries/${encodeURIComponent(q.queryDefinitionId)}` : null),
  }),
  imports: activitySource('imports', 'Loading Import activities'),
  filters: activitySource('filters', 'Loading Filter activities'),
  dataextracts: activitySource('dataextracts', 'Loading Data Extract activities'),
  filetransfers: activitySource('filetransfers', 'Loading File Transfer activities', {
    needs: 'fileTransferLocationId',
    detailUrl: (s, f) => (f.id ? `${AS(s)}/automation/v1/filetransfers/${encodeURIComponent(f.id)}` : null),
  }),
  scripts: activitySource('scripts', 'Loading Script activities', {
    needs: 'script',
    detailUrl: (s, x) => (x.ssjsActivityId ? `${AS(s)}/automation/v1/scripts/${encodeURIComponent(x.ssjsActivityId)}` : null),
  }),

  automations: {
    label: 'Loading automations and their steps',
    async load({ stack, progress, stop }) {
      const list = await pagesOf(async (p) => {
        const r = await searchAutomations(stack, '', p * PAGE)
        return { items: r.entries, total: r.total }
      }, (d, t) => progress(d, t, 'listing'), stop)
      const settled = await runInBatches(list.items, 10,
        (a) => sfmcFetch(`${AS(stack)}/automation/v1/automations/${encodeURIComponent(a.id)}`, 'GET'),
        { shouldStop: stop, onProgress: (d, t) => progress(d, t, 'reading steps') })
      if (stop()) throw new StoppedError()
      const details = settled.map((s, i) => (s.status === 'fulfilled' && s.value ? { ...s.value, id: s.value.id || list.items[i].id } : null))
      // The index is keyed in lower case; requests need the ID as SFMC wrote it.
      const originalIds = new Map()
      for (const d of details) for (const st of d?.steps || []) for (const a of st?.activities || []) if (a?.activityObjectId) originalIds.set(String(a.activityObjectId).toLowerCase(), a.activityObjectId)
      return {
        ...list,
        originalIds,
        errors: details.filter((d) => !d).length,
        byId: new Map(list.items.map((a) => [a.id, a])),
        index: buildActivityIndex(details.filter(Boolean)),
      }
    },
  },

  // Send Email activities (type 42) in automations: their send definitions.
  emailsends: {
    label: 'Loading Send Email activities',
    after: ['automations'],
    async load({ stack, progress, stop, get }) {
      const autos = await get('automations')
      if (!autos) throw new Error('needs the automations, which could not be loaded')
      const ids = [...autos.index.entries()].filter(([, list]) => list.some((e) => e.objectTypeId === 42))
        .map(([id, list]) => ({ id: autos.originalIds?.get(id) || id, name: list[0].activityName }))
      const out = []
      await runInBatches(ids, 10, async (x) => {
        const url = activityEndpoint(stack, { objectTypeId: 42, activityObjectId: x.id })
        const d = await sfmcFetch(url, 'GET').catch(() => null)
        out.push({ activityObjectId: x.id, name: d?.name || x.name, definition: d })
      }, { shouldStop: stop, onProgress: (d, t) => progress(d, t) })
      if (stop()) throw new StoppedError()
      progress(out.length, ids.length)
      return { items: out, total: ids.length, capped: false }
    },
  },

  journeys: {
    label: 'Loading journeys and their activities',
    async load({ stack, progress, stop }) {
      const list = await pagesOf(async (p) => {
        const params = new URLSearchParams({ $page: String(p + 1), $pageSize: String(PAGE), $orderBy: 'ModifiedDate DESC', mostRecentVersionOnly: 'true' })
        const data = await sfmcFetch(`${JB(stack)}/interactions?${params}`, 'GET')
        const items = data?.items || []
        return { items, total: data?.count ?? items.length }
      }, (d, t) => progress(d, t, 'listing'), stop)
      const settled = await runInBatches(list.items, 10,
        (j) => sfmcFetch(`${JB(stack)}/interactions/${encodeURIComponent(j.id)}?extras=all${j.version ? `&versionNumber=${j.version}` : ''}`, 'GET'),
        { shouldStop: stop, onProgress: (d, t) => progress(d, t, 'reading activities') })
      if (stop()) throw new StoppedError()
      const items = settled.map((s, i) => (s.status === 'fulfilled' && s.value ? { ...list.items[i], ...s.value } : { ...list.items[i], _error: true }))
      return { items, total: list.total, capped: list.capped, errors: items.filter((j) => j._error).length }
    },
  },

  events: {
    label: 'Loading journey entry events',
    async load({ stack, progress }) {
      const r = await fetchEventDefinitions(stack)
      progress(r.items.length, r.total)
      return { items: r.items, total: r.total, capped: r.items.length < r.total }
    },
  },

  locations: {
    label: 'Loading file locations',
    async load({ stack, progress }) {
      const data = await sfmcFetch(`${AS(stack)}/automation/v1/ftplocations/`, 'GET').catch(() => null)
      const items = Array.isArray(data) ? data : data?.items || []
      progress(items.length, items.length)
      return { items, total: items.length, capped: false, unavailable: !data }
    },
  },

  assets: {
    label: 'Loading emails, templates, content blocks and CloudPages',
    async load({ stack, progress, stop }) {
      const types = Object.values(ASSET_GROUPS).flat()
      const body = (p) => ({
        page: { page: p + 1, pageSize: PAGE },
        query: { property: 'assetType.id', simpleOperator: 'in', values: types },
        sort: [{ property: 'modifiedDate', direction: 'DESC' }],
        fields: ['id', 'name', 'customerKey', 'assetType', 'category', 'modifiedDate', 'content', 'superContent', 'design', 'views', 'slots', 'blocks', 'data', 'meta'],
      })
      return pagesOf(async (p) => {
        const data = await sfmcFetch(`${CB(stack)}/asset/v1/content/assets/query`, 'POST', body(p))
        const items = data?.items || []
        return { items, total: data?.count ?? items.length }
      }, progress, stop, 100)
    },
  },
}

// ── Cache per stack ──────────────────────────────────────
const cache = new Map() // `${stack}:${source}` → { value, ts }

export function cachedSource(stack, id) {
  const c = cache.get(`${stack}:${id}`)
  if (!c || Date.now() - c.ts > CACHE_TTL) { cache.delete(`${stack}:${id}`); return null }
  return c.value
}
export function rememberSource(stack, id, value) {
  cache.set(`${stack}:${id}`, { value, ts: Date.now() })
}
export function clearUsageCache(stack) {
  for (const k of [...cache.keys()]) if (!stack || k.startsWith(`${stack}:`)) cache.delete(k)
}

// ── Pickers on the Where used page ───────────────────────
/** Content Builder assets of one group whose name contains `query`, newest first (50). */
export async function searchAssets(stack, query, group) {
  const types = { property: 'assetType.id', simpleOperator: 'in', values: ASSET_GROUPS[group] }
  const q = query.trim()
  const data = await sfmcFetch(`${CB(stack)}/asset/v1/content/assets/query`, 'POST', {
    page: { page: 1, pageSize: PAGE },
    query: q ? { leftOperand: { property: 'name', simpleOperator: 'like', value: q }, logicalOperator: 'AND', rightOperand: types } : types,
    sort: [{ property: 'modifiedDate', direction: 'DESC' }],
    fields: ['id', 'name', 'customerKey', 'assetType', 'category', 'modifiedDate', 'data'],
  })
  return data?.items || []
}

/** File locations (FTP, Safehouse, cloud storage). */
export async function listFileLocations(stack) {
  const data = await sfmcFetch(`${AS(stack)}/automation/v1/ftplocations/`, 'GET')
  return Array.isArray(data) ? data : data?.items || []
}

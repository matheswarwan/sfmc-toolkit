// Data Extension Finder calls (from SFMC Automation Viewer's deExplorer.js), through
// the service worker like every SFMC call. Shared and Synchronized DEs come from the
// catalog in sfmcApi.js (SFMC Query Saver's), so the two never disagree.
import { sfmcFetch, searchSharedDEs } from './sfmcApi.js'

export const DE_PAGE_SIZE = 25

const CM = (stack) => `https://mc.${stack}.marketingcloudapps.com/contactsmeta/fuelapi`

// Name prefixes of DEs that SFMC and its add-ons create ("Hide system DEs").
export const SYSTEM_DE_PREFIXES = [
  'QueryStudioResults', 'log', 'ExpressionBuilderAttributes', 'IGO_PROFILES', 'IGO_VIEWS',
  'PI_SESSION_ENDS', 'IGO_PURCHASES', 'IGO_PRODUCTS', 'IGO_PRODUCTATTRIBS', 'PI_CONTENTVIEWS',
  'PI_CONTENT', 'PI_CONTENTATTRIBS', 'PI_SESSIONS', 'Einstein_MC_Predictive_Scores',
  'PI_ABANDONED_CART_EVENT', 'PI_ABANDONED_CART_ITEMS',
]
export const isSystemDE = (name) => SYSTEM_DE_PREFIXES.some((p) => String(name || '').startsWith(p))

export function toDE(item, sourceType = null) {
  return {
    id: String(item.id ?? item.customerKey ?? ''),
    name: item.name || '',
    customerKey: item.customerKey ?? item.key ?? '',
    categoryId: item.categoryId ?? item.categoryID ?? null,
    createdDate: item.createdDate || null,
    modifiedDate: item.modifiedDate || null,
    sourceType: item.sourceType || sourceType,
    rowCount: item.rowCount ?? null,
  }
}

/**
 * One page of DEs whose name contains `query` ('' lists all, newest first). Page 1
 * also lists matching Shared and Synchronized DEs first (a failure there only drops
 * them). Returns { items, total }.
 */
export async function searchDataExtensions(stack, query, page = 1) {
  const search = query.trim() ? `&$search=${encodeURIComponent(query.trim())}` : ''
  const url = `${CM(stack)}/data-internal/v1/customobjects/category/0?retrievalType=1&$page=${page}&$pagesize=${DE_PAGE_SIZE}&$orderBy=modifiedDate%20DESC${search}`
  const [data, shared] = await Promise.all([
    sfmcFetch(url, 'GET'),
    page === 1 ? searchSharedDEs(stack, query.trim()).catch(() => []) : Promise.resolve([]),
  ])
  if (!data || !Array.isArray(data.items)) throw new Error('Unexpected response from the data extension search.')
  const extra = shared.map((d) => toDE(d))
  const extraIds = new Set(extra.map((d) => d.id))
  const local = data.items.map((d) => toDE(d)).filter((d) => !extraIds.has(d.id))
  const localTotal = data.count ?? data.totalCount ?? data.items.length
  return { items: [...extra, ...local], total: localTotal + extra.length - (data.items.length - local.length) }
}

const fieldsCache = new Map() // `${stack}:${id}` → Promise<fields>

/** The fields of one DE, primary keys first, then in DE order. Cached per page. */
export function fetchDEFieldList(stack, id) {
  const key = `${stack}:${id}`
  if (!fieldsCache.has(key)) {
    const p = sfmcFetch(`${CM(stack)}/internal/v1/customobjects/${encodeURIComponent(id)}/fields`, 'GET').then((data) => {
      if (!data || !Array.isArray(data.fields)) throw new Error('No fields in the response.')
      return [...data.fields].sort((a, b) => (!!b.isPrimaryKey - !!a.isPrimaryKey) || ((a.ordinal || 0) - (b.ordinal || 0)))
    })
    p.catch(() => fieldsCache.delete(key))
    fieldsCache.set(key, p)
  }
  return fieldsCache.get(key)
}

const folderCache = new Map() // `${stack}:${id}` → Promise<{ name, parentId }>

function fetchFolder(stack, id) {
  const key = `${stack}:${id}`
  if (!folderCache.has(key)) {
    const p = sfmcFetch(`${CM(stack)}/legacy/v1/beta/folder/${id}?Localization=true&$top=1000`, 'GET')
      .then((f) => ({ name: f?.name || `Folder ${id}`, parentId: f?.parentId ?? null }))
    p.catch(() => folderCache.delete(key))
    folderCache.set(key, p)
  }
  return folderCache.get(key)
}

/** "Data Extensions > Folder > Sub folder" for a category id. */
export async function fetchDEFolderPath(stack, categoryId) {
  if (categoryId == null || categoryId === '') return ''
  const names = []
  let id = String(categoryId)
  for (let depth = 0; id && id !== '0' && depth < 30; depth++) {
    const folder = await fetchFolder(stack, id)
    names.unshift(folder.name)
    id = folder.parentId != null ? String(folder.parentId) : ''
  }
  return names.join(' > ')
}

export function clearDECaches() {
  fieldsCache.clear()
  folderCache.clear()
}

/** Field type with its length and scale, e.g. "Text (254)" or "Decimal (18,2)". */
export function fieldTypeLabel(f) {
  if (!f?.type) return ''
  if (f.length && f.scale) return `${f.type} (${f.length},${f.scale})`
  if (f.length) return `${f.type} (${f.length})`
  return f.type
}

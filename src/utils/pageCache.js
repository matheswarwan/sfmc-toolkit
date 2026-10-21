// What an overview page last read, kept for the life of the app tab so moving to
// another section and back shows it again instead of reading SFMC from scratch
// (feedback #66). Keyed by page, stack and business unit; Refresh replaces it.

const cache = new Map()

export const pageCacheKey = (page, stack, buId) => `${page}:${stack || ''}:${buId ?? ''}`

export function readPageCache(key) {
  return cache.get(key) || null
}

/** Merges `patch` into the saved entry and stamps it with the time. */
export function writePageCache(key, patch, now = Date.now()) {
  const entry = { ...(cache.get(key) || {}), ...patch, savedAt: now }
  cache.set(key, entry)
  return entry
}

export function clearPageCache() {
  cache.clear()
}

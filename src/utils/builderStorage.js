/**
 * Persistence helpers for Query Builder records.
 * Records are stored under `sql_<ts>` keys with `source: 'builder'` and a
 * `builderState` snapshot so they reopen in the builder (not the run window).
 */

/** Strip Vue reactive proxies so chrome.storage serializes arrays as arrays. */
export function plainClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return null
  }
}

export function defaultQueryOptions() {
  return { distinct: false, top: null, groupBy: [], orderBy: [], computedColumns: [] }
}

export function buildBuilderState({
  selectedDEs, joins, where, visualMode, graphNodes, graphEdges, queryOptions,
} = {}) {
  return {
    selectedDEs: plainClone(selectedDEs) || [],
    joins: plainClone(joins) || [],
    where: plainClone(where) || { combinator: 'AND', conditions: [] },
    queryOptions: plainClone(queryOptions) || defaultQueryOptions(),
    visualMode: !!visualMode,
    graphNodes: plainClone(graphNodes) || [],
    graphEdges: plainClone(graphEdges) || [],
  }
}

/**
 * Create or update a builder record. Preserves name / favourite / timestamp
 * when updating an existing record.
 * @returns {Promise<string>} the record id
 */
export function saveBuilderRecord({ id, sql, state }) {
  return new Promise((resolve) => {
    const ts = Date.now()
    const recordId = id || `sql_${ts}`
    chrome.storage.local.get(recordId, (data) => {
      const existing = data[recordId]
      const record = {
        id: recordId,
        name: existing?.name || 'Query Builder · ' + new Date(ts).toLocaleString(),
        queryText: sql || '',
        timeStamp: existing?.timeStamp || ts,
        isFavourite: existing?.isFavourite || false,
        url: existing?.url || '',
        source: 'builder',
        builderState: buildBuilderState(state),
      }
      chrome.storage.local.set({ [recordId]: record }, () => resolve(recordId))
    })
  })
}

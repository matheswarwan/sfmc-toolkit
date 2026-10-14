import { ref, computed, watch } from 'vue'

export const MAX_PANELS = 6
export const LAYOUT_PRESETS = [
  { rows: 1, cols: 1, label: '1×1' },
  { rows: 1, cols: 2, label: '1×2' },
  { rows: 2, cols: 2, label: '2×2' },
  { rows: 2, cols: 3, label: '2×3' },
]

function newQueryId() {
  return `sql_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export function useWorkspace() {
  const workspaceId = ref(null)
  const layoutRows  = ref(1)
  const layoutCols  = ref(1)
  const panels      = ref([]) // { queryId, initialSql? }

  const panelCount = computed(() => panels.value.length)
  const canAddPanel = computed(() => panels.value.length < MAX_PANELS)

  function setLayout(rows, cols) {
    layoutRows.value = rows
    layoutCols.value = cols
    const capacity = rows * cols
    while (panels.value.length > capacity) {
      panels.value.pop()
    }
    while (panels.value.length < capacity && panels.value.length < MAX_PANELS) {
      panels.value.push({ queryId: newQueryId() })
    }
    saveWorkspace()
  }

  function addPanel(initialSql = '') {
    if (!canAddPanel.value) return null
    const capacity = layoutRows.value * layoutCols.value
    if (panels.value.length >= capacity) {
      // expand layout to fit
      if (layoutRows.value === 1 && layoutCols.value < 3) layoutCols.value++
      else if (layoutRows.value < 2) { layoutRows.value = 2; if (layoutCols.value < 3) layoutCols.value = 3 }
    }
    const entry = { queryId: newQueryId(), initialSql: initialSql || undefined }
    panels.value.push(entry)
    saveWorkspace()
    return entry.queryId
  }

  function removePanel(index) {
    if (panels.value.length <= 1) return
    panels.value.splice(index, 1)
    saveWorkspace()
  }

  function duplicatePanel(index) {
    if (!canAddPanel.value) return
    const src = panels.value[index]
    if (!src) return
    chrome.storage.local.get(src.queryId, (data) => {
      const rec = data[src.queryId]
      const newId = newQueryId()
      if (rec) {
        const copy = {
          ...rec,
          id: newId,
          name: (rec.name || 'Query') + ' (copy)',
          timeStamp: Date.now(),
          runs: [],
        }
        chrome.storage.local.set({ [newId]: copy })
      }
      panels.value.push({ queryId: newId })
      saveWorkspace()
    })
  }

  async function saveWorkspace() {
    if (!workspaceId.value) return
    const record = {
      id: workspaceId.value,
      layout: { rows: layoutRows.value, cols: layoutCols.value },
      panels: panels.value.map(p => ({ queryId: p.queryId })),
      timeStamp: Date.now(),
    }
    await new Promise((resolve) => {
      chrome.storage.local.set({ [workspaceId.value]: record }, resolve)
    })
  }

  async function loadFromUrl() {
    const params = new URLSearchParams(window.location.search)
    const ws     = params.get('ws')
    const queryId = params.get('id')
    const sql    = params.get('sql')

    if (ws && ws !== 'new') {
      workspaceId.value = ws
      const data = await new Promise((resolve) => {
        chrome.storage.local.get(ws, (r) => resolve(r[ws] || null))
      })
      if (data?.panels?.length) {
        layoutRows.value = data.layout?.rows ?? 1
        layoutCols.value = data.layout?.cols ?? 1
        panels.value = data.panels.map(p => ({ queryId: p.queryId }))
        return
      }
    }

    workspaceId.value = `workspace_${Date.now()}`
    panels.value = []

    if (queryId) {
      panels.value.push({ queryId })
    } else if (sql) {
      try {
        panels.value.push({ queryId: newQueryId(), initialSql: decodeURIComponent(sql) })
      } catch {
        panels.value.push({ queryId: newQueryId(), initialSql: sql })
      }
    } else {
      panels.value.push({ queryId: newQueryId() })
    }

    const url = new URL(window.location.href)
    url.searchParams.set('ws', workspaceId.value)
    url.searchParams.delete('id')
    url.searchParams.delete('sql')
    window.history.replaceState({}, '', url.toString())
    await saveWorkspace()
  }

  watch([layoutRows, layoutCols], () => saveWorkspace())

  return {
    workspaceId, layoutRows, layoutCols, panels, panelCount, canAddPanel,
    LAYOUT_PRESETS, setLayout, addPanel, removePanel, duplicatePanel,
    loadFromUrl, saveWorkspace,
  }
}

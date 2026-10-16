<script setup>
// Data Extensions (SFMC Automation Viewer's Data Extension Finder): search local,
// Shared and Synchronized DEs, see folder paths and fields, tick fields to build a
// query, export to Excel or a document.
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Loader2, RefreshCw, FolderTree, ListTree, FileSpreadsheet, Copy, Play, X, ChevronDown, ChevronRight, Network } from 'lucide-vue-next'
import DataTable from '@/components/results/DataTable.vue'
import DownloadMenu from '@/components/results/DownloadMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import DEUsagePanel from '@/components/data/DEUsagePanel.vue'
import { useDEUsage } from '@/composables/useDEUsage.js'
import { useStack, whenStack } from '@/composables/useStack.js'
import { useRouteSearch } from '@/composables/useRouteSearch.js'
import { showToast } from '@/composables/useToast.js'
import { searchLocalDEs, searchSharedSyncDEs, mergeDEPages, fetchDEFieldList, fetchDEFolderPath, clearDECaches, isSystemDE, fieldTypeLabel, DE_PAGE_SIZE } from '@/utils/deApi.js'
import { clearSharedDECache } from '@/utils/sfmcApi.js'
import { clearDEUsageCache } from '@/utils/deUsage.js'
import { buildDESelect } from '@/utils/deSql.js'
import { runInBatches } from '@/utils/batchRunner.js'
import { downloadWorkbook } from '@/utils/exportDoc.js'
import { formatDateTime } from '@/utils/format.js'

const router = useRouter()
const { stack } = useStack()
const usage = useDEUsage()
const usagePercent = computed(() => Math.round(100 * usage.progress()))

const query = ref('')
const searched = ref(null) // the query of the results shown, null before any search
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const hideSystem = ref(false)

// Local DEs come 50 a page, straight away; Shared and Synchronized DEs need a folder
// walk, so they load in the background and are slotted in by date (mergeDEPages).
const local = ref([])
const localTotal = ref(0)
const localPage = ref(0)
const shared = ref(null) // null while loading
const sharedError = ref('')
const limit = ref(DE_PAGE_SIZE)
let searchId = 0

const localDone = computed(() => local.value.length >= localTotal.value)
const merged = computed(() => mergeDEPages({ local: local.value, localDone: localDone.value, shared: shared.value || [], limit: limit.value }))
const results = computed(() => merged.value.visible)
const total = computed(() => localTotal.value - merged.value.duplicates + (shared.value?.length || 0))

// Per-DE state, keyed by DE id.
const fields = reactive({}) // id → { status: 'loading' | 'ok' | 'error', list, error }
const paths = reactive({}) // id → { status, path, error }
const expanded = ref(new Set())
const selected = ref(new Map()) // id → { de, fields: Set } in the order first ticked (query building)
const picked = ref(new Set()) // ids of rows ticked for Download and Excel

const shown = computed(() => (hideSystem.value ? results.value.filter((d) => !isSystemDE(d.name)) : results.value))
const canLoadMore = computed(() => searched.value !== null && merged.value.hasMore)
// Exports cover the ticked rows when there are any, else everything shown.
const exportList = computed(() => (picked.value.size ? shown.value.filter((d) => picked.value.has(d.id)) : shown.value))
const allPicked = computed(() => shown.value.length > 0 && shown.value.every((d) => picked.value.has(d.id)))

async function loadLocalPage(id) {
  const r = await searchLocalDEs(stack.value, searched.value, localPage.value + 1)
  if (id !== searchId) return
  const have = new Set(local.value.map((d) => d.id))
  local.value = [...local.value, ...r.items.filter((d) => !have.has(d.id))]
  localTotal.value = r.items.length ? r.total : local.value.length
  localPage.value++
}

async function search() {
  if (!stack.value) { error.value = 'Not connected to Marketing Cloud. Log in to SFMC in this browser.'; return }
  const id = ++searchId
  loading.value = true
  error.value = ''
  sharedError.value = ''
  stopAllFields()
  searched.value = query.value.trim()
  local.value = []
  localTotal.value = 0
  localPage.value = 0
  shared.value = null
  limit.value = DE_PAGE_SIZE
  expanded.value = new Set()
  picked.value = new Set()
  searchSharedSyncDEs(stack.value, searched.value)
    .then((list) => { if (id === searchId) shared.value = list })
    .catch((e) => { if (id === searchId) { shared.value = []; sharedError.value = e.message } })
  try {
    await loadLocalPage(id)
  } catch (e) {
    if (id === searchId) error.value = `Could not search data extensions: ${e.message}`
  } finally {
    if (id === searchId) loading.value = false
  }
}

async function loadMore() {
  const id = searchId
  loadingMore.value = true
  try {
    limit.value += DE_PAGE_SIZE
    while (id === searchId && !localDone.value && local.value.length < limit.value) await loadLocalPage(id)
  } catch (e) {
    showToast(`Could not load more: ${e.message}`)
  } finally {
    loadingMore.value = false
  }
}

function togglePick(id) {
  const next = new Set(picked.value)
  next.has(id) ? next.delete(id) : next.add(id)
  picked.value = next
}
function togglePickAll() {
  picked.value = allPicked.value ? new Set() : new Set(shown.value.map((d) => d.id))
}

function refresh() {
  clearDECaches()
  clearSharedDECache(stack.value)
  clearDEUsageCache(stack.value)
  for (const k of Object.keys(fields)) delete fields[k]
  for (const k of Object.keys(paths)) delete paths[k]
  if (searched.value !== null) search()
}

// ── Fields ───────────────────────────────────────────────
async function loadFields(de) {
  if (fields[de.id]?.status === 'ok' || fields[de.id]?.status === 'loading') return
  fields[de.id] = { status: 'loading' }
  try {
    fields[de.id] = { status: 'ok', list: await fetchDEFieldList(stack.value, de.id) }
  } catch (e) {
    fields[de.id] = { status: 'error', error: e.message }
  }
}

function toggleFields(de) {
  const next = new Set(expanded.value)
  if (next.has(de.id)) next.delete(de.id)
  else { next.add(de.id); loadFields(de) }
  expanded.value = next
}

// View all fields: opens every listed DE, fetching 10 at a time (Automation Viewer).
const allFields = reactive({ running: false, done: 0, total: 0, runId: 0 })
const allShown = computed(() => shown.value.length > 0 && shown.value.every((d) => expanded.value.has(d.id)))

async function viewAllFields() {
  const runId = ++allFields.runId
  const list = shown.value
  expanded.value = new Set(list.map((d) => d.id))
  Object.assign(allFields, { running: true, done: 0, total: list.length })
  await runInBatches(list, 10, (de) => loadFields(de), {
    onProgress: (done) => { if (runId === allFields.runId) allFields.done = done },
    shouldStop: () => runId !== allFields.runId,
  })
  if (runId === allFields.runId) allFields.running = false
}
function stopAllFields() { allFields.runId++; allFields.running = false }
function hideAllFields() { stopAllFields(); expanded.value = new Set() }

// ── Folder paths ─────────────────────────────────────────
async function loadPath(de) {
  if (paths[de.id]?.status === 'ok' || paths[de.id]?.status === 'loading') return
  paths[de.id] = { status: 'loading' }
  try {
    paths[de.id] = { status: 'ok', path: await fetchDEFolderPath(stack.value, de.categoryId) }
  } catch (e) {
    paths[de.id] = { status: 'error', error: e.message }
  }
}
const pathsBusy = ref(false)
async function loadAllPaths() {
  pathsBusy.value = true
  await runInBatches(shown.value, 4, (de) => loadPath(de))
  pathsBusy.value = false
}

// ── Build a query from ticked fields ─────────────────────
function isTicked(de, name) { return !!selected.value.get(de.id)?.fields.has(name) }
function tick(de, name) {
  const next = new Map(selected.value)
  const entry = next.get(de.id) || { de, fields: new Set() }
  const f = new Set(entry.fields)
  f.has(name) ? f.delete(name) : f.add(name)
  if (f.size) next.set(de.id, { de, fields: f }); else next.delete(de.id)
  selected.value = next
}
function tickAll(de) {
  const list = fields[de.id]?.list || []
  const next = new Map(selected.value)
  const all = list.length && list.every((f) => isTicked(de, f.name))
  if (all) next.delete(de.id)
  else next.set(de.id, { de, fields: new Set(list.map((f) => f.name)) })
  selected.value = next
}
const selectedSql = computed(() => buildDESelect([...selected.value.values()].map((s) => ({
  de: s.de.name,
  // Keep the DE's field order, not the order of ticking.
  fields: (fields[s.de.id]?.list || []).map((f) => f.name).filter((n) => s.fields.has(n)),
}))))
const tickedCount = computed(() => [...selected.value.values()].reduce((n, s) => n + s.fields.size, 0))
async function copySql() {
  await navigator.clipboard.writeText(selectedSql.value)
  showToast('SQL copied.')
}
function openInWorkspace() {
  router.push({ path: '/queries/workspace', query: { sql: selectedSql.value } })
}

// ── Exports ──────────────────────────────────────────────
const exportOpen = ref(false)
const exportKind = ref('names')
const exportPaths = ref(false)
const exporting = reactive({ running: false, done: 0, total: 0 })

async function runExcelExport() {
  exportOpen.value = false
  const list = exportList.value
  Object.assign(exporting, { running: true, done: 0, total: list.length })
  try {
    await runInBatches(list, 10, async (de) => {
      if (exportPaths.value) await loadPath(de)
      if (exportKind.value === 'fields') await loadFields(de)
    }, { onProgress: (d) => { exporting.done = d } })
    const date = new Date().toISOString().slice(0, 10)
    const pathOf = (de) => paths[de.id]?.path || ''
    const index = {
      name: exportKind.value === 'fields' ? 'Index' : 'Data Extensions',
      columns: ['DE Name', 'Customer Key', 'ID', 'Source', 'Created', 'Modified', ...(exportPaths.value ? ['Path'] : [])],
      rows: list.map((de) => [de.name, de.customerKey, de.id, de.sourceType || 'local', de.createdDate || '', de.modifiedDate || '', ...(exportPaths.value ? [pathOf(de)] : [])]),
    }
    const sheets = [index]
    if (exportKind.value === 'fields') {
      for (const de of list) {
        const fl = fields[de.id]?.list
        if (!fl?.length) continue
        sheets.push({
          name: de.name,
          columns: ['Field Name', 'Type', 'Length', 'Scale', 'Primary Key', 'Required', 'Read Only', 'Default Value'],
          rows: fl.map((f) => [f.name, f.type || '', f.length ?? '', f.scale ?? '', f.isPrimaryKey ? 'Yes' : 'No', f.isNullable ? 'No' : 'Yes', f.isReadOnly ? 'Yes' : 'No', f.defaultValue ?? '']),
        })
      }
    }
    await downloadWorkbook(sheets, exportKind.value === 'fields' ? `DE_All_Fields_${date}.xlsx` : `DE_Names_${date}.xlsx`)
  } catch (e) {
    showToast(`Export failed: ${e.message}`)
  } finally {
    exporting.running = false
  }
}

// Download menu: a summary table plus the fields of each DE (fetched for up to 200).
async function buildDoc() {
  const list = exportList.value
  await runInBatches(list.slice(0, 200), 10, (de) => loadFields(de))
  return {
    title: picked.value.size ? `${list.length} data extensions` : searched.value ? `Data extensions matching "${searched.value}"` : 'Data extensions',
    blocks: [
      { type: 'table', columns: ['Name', 'Customer Key', 'Source', 'Folder', 'Modified'], rows: list.map((de) => [de.name, de.customerKey, de.sourceType || 'local', paths[de.id]?.path || '', formatDateTime(de.modifiedDate)]) },
      ...list.slice(0, 200).flatMap((de) => [
        { type: 'h', level: 2, text: de.name },
        fields[de.id]?.status === 'ok'
          ? { type: 'table', columns: ['Field', 'Type', 'Primary key', 'Required'], rows: fields[de.id].list.map((f) => [f.name, fieldTypeLabel(f), f.isPrimaryKey ? 'Yes' : '', f.isNullable ? '' : 'Yes']) }
          : { type: 'p', text: `Fields could not be loaded${fields[de.id]?.error ? `: ${fields[de.id].error}` : '.'}` },
      ]),
      ...(list.length > 200 ? [{ type: 'p', text: `Fields are listed for the first 200 of ${list.length} data extensions.` }] : []),
    ],
  }
}

useRouteSearch('/data-extensions', (q) => { query.value = q; whenStack(search) })

const columns = [
  { key: 'pick', label: '', hideable: false, class: 'w-8' },
  { key: 'name', label: 'Name', hideable: false },
  { key: 'customerKey', label: 'Customer key' },
  { key: 'path', label: 'Folder' },
  { key: 'modifiedDate', label: 'Modified', class: 'whitespace-nowrap' },
  { key: 'createdDate', label: 'Created', class: 'whitespace-nowrap' },
  { key: 'id', label: 'ID' },
  { key: 'actions', label: '', hideable: false, class: 'text-right' },
]
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-card">
      <form class="flex items-center gap-2" @submit.prevent="search">
        <div class="relative">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input v-model="query" type="search" placeholder="Data extension name (empty lists all)" aria-label="Data extension name"
            class="h-8 w-72 rounded-md border border-border bg-background pl-7 pr-2 text-xs" />
        </div>
        <Button size="sm" class="h-8 text-xs" type="submit" :disabled="loading">
          <Loader2 v-if="loading" class="h-3.5 w-3.5 mr-1 animate-spin" /> Search
        </Button>
      </form>
      <label class="flex items-center gap-1.5 text-xs text-muted-foreground"><input v-model="hideSystem" type="checkbox" /> Hide system DEs</label>
      <div class="flex-1" />
      <template v-if="searched !== null && shown.length">
        <Button v-if="!allShown && !allFields.running" variant="outline" size="sm" class="h-8 text-xs" @click="viewAllFields"><ListTree class="h-3.5 w-3.5 mr-1" /> View all fields</Button>
        <Button v-else variant="outline" size="sm" class="h-8 text-xs" @click="hideAllFields"><ListTree class="h-3.5 w-3.5 mr-1" /> Hide all fields</Button>
        <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="pathsBusy" @click="loadAllPaths">
          <Loader2 v-if="pathsBusy" class="h-3.5 w-3.5 mr-1 animate-spin" /><FolderTree v-else class="h-3.5 w-3.5 mr-1" /> Get all folders
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="exporting.running" @click="exportOpen = true"><FileSpreadsheet class="h-3.5 w-3.5 mr-1" /> {{ picked.size ? `Excel (${picked.size})` : 'Excel' }}</Button>
        <DownloadMenu :get-doc="buildDoc" :file-name="`data-extensions-${searched || 'all'}`" :label="picked.size ? `Download ${picked.size}` : 'Download'" />
      </template>
      <button v-if="usage.state.de && !usage.state.open" class="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-2 text-xs hover:bg-accent" :title="`Show where ${usage.state.de.name} is used`" @click="usage.state.open = true">
        <Loader2 v-if="usage.state.running" class="h-3.5 w-3.5 animate-spin text-primary" /><Network v-else class="h-3.5 w-3.5" />
        <span class="max-w-28 truncate">{{ usage.state.de.name }}</span>
        <span v-if="usage.state.running" class="text-muted-foreground">{{ usagePercent }}%</span>
      </button>
      <Button variant="ghost" size="icon" class="h-8 w-8" title="Refresh: forget cached fields, folders, the Shared/Synchronized list and the Where used scan" @click="refresh"><RefreshCw class="h-4 w-4" /></Button>
    </div>

    <div v-if="allFields.running || exporting.running" class="px-4 py-1.5 border-b border-border bg-card text-xs text-muted-foreground flex items-center gap-3">
      <span>{{ exporting.running ? 'Preparing the export' : 'Loading fields' }} {{ exporting.running ? exporting.done : allFields.done }} of {{ exporting.running ? exporting.total : allFields.total }}</span>
      <div class="flex-1 h-1.5 rounded bg-muted overflow-hidden" role="progressbar" :aria-valuenow="exporting.running ? exporting.done : allFields.done" :aria-valuemax="exporting.running ? exporting.total : allFields.total">
        <div class="h-full bg-primary transition-all" :style="{ width: `${100 * (exporting.running ? exporting.done / (exporting.total || 1) : allFields.done / (allFields.total || 1))}%` }" />
      </div>
      <button v-if="allFields.running" class="underline" @click="stopAllFields">Stop</button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <p v-if="error" class="mb-3 text-sm text-red-600" role="alert">{{ error }}</p>
      <div v-if="searched === null && !loading" class="max-w-md mx-auto mt-12 text-center text-sm text-muted-foreground">
        Search for a data extension by name. Shared and Synchronized data extensions are included and tagged.
        Search with an empty box to list all, newest first.
      </div>
      <template v-else-if="searched !== null">
        <p class="mb-2 text-xs text-muted-foreground">
          {{ total.toLocaleString() }}{{ shared === null ? '+' : '' }} found{{ searched ? ` for "${searched}"` : '' }}, {{ shown.length }} shown<template v-if="hideSystem && shown.length !== results.length"> ({{ results.length - shown.length }} system DEs hidden)</template>.
          <span v-if="shared === null" class="inline-flex items-center gap-1 ml-1"><Loader2 class="h-3 w-3 animate-spin" /> Adding Shared and Synchronized data extensions…</span>
          <span v-else-if="sharedError" class="ml-1 text-amber-700 dark:text-amber-400">Shared and Synchronized data extensions could not be loaded ({{ sharedError }}).</span>
          <template v-if="picked.size"> {{ picked.size }} ticked for download. <button class="text-primary hover:underline" @click="picked = new Set()">Clear</button></template>
        </p>
        <DataTable :columns="columns" :rows="shown" row-key="id" storage-key="data-extensions" :expanded="expanded" empty-text="No data extensions found.">
          <template #head-pick>
            <input type="checkbox" :checked="allPicked" :indeterminate="picked.size > 0 && !allPicked" aria-label="Tick every data extension shown" @change="togglePickAll" />
          </template>
          <template #cell-pick="{ row }">
            <input type="checkbox" :checked="picked.has(row.id)" :aria-label="`Tick ${row.name} for download`" @change="togglePick(row.id)" />
          </template>
          <template #cell-name="{ row }">
            <span class="font-medium">{{ row.name }}</span>
            <span v-if="row.sourceType" class="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-px"
              :class="row.sourceType === 'shared' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'">
              {{ row.sourceType === 'shared' ? 'Shared' : 'Synchronized' }}
            </span>
          </template>
          <template #cell-path="{ row }">
            <span v-if="paths[row.id]?.status === 'ok'">{{ paths[row.id].path || '(root)' }}</span>
            <Loader2 v-else-if="paths[row.id]?.status === 'loading'" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span v-else-if="paths[row.id]?.status === 'error'" class="text-red-600" :title="paths[row.id].error">Could not load</span>
            <button v-else class="text-primary hover:underline" @click="loadPath(row)">Get folder</button>
          </template>
          <template #cell-modifiedDate="{ row }">{{ formatDateTime(row.modifiedDate) }}</template>
          <template #cell-createdDate="{ row }">{{ formatDateTime(row.createdDate) }}</template>
          <template #cell-id="{ row }"><code class="text-[11px]">{{ row.id }}</code></template>
          <template #cell-actions="{ row }">
            <button class="inline-flex items-center gap-1 text-primary hover:underline whitespace-nowrap mr-3" title="Query activities and automations that use this data extension" @click="usage.start(stack, row)">
              <Network class="h-3.5 w-3.5" /> Where used
            </button>
            <button class="inline-flex items-center gap-1 text-primary hover:underline whitespace-nowrap" :aria-expanded="expanded.has(row.id)" @click="toggleFields(row)">
              <ChevronDown v-if="expanded.has(row.id)" class="h-3.5 w-3.5" /><ChevronRight v-else class="h-3.5 w-3.5" /> Fields
            </button>
          </template>
          <template #expanded="{ row }">
            <div v-if="fields[row.id]?.status === 'loading'" class="flex items-center gap-2 text-muted-foreground"><Loader2 class="h-3.5 w-3.5 animate-spin" /> Loading fields…</div>
            <p v-else-if="fields[row.id]?.status === 'error'" class="text-red-600">Could not load the fields: {{ fields[row.id].error }}</p>
            <div v-else-if="fields[row.id]?.status === 'ok'">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="font-semibold">{{ fields[row.id].list.length }} {{ fields[row.id].list.length === 1 ? 'field' : 'fields' }}</span>
                <button class="text-primary hover:underline" @click="tickAll(row)">
                  {{ fields[row.id].list.length && fields[row.id].list.every((f) => isTicked(row, f.name)) ? 'Untick all' : 'Tick all for a query' }}
                </button>
              </div>
              <table class="w-full max-w-3xl">
                <thead><tr class="text-left text-muted-foreground"><th class="w-6"></th><th class="py-1 pr-3">Field</th><th class="pr-3">Type</th><th class="pr-3">Primary key</th><th class="pr-3">Required</th><th>Default</th></tr></thead>
                <tbody>
                  <tr v-for="f in fields[row.id].list" :key="f.name" class="border-t border-border/60">
                    <td><input type="checkbox" :checked="isTicked(row, f.name)" :aria-label="`Use ${f.name} in a query`" @change="tick(row, f.name)" /></td>
                    <td class="py-1 pr-3" :class="{ 'font-semibold': f.isPrimaryKey }">{{ f.name }}</td>
                    <td class="pr-3">{{ fieldTypeLabel(f) }}</td>
                    <td class="pr-3">{{ f.isPrimaryKey ? 'Yes' : '' }}</td>
                    <td class="pr-3">{{ f.isNullable ? '' : 'Yes' }}</td>
                    <td class="text-muted-foreground">{{ f.defaultValue ?? '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </DataTable>
        <div v-if="canLoadMore" class="mt-3 text-center">
          <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="h-3.5 w-3.5 mr-1 animate-spin" /> Load {{ DE_PAGE_SIZE }} more
          </Button>
        </div>
      </template>
    </div>

    <!-- Query from ticked fields -->
    <div v-if="tickedCount" class="border-t border-border bg-card px-4 py-2">
      <div class="flex items-center gap-2 mb-1.5 text-xs">
        <span class="font-semibold">Query from {{ tickedCount }} ticked {{ tickedCount === 1 ? 'field' : 'fields' }}</span>
        <div class="flex-1" />
        <Button size="sm" class="h-7 text-xs" @click="openInWorkspace"><Play class="h-3.5 w-3.5 mr-1" /> Run this query</Button>
        <Button variant="outline" size="sm" class="h-7 text-xs" @click="copySql"><Copy class="h-3.5 w-3.5 mr-1" /> Copy</Button>
        <Button variant="ghost" size="sm" class="h-7 text-xs" @click="selected = new Map()"><X class="h-3.5 w-3.5 mr-1" /> Clear</Button>
      </div>
      <pre class="max-h-40 overflow-auto rounded-md bg-slate-900 text-slate-100 p-2 text-[11px]">{{ selectedSql }}</pre>
    </div>

    <DEUsagePanel />

    <!-- Excel export -->
    <div v-if="exportOpen" class="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" @mousedown.self="exportOpen = false">
      <div class="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl text-sm" role="dialog" aria-modal="true" aria-labelledby="de-export-title">
        <h2 id="de-export-title" class="font-semibold mb-3">Export {{ exportList.length }} {{ picked.size ? 'ticked' : '' }} data extensions to Excel</h2>
        <label class="flex items-start gap-2 mb-2"><input v-model="exportKind" type="radio" value="names" class="mt-1" /><span>Names only<br /><span class="text-xs text-muted-foreground">One sheet: name, customer key, ID, source, dates.</span></span></label>
        <label class="flex items-start gap-2 mb-3"><input v-model="exportKind" type="radio" value="fields" class="mt-1" /><span>All fields<br /><span class="text-xs text-muted-foreground">An index sheet plus one sheet of fields per data extension.</span></span></label>
        <label class="flex items-center gap-2 mb-4"><input v-model="exportPaths" type="checkbox" /> Include folder paths</label>
        <div class="flex justify-end gap-2">
          <Button variant="outline" size="sm" class="h-8 text-xs" @click="exportOpen = false">Cancel</Button>
          <Button size="sm" class="h-8 text-xs" @click="runExcelExport">Export</Button>
        </div>
      </div>
    </div>
  </div>
</template>

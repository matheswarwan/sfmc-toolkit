<script setup>
// The rows of one data extension (feedback #117), read straight from SFMC: no query
// activity, no results DE. 50 at a time, Load all up to 50,000 with Stop; filter and
// hide columns on what is loaded; CSV, Markdown, Copy for AI (ResultsTable) and Excel.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { X, Loader2, Search, Columns3, FileSpreadsheet } from 'lucide-vue-next'
import ResultsTable from '@/components/detail/ResultsTable.vue'
import SfmcErrorNotice from '@/components/results/SfmcErrorNotice.vue'
import Button from '@/components/ui/button/Button.vue'
import { withReconnect, searchError } from '@/utils/sfmcErrors.js'
import { fetchDEFieldList } from '@/utils/deApi.js'
import { fetchRowsAt, loadRemainingRows, columnsFor, filterRows, ROWS_PAGE, LOAD_ALL_LIMIT } from '@/utils/deRows.js'
import { downloadWorkbook } from '@/utils/exportDoc.js'
import { exportBaseName } from '@/utils/exportName.js'
import { showToast } from '@/composables/useToast.js'

const props = defineProps({
  stack: { type: String, required: true },
  de: { type: Object, required: true }, // { id, name, customerKey, sourceType }
})
const emit = defineEmits(['close'])

const fieldNames = ref([])
const rows = ref([])
const total = ref(null)
const done = ref(false) // SFMC has no rows after the ones loaded
const loading = ref(false)
const all = ref({ running: false, stop: false })
const error = ref('')
const filter = ref('')
const hidden = ref(new Set())
const columnsOpen = ref(false)

const columns = computed(() => columnsFor(fieldNames.value, rows.value.slice(0, 50)))
const shownColumns = computed(() => columns.value.filter((c) => !hidden.value.has(c)))
const shownRows = computed(() => filterRows(rows.value, shownColumns.value, filter.value))
const knownTotal = computed(() => total.value ?? rows.value.length)
const more = computed(() => !done.value && (total.value == null || rows.value.length < total.value))
const busy = computed(() => loading.value || all.value.running)

function fail(e) {
  const info = searchError(e, 'read the rows')
  if (!info.connection && props.de.sourceType) {
    info.message += ` ${props.de.sourceType === 'shared' ? 'Shared' : 'Synchronized'} data extensions may only be readable from the business unit that owns them.`
  }
  error.value = info
}

function add(page, t) {
  rows.value = rows.value.concat(page)
  if (t != null) total.value = t
}

async function loadMore() {
  if (busy.value) return
  loading.value = true
  error.value = ''
  try {
    const r = await withReconnect(props.stack, () => fetchRowsAt(props.stack, props.de.customerKey, rows.value.length, ROWS_PAGE, fieldNames.value))
    add(r.rows, r.total)
    if (r.last) done.value = true
  } catch (e) {
    fail(e)
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  if (busy.value) return
  all.value = { running: true, stop: false }
  error.value = ''
  try {
    await withReconnect(props.stack, () => loadRemainingRows({
      stack: props.stack, key: props.de.customerKey, have: rows.value.length, columnNames: fieldNames.value,
      limit: LOAD_ALL_LIMIT, onRows: add, shouldStop: () => all.value.stop,
    }))
    if (!all.value.stop && (total.value == null || rows.value.length >= total.value)) done.value = true
  } catch (e) {
    fail(e)
  } finally {
    all.value = { running: false, stop: false }
  }
}

async function start() {
  try {
    fieldNames.value = (await fetchDEFieldList(props.stack, props.de.id)).map((f) => f.name)
  } catch { /* the rows still give the column names */ }
  await loadMore()
}

function toggleColumn(c) {
  const next = new Set(hidden.value)
  next.has(c) ? next.delete(c) : next.add(c)
  hidden.value = next
}

async function downloadExcel() {
  try {
    const cols = shownColumns.value
    await downloadWorkbook([{ name: props.de.name || 'Rows', columns: cols, rows: shownRows.value.map((r) => cols.map((c) => r[c] ?? '')) }],
      `${await exportBaseName(props.stack, `de-${props.de.name || 'rows'}`)}.xlsx`)
  } catch (e) {
    showToast(`Export failed: ${e.message}`)
  }
}

const onKey = (e) => { if (e.key === 'Escape' && !columnsOpen.value) emit('close') }
onMounted(() => { document.addEventListener('keydown', onKey); start() })
onUnmounted(() => { all.value.stop = true; document.removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="fixed inset-0 z-120 flex items-center justify-center bg-black/40 p-4" @mousedown.self="emit('close')">
    <div class="w-full max-w-6xl h-[85vh] flex flex-col rounded-lg border border-border bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="de-rows-title">
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <h2 id="de-rows-title" class="text-sm font-semibold truncate">Rows of {{ de.name }}</h2>
        <span v-if="de.sourceType" class="text-[10px] font-semibold rounded-full px-1.5 py-px bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">{{ de.sourceType === 'shared' ? 'Shared' : 'Synchronized' }}</span>
        <span class="text-xs text-muted-foreground">Read from SFMC; no query is run.</span>
        <div class="flex-1" />
        <button class="p-1 rounded hover:bg-accent" title="Close" aria-label="Close" @click="emit('close')"><X class="h-4 w-4" /></button>
      </div>

      <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border text-xs">
        <span class="tabular-nums">{{ rows.length.toLocaleString() }} of {{ knownTotal.toLocaleString() }}{{ total == null && more ? '+' : '' }} rows loaded</span>
        <template v-if="more">
          <Button variant="outline" size="sm" class="h-7 text-[11px]" :disabled="busy" @click="loadMore">
            <Loader2 v-if="loading" class="h-3 w-3 mr-1 animate-spin" /> Load {{ ROWS_PAGE }} more
          </Button>
          <Button v-if="!all.running" variant="outline" size="sm" class="h-7 text-[11px]" :disabled="busy" @click="loadAll"
            :title="`Loads up to ${LOAD_ALL_LIMIT.toLocaleString()} rows; export the data extension in SFMC for more`">
            Load all{{ knownTotal > LOAD_ALL_LIMIT ? ` (up to ${LOAD_ALL_LIMIT.toLocaleString()})` : '' }}
          </Button>
          <template v-else>
            <div class="w-40 h-1.5 rounded bg-muted overflow-hidden" role="progressbar" :aria-valuenow="rows.length" :aria-valuemax="Math.min(knownTotal, LOAD_ALL_LIMIT)">
              <div class="h-full bg-primary transition-all" :style="{ width: `${100 * rows.length / (Math.min(knownTotal, LOAD_ALL_LIMIT) || 1)}%` }" />
            </div>
            <button class="underline" @click="all.stop = true">Stop</button>
          </template>
        </template>
        <div class="flex-1" />
        <div class="relative">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input v-model="filter" type="search" placeholder="Filter loaded rows" aria-label="Filter loaded rows"
            class="h-7 w-52 rounded-md border border-border bg-background pl-7 pr-2 text-xs" />
        </div>
        <div class="relative">
          <button class="flex items-center gap-1 h-7 px-2 rounded border border-border hover:bg-accent" :aria-expanded="columnsOpen" @click="columnsOpen = !columnsOpen">
            <Columns3 class="h-3.5 w-3.5" /> Columns{{ hidden.size ? ` (${hidden.size} hidden)` : '' }}
          </button>
          <template v-if="columnsOpen">
            <div class="fixed inset-0 z-30" @click="columnsOpen = false" />
            <div class="absolute right-0 top-8 z-40 w-56 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1">
              <label v-for="c in columns" :key="c" class="flex items-center gap-2 px-3 py-1 hover:bg-accent cursor-pointer">
                <input type="checkbox" :checked="!hidden.has(c)" @change="toggleColumn(c)" /> {{ c }}
              </label>
            </div>
          </template>
        </div>
        <Button variant="outline" size="sm" class="h-7 text-xs gap-1.5" :disabled="!shownColumns.length" @click="downloadExcel"><FileSpreadsheet class="h-3 w-3" /> Excel</Button>
      </div>

      <div v-if="error" class="px-4 pt-3"><SfmcErrorNotice :error="error" :retrying="busy" @retry="rows.length ? loadMore() : start()" /></div>
      <p v-if="filter && rows.length" class="px-4 pt-2 text-xs text-muted-foreground">{{ shownRows.length.toLocaleString() }} of the {{ rows.length.toLocaleString() }} loaded rows match. Downloads use the rows and columns shown.</p>
      <div v-if="loading && !rows.length" class="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"><Loader2 class="h-4 w-4 animate-spin" /> Reading rows…</div>
      <ResultsTable v-else :rows="shownRows" :columns="shownColumns" :filename="de.name" file-prefix="de" :total-count="filter ? null : knownTotal" />
    </div>
  </div>
</template>

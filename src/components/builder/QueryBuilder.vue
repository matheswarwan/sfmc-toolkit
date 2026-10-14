<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { LayoutGrid, List, Check, Loader2, PanelRight, PanelBottom, EyeOff, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-vue-next'
import DEBrowser from './DEBrowser.vue'
import SelectedDEsPanel from './SelectedDEsPanel.vue'
import SqlOutput from './SqlOutput.vue'
import JoinCanvas from './JoinCanvas.vue'
import WhereBuilder from './WhereBuilder.vue'
import QueryOptions from './QueryOptions.vue'
import { useStack } from '@/composables/useStack.js'
import { saveBuilderRecord, defaultQueryOptions } from '@/utils/builderStorage.js'
import { resolveGraphTables, fieldOptionsFromTables } from '@/utils/sqlBuilder.js'

const props = defineProps({
  // A saved Query Builder record to open, or null for a new query.
  openId: { type: String, default: null },
})
const emit = defineEmits(['saved'])

const { stack } = useStack()
const visualMode = ref(false)
const selectedDEs = ref([])
const joins = ref([])
const where = ref({ combinator: 'AND', conditions: [] })
const queryOptions = ref(defaultQueryOptions())
const generatedSql = ref('')
const graphNodes = ref([])
const graphEdges = ref([])
const recordId = ref(null)
const restoreNotice = ref('')

// Visual-mode "Filters & options" drawer.
const showVisualExtras = ref(false)
const visualFieldOptions = computed(() =>
  fieldOptionsFromTables(resolveGraphTables(graphNodes.value, graphEdges.value))
)

// Autosave state
const AUTOSAVE_IDLE_MS = 3000
const saveStatus = ref('') // '' | 'pending' | 'saving' | 'saved'
const lastSavedAt = ref(0)
let restoring = false
let autosaveTimer = null

const selectedPanelRef = ref(null)
const joinCanvasRef = ref(null)

// SQL panel docking, remembered per mode: list defaults right, visual defaults bottom.
const DOCK_KEY = 'qb_sql_dock_v2'
const VALID_DOCKS = ['right', 'bottom', 'hidden']
const dockPrefs = ref({ list: 'right', visual: 'bottom' })
try {
  const saved = JSON.parse(localStorage.getItem(DOCK_KEY) || '{}')
  if (VALID_DOCKS.includes(saved.list)) dockPrefs.value.list = saved.list
  if (VALID_DOCKS.includes(saved.visual)) dockPrefs.value.visual = saved.visual
} catch { /* ignore */ }
const sqlDock = computed(() => (visualMode.value ? dockPrefs.value.visual : dockPrefs.value.list))
function setDock(v) {
  dockPrefs.value = { ...dockPrefs.value, [visualMode.value ? 'visual' : 'list']: v }
  try { localStorage.setItem(DOCK_KEY, JSON.stringify(dockPrefs.value)) } catch { /* ignore */ }
}

// Resizable SQL panel — width (%) when docked right, height (%) when bottom.
const SIZE_KEY = 'qb_sql_size_v1'
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const sqlSize = ref({ right: 38, bottom: 40 })
try {
  const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || '{}')
  if (typeof saved.right === 'number') sqlSize.value.right = clamp(saved.right, 20, 75)
  if (typeof saved.bottom === 'number') sqlSize.value.bottom = clamp(saved.bottom, 15, 80)
} catch { /* ignore */ }

const rowRef = ref(null)
const stackRef = ref(null)
let activeResize = null

function startResize(kind, e) {
  e.preventDefault()
  const el = kind === 'right' ? rowRef.value : stackRef.value
  if (!el) return
  activeResize = { kind, rect: el.getBoundingClientRect() }
  document.body.style.userSelect = 'none'
  document.body.style.cursor = kind === 'right' ? 'col-resize' : 'row-resize'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', endResize)
}

function onResizeMove(e) {
  if (!activeResize) return
  const { kind, rect } = activeResize
  if (kind === 'right') {
    const pct = ((rect.right - e.clientX) / rect.width) * 100
    sqlSize.value = { ...sqlSize.value, right: clamp(pct, 20, 75) }
  } else {
    const pct = ((rect.bottom - e.clientY) / rect.height) * 100
    sqlSize.value = { ...sqlSize.value, bottom: clamp(pct, 15, 80) }
  }
}

function endResize() {
  activeResize = null
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  try { localStorage.setItem(SIZE_KEY, JSON.stringify(sqlSize.value)) } catch { /* ignore */ }
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', endResize)
}

// Restoring a saved record does not depend on the SFMC connection.
onMounted(() => { if (props.openId) loadRecord(props.openId) })

function loadRecord(id) {
  restoring = true
  chrome.storage.local.get(id, (data) => {
    const rec = data[id]
    if (!rec) {
      restoreNotice.value = `No saved record found for "${id}".`
      restoring = false
      return
    }
    recordId.value = id
    const bs = rec.builderState
    const deCount = bs?.selectedDEs?.length || 0
    console.log('[QueryBuilder] loadRecord', id, {
      source: rec.source,
      hasBuilderState: !!bs,
      selectedDEs: deCount,
    })
    if (!bs) {
      restoreNotice.value =
        'This query was saved before the visual builder captured its configuration. ' +
        'Rebuild it here and click Save to enable editing next time.'
      restoring = false
      return
    }
    if (!deCount) {
      restoreNotice.value = 'This saved query has no data extensions to restore.'
    }
    visualMode.value = !!bs.visualMode
    graphNodes.value = bs.graphNodes || []
    graphEdges.value = bs.graphEdges || []
    applyBuilderState(bs)
  })
}

async function applyBuilderState(bs, attempts = 0) {
  await nextTick()
  if (selectedPanelRef.value?.loadState) {
    try {
      selectedPanelRef.value.loadState(bs)
    } catch (e) {
      console.error('[QueryBuilder] failed to restore builder state', e)
      restoreNotice.value = 'This saved query could not be fully restored (unexpected data format).'
    }
    // Let the restored state's reactive emits settle before re-enabling autosave.
    await nextTick()
    restoring = false
  } else if (attempts < 10) {
    setTimeout(() => applyBuilderState(bs, attempts + 1), 50)
  } else {
    restoring = false
  }
}

async function doAutosave() {
  if (!selectedDEs.value.length && !recordId.value) return
  saveStatus.value = 'saving'
  try {
    const id = await saveBuilderRecord({
      id: recordId.value,
      sql: generatedSql.value,
      state: {
        selectedDEs: selectedDEs.value,
        joins: joins.value,
        where: where.value,
        queryOptions: queryOptions.value,
        visualMode: visualMode.value,
        graphNodes: graphNodes.value,
        graphEdges: graphEdges.value,
      },
    })
    if (id !== recordId.value) emit('saved', id)
    recordId.value = id
    lastSavedAt.value = Date.now()
    saveStatus.value = 'saved'
  } catch (e) {
    console.error('[QueryBuilder] autosave failed', e)
    saveStatus.value = ''
  }
}

// Debounced autosave: fires after AUTOSAVE_IDLE_MS of no changes.
watch(
  [selectedDEs, joins, where, queryOptions, generatedSql, visualMode, graphNodes, graphEdges],
  () => {
    if (restoring) return
    if (!selectedDEs.value.length && !recordId.value) return
    saveStatus.value = 'pending'
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(doAutosave, AUTOSAVE_IDLE_MS)
  },
  { deep: true }
)

const saveStatusLabel = computed(() => {
  switch (saveStatus.value) {
    case 'pending': return 'Editing…'
    case 'saving': return 'Saving…'
    case 'saved': return 'All changes saved'
    default: return ''
  }
})

function onManualSave(id) {
  if (id !== recordId.value) emit('saved', id)
  recordId.value = id
}

async function onSelectDe(node) {
  await selectedPanelRef.value?.addDe(node)
  if (visualMode.value) {
    const de = selectedDEs.value.find((d) => d.id === node.id)
    if (de) joinCanvasRef.value?.addNode(de)
  }
}

// A DE was dropped directly onto the canvas — the canvas already placed the
// node; mirror it into the list panel so both views stay in sync.
function onCanvasDropDe(node) {
  selectedPanelRef.value?.addDe(node)
}
</script>

<template>
  <div class="flex flex-col h-full bg-background">
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0">
      <span class="text-[10px] font-bold uppercase tracking-wide bg-amber-200 text-amber-900 rounded-full px-2 py-0.5">Experimental</span>
      <span v-if="saveStatusLabel" class="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 v-if="saveStatus === 'saving'" class="h-3 w-3 animate-spin" />
        <Check v-else-if="saveStatus === 'saved'" class="h-3 w-3 text-emerald-600" />
        {{ saveStatusLabel }}
      </span>
      <div class="flex-1" />
      <slot name="actions" />
      <!-- SQL panel dock controls -->
        <div class="flex items-center gap-0.5 border border-border rounded-md p-0.5">
          <button class="p-1 rounded" title="Dock SQL right"
            :class="sqlDock === 'right' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            @click="setDock('right')"><PanelRight class="h-3.5 w-3.5" /></button>
          <button class="p-1 rounded" title="Dock SQL bottom"
            :class="sqlDock === 'bottom' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            @click="setDock('bottom')"><PanelBottom class="h-3.5 w-3.5" /></button>
          <button class="p-1 rounded" title="Hide SQL"
            :class="sqlDock === 'hidden' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            @click="setDock('hidden')"><EyeOff class="h-3.5 w-3.5" /></button>
        </div>

        <div class="flex items-center gap-1 border border-border rounded-md p-0.5">
          <button
            class="flex items-center gap-1 text-[10px] px-2 py-1 rounded"
            :class="!visualMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            @click="visualMode = false"
          ><List class="h-3 w-3" /> List</button>
          <button
            class="flex items-center gap-1 text-[10px] px-2 py-1 rounded"
            :class="visualMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
            @click="visualMode = true"
          ><LayoutGrid class="h-3 w-3" /> Visual</button>
        </div>
    </div>

    <div v-if="restoreNotice" class="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 flex-shrink-0">
      <span>{{ restoreNotice }}</span>
      <button class="ml-auto text-amber-700 hover:underline" @click="restoreNotice = ''">Dismiss</button>
    </div>

    <div ref="stackRef" class="flex-1 flex flex-col min-h-0">
      <div ref="rowRef" class="flex-1 flex min-h-0">
        <!-- Left: DE Browser -->
        <div class="w-64 flex-shrink-0 min-h-0">
          <DEBrowser :stack="stack" @select-de="onSelectDe" />
        </div>

        <!-- Center: List or Visual -->
        <div class="flex-1 flex flex-col min-w-0 min-h-0 border-r border-border">
          <SelectedDEsPanel
            v-show="!visualMode"
            ref="selectedPanelRef"
            :stack="stack"
            v-model:selected="selectedDEs"
            v-model:where="where"
            v-model:queryOptions="queryOptions"
            @update:joins="joins = $event"
          />

          <!-- Visual mode: Filters & options drawer + canvas -->
          <template v-if="visualMode">
            <div class="border-b border-border flex-shrink-0">
              <button
                class="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                @click="showVisualExtras = !showVisualExtras"
              >
                <ChevronDown v-if="showVisualExtras" class="h-3.5 w-3.5" />
                <ChevronRight v-else class="h-3.5 w-3.5" />
                <SlidersHorizontal class="h-3.5 w-3.5" />
                <span>Filters &amp; options</span>
                <span
                  v-if="where.conditions.length"
                  class="ml-1 text-[9px] px-1.5 rounded-full bg-primary/15 text-primary normal-case"
                >{{ where.conditions.length }} filter{{ where.conditions.length === 1 ? '' : 's' }}</span>
              </button>
              <div v-show="showVisualExtras" class="max-h-[45vh] overflow-y-auto px-3 pb-3 space-y-3">
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Filters (WHERE)</div>
                  <WhereBuilder :field-options="visualFieldOptions" v-model="where" />
                </div>
                <div class="border-t border-border pt-2">
                  <QueryOptions :field-options="visualFieldOptions" v-model="queryOptions" />
                </div>
              </div>
            </div>
            <JoinCanvas
              ref="joinCanvasRef"
              class="flex-1 min-h-0"
              :stack="stack"
              :nodes="graphNodes"
              :edges="graphEdges"
              @update:nodes="graphNodes = $event"
              @update:edges="graphEdges = $event"
              @add-de="onCanvasDropDe"
            />
          </template>
        </div>

        <!-- Right dock: SQL output (drag left edge to resize) -->
        <div v-if="sqlDock === 'right'" class="relative flex-shrink-0 min-h-0 border-l border-border" :style="{ width: sqlSize.right + '%' }">
          <div
            class="absolute left-0 top-0 h-full w-1.5 -ml-0.5 z-20 cursor-col-resize transition-colors hover:bg-primary/40 active:bg-primary/60"
            title="Drag to resize"
            @mousedown="startResize('right', $event)"
          />
          <SqlOutput
            v-model:sql="generatedSql"
            :selectedDEs="selectedDEs" :joins="joins" :where="where" :query-options="queryOptions"
            :visual-mode="visualMode" :graph-nodes="graphNodes" :graph-edges="graphEdges"
            :record-id="recordId" @saved="onManualSave"
          />
        </div>
      </div>

      <!-- Bottom dock: SQL output (drag top edge to resize) -->
      <div v-if="sqlDock === 'bottom'" class="relative flex-shrink-0 min-h-0 border-t border-border" :style="{ height: sqlSize.bottom + '%' }">
        <div
          class="absolute top-0 left-0 w-full h-1.5 -mt-0.5 z-20 cursor-row-resize transition-colors hover:bg-primary/40 active:bg-primary/60"
          title="Drag to resize"
          @mousedown="startResize('bottom', $event)"
        />
        <SqlOutput
          v-model:sql="generatedSql"
          :selectedDEs="selectedDEs" :joins="joins" :where="where" :query-options="queryOptions"
          :visual-mode="visualMode" :graph-nodes="graphNodes" :graph-edges="graphEdges"
          :record-id="recordId" @saved="onManualSave"
        />
      </div>
    </div>
  </div>
</template>

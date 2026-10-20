<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Loader2, KeyRound, Type, Hash, Calendar, Mail, Phone, ToggleLeft, Globe, X, Plus, Code2, Check,
} from 'lucide-vue-next'
import { fetchDEFieldsCached } from '../../utils/sfmcApi.js'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  stack: { type: String, default: null },
})

const emit = defineEmits(['update:nodes', 'update:edges', 'add-de'])

const localNodes = ref([])
const edges = ref([])
const pending = ref(null) // { nodeId, field } — first-clicked field awaiting a target
const openEditor = ref(null) // edgeId whose ON editor is open

const canvasRef = ref(null)
const NODE_W = 200

const fieldsMap = ref({}) // id -> { fields: [], loading: bool }
const nodeEls = {}        // nodeId -> card el

const JOIN_TYPES = [
  { value: 'INNER JOIN', label: 'Inner' },
  { value: 'LEFT JOIN', label: 'Left' },
  { value: 'RIGHT JOIN', label: 'Right' },
  { value: 'FULL OUTER JOIN', label: 'Full outer' },
]
const OPERATORS = ['=', '<>', '>', '<', '>=', '<=']

const canvasNodes = computed({
  get: () => props.nodes.length ? props.nodes : localNodes.value,
  set: (v) => { localNodes.value = v; emit('update:nodes', v) },
})

watch(() => props.nodes, (n) => {
  if (n?.length) localNodes.value = n.map((item, i) => ({
    id: item.id,
    x: 40 + (i % 3) * 240,
    y: 40 + Math.floor(i / 3) * 240,
    data: item,
  }))
}, { immediate: true, deep: true })

// Adopt restored edges from the parent. Only replace local edges when the set
// of edge ids actually differs (i.e. on restore / structural change) so local
// condition edits aren't clobbered by the round-trip emit → prop update.
function edgeIdSig(list) {
  return (list || []).map((e) => e.id).sort().join('|')
}
watch(() => props.edges, (incoming) => {
  if (edgeIdSig(incoming) === edgeIdSig(edges.value)) return
  edges.value = (incoming || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: {
      joinType: e.data?.joinType || 'INNER JOIN',
      combinator: e.data?.combinator || 'AND',
      rawOn: !!e.data?.rawOn,
      onClause: e.data?.onClause || '',
      conditions: Array.isArray(e.data?.conditions) ? e.data.conditions.map((c) => ({ ...c })) : [],
    },
  }))
  scheduleRecompute()
}, { immediate: true })

// ── Field loading ─────────────────────────────────────────
async function loadFieldsForNode(node) {
  const id = node.id
  const existing = node.data?.fields
  if (existing?.length) {
    fieldsMap.value = { ...fieldsMap.value, [id]: { fields: existing, loading: false } }
    scheduleRecompute(); return
  }
  if (fieldsMap.value[id]?.fields || fieldsMap.value[id]?.loading) return
  if (!props.stack) return
  fieldsMap.value = { ...fieldsMap.value, [id]: { fields: [], loading: true } }
  try {
    const data = await fetchDEFieldsCached(props.stack, id)
    fieldsMap.value = { ...fieldsMap.value, [id]: { fields: data?.fields || [], loading: false } }
  } catch {
    fieldsMap.value = { ...fieldsMap.value, [id]: { fields: [], loading: false } }
  }
  scheduleRecompute()
}
function fieldsFor(id) { return fieldsMap.value[id]?.fields || [] }
function fieldNames(id) { return fieldsFor(id).map((f) => f.name) }
function fieldsLoading(id) { return !!fieldsMap.value[id]?.loading }

watch(
  [canvasNodes, () => props.stack],
  () => { canvasNodes.value.forEach(loadFieldsForNode); scheduleRecompute() },
  { immediate: true, deep: true }
)

// ── Field type icons ──────────────────────────────────────
function typeIcon(f) {
  const t = String(f?.type ?? f?.fieldType ?? '').toLowerCase()
  if (t.includes('email')) return Mail
  if (t.includes('phone')) return Phone
  if (t.includes('date')) return Calendar
  if (t.includes('bool')) return ToggleLeft
  if (t.includes('number') || t.includes('decimal') || t.includes('int')) return Hash
  if (t.includes('locale')) return Globe
  return Type
}
function isKey(f) { return !!(f?.isPrimaryKey || f?.isKey || f?.primaryKey) }

// ── Nodes ─────────────────────────────────────────────────
function addNodeAt(de, x, y) {
  const id = de.id
  if (canvasNodes.value.find((n) => n.id === id)) return false
  const px = x ?? (40 + (canvasNodes.value.length % 3) * 240)
  const py = y ?? (40 + Math.floor(canvasNodes.value.length / 3) * 240)
  const next = [...canvasNodes.value, { id, x: px, y: py, data: de }]
  canvasNodes.value = next
  emit('update:nodes', next)
  return true
}
function addNode(de) { return addNodeAt(de, null, null) }
defineExpose({ addNode })

// ── Drag & drop from the DE browser ───────────────────────
const dropHover = ref(false)
function onDragOver(e) {
  if (Array.from(e.dataTransfer?.types || []).includes('application/x-sfmc-de')) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    dropHover.value = true
  }
}
function onDragLeave(e) {
  if (e.target === canvasRef.value) dropHover.value = false
}
function onDrop(e) {
  dropHover.value = false
  const raw = e.dataTransfer?.getData('application/x-sfmc-de')
  if (!raw) return
  e.preventDefault()
  let de
  try { de = JSON.parse(raw) } catch { return }
  if (!de?.id) return
  const cr = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - cr.left + canvasRef.value.scrollLeft - NODE_W / 2
  const y = e.clientY - cr.top + canvasRef.value.scrollTop - 16
  const added = addNodeAt(de, Math.max(0, x), Math.max(0, y))
  if (added) emit('add-de', de)
  scheduleRecompute()
}

function removeNode(id) {
  canvasNodes.value = canvasNodes.value.filter((n) => n.id !== id)
  edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
  if (pending.value?.nodeId === id) pending.value = null
  emitEdges()
  emit('update:nodes', canvasNodes.value)
  scheduleRecompute()
}

// ── Quick field-to-field connect ──────────────────────────
function isPending(nodeId, field) {
  return pending.value?.nodeId === nodeId && pending.value?.field === field
}
function onFieldClick(nodeId, field) {
  if (!pending.value) { pending.value = { nodeId, field }; return }
  if (pending.value.nodeId === nodeId) {
    pending.value = pending.value.field === field ? null : { nodeId, field }
    return
  }
  addCondition(pending.value.nodeId, pending.value.field, nodeId, field)
  pending.value = null
}
function addCondition(sourceId, leftField, targetId, rightField) {
  const edge = edges.value.find(
    (e) => (e.source === sourceId && e.target === targetId) ||
           (e.source === targetId && e.target === sourceId)
  )
  if (edge) {
    const lf = edge.source === sourceId ? leftField : rightField
    const rf = edge.source === sourceId ? rightField : leftField
    edge.data.conditions.push({ leftField: lf, operator: '=', rightField: rf, conn: 'AND' })
    edges.value = [...edges.value]
  } else {
    edges.value = [...edges.value, {
      id: `${sourceId}__${targetId}`,
      source: sourceId,
      target: targetId,
      data: { joinType: 'INNER JOIN', combinator: 'AND', rawOn: false, onClause: '',
        conditions: [{ leftField, operator: '=', rightField, conn: 'AND' }] },
    }]
  }
  emitEdges(); scheduleRecompute()
}

// ── Edge / ON editor ──────────────────────────────────────
function emitEdges() { emit('update:edges', edges.value) }
function findEdge(id) { return edges.value.find((e) => e.id === id) }
const editorEdge = computed(() => (openEditor.value ? findEdge(openEditor.value) : null))
function nodeName(id) { return canvasNodes.value.find((n) => n.id === id)?.data?.name || id }
const labelSrc = computed(() => (editorEdge.value ? nodeName(editorEdge.value.source) : ''))
const labelTgt = computed(() => (editorEdge.value ? nodeName(editorEdge.value.target) : ''))

function setJoinType(id, v) { const e = findEdge(id); if (e) { e.data.joinType = v; edges.value = [...edges.value]; emitEdges() } }
function setRaw(id, on) { const e = findEdge(id); if (e) { e.data.rawOn = on; edges.value = [...edges.value]; emitEdges() } }
function setRawOn(id, text) { const e = findEdge(id); if (e) { e.data.onClause = text; edges.value = [...edges.value]; emitEdges() } }
function addRow(id) {
  const e = findEdge(id); if (!e) return
  e.data.conditions.push({ leftField: '', operator: '=', rightField: '', conn: 'AND' })
  edges.value = [...edges.value]; emitEdges()
}
function updateRow(id, i, key, v) {
  const e = findEdge(id); if (!e) return
  e.data.conditions[i] = { ...e.data.conditions[i], [key]: v }
  edges.value = [...edges.value]; emitEdges(); scheduleRecompute()
}
function removeRow(id, i) {
  const e = findEdge(id); if (!e) return
  e.data.conditions.splice(i, 1)
  edges.value = [...edges.value]; emitEdges(); scheduleRecompute()
}
function removeEdge(id) {
  edges.value = edges.value.filter((e) => e.id !== id)
  if (openEditor.value === id) openEditor.value = null
  emitEdges(); scheduleRecompute()
}
function joinLabel(e) { return JOIN_TYPES.find((j) => j.value === (e.data?.joinType || 'INNER JOIN'))?.label || 'Join' }

// ── Dragging ──────────────────────────────────────────────
let dragState = null
function onDragStart(e, node) {
  dragState = { id: node.id, ox: e.clientX - node.x, oy: e.clientY - node.y }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}
function onDragMove(e) {
  if (!dragState) return
  const idx = canvasNodes.value.findIndex((n) => n.id === dragState.id)
  if (idx < 0) return
  const next = [...canvasNodes.value]
  next[idx] = { ...next[idx], x: e.clientX - dragState.ox, y: e.clientY - dragState.oy }
  canvasNodes.value = next
  emit('update:nodes', next)
  scheduleRecompute()
}
function onDragEnd() {
  dragState = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

// ── Geometry: one line per edge (table to table) ──────────
const lines = ref([]) // [{ id, joinType, x1,y1,x2,y2, midX, midY }]
let rafId = null
function scheduleRecompute() {
  if (rafId) return
  rafId = requestAnimationFrame(() => { rafId = null; recomputeLines() })
}
function cardRect(nodeId, cr) {
  const el = nodeEls[nodeId]
  if (el) {
    const r = el.getBoundingClientRect()
    return { left: r.left - cr.left, right: r.right - cr.left, cy: r.top + r.height / 2 - cr.top }
  }
  const n = canvasNodes.value.find((x) => x.id === nodeId)
  if (!n) return null
  return { left: n.x, right: n.x + NODE_W, cy: n.y + 60 }
}
function recomputeLines() {
  const canvas = canvasRef.value
  if (!canvas) { lines.value = []; return }
  const cr = canvas.getBoundingClientRect()
  const out = []
  for (const edge of edges.value) {
    const a = cardRect(edge.source, cr)
    const b = cardRect(edge.target, cr)
    if (!a || !b) continue
    const aRightsToB = a.right <= b.left || a.left <= b.left // a is left-ish of b
    const x1 = aRightsToB ? a.right : a.left
    const x2 = aRightsToB ? b.left : b.right
    out.push({
      id: edge.id,
      joinType: joinLabel(edge),
      x1, y1: a.cy, x2, y2: b.cy,
      midX: (x1 + x2) / 2, midY: (a.cy + b.cy) / 2,
    })
  }
  lines.value = out
}
watch(edges, scheduleRecompute, { deep: true })
function onResize() { scheduleRecompute() }
onMounted(() => { nextTick(scheduleRecompute); window.addEventListener('resize', onResize) })
onUnmounted(() => { window.removeEventListener('resize', onResize); if (rafId) cancelAnimationFrame(rafId) })
</script>

<template>
  <div
    ref="canvasRef"
    class="join-canvas relative flex-1 overflow-auto min-h-[300px]"
    :class="dropHover ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : 'bg-muted/20'"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Connection lines (no arrowheads) -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none" style="min-width:100%;min-height:100%">
      <line
        v-for="line in lines"
        :key="line.id"
        :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
        stroke="#0176D3" stroke-width="2"
      />
    </svg>

    <!-- Join-type chip at each connection midpoint -->
    <button
      v-for="line in lines"
      :key="'chip-' + line.id"
      class="absolute z-20 flex items-center gap-1 bg-card border border-primary/50 rounded-md shadow-sm px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/5"
      :style="{ left: line.midX + 'px', top: line.midY + 'px', transform: 'translate(-50%, -50%)' }"
      @click="openEditor = openEditor === line.id ? null : line.id"
    >
      {{ line.joinType }}
    </button>

    <!-- ON editor popover -->
    <template v-if="editorEdge">
      <div class="absolute inset-0 z-30" @click="openEditor = null" />
      <div
        class="absolute z-40 w-80 bg-card border border-border rounded-lg shadow-xl p-2 text-[11px]"
        :style="{ left: (lines.find((l) => l.id === openEditor)?.midX || 100) + 'px', top: ((lines.find((l) => l.id === openEditor)?.midY || 100) + 12) + 'px', transform: 'translate(-50%, 0)' }"
        @click.stop
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="font-bold">{{ labelSrc }} → {{ labelTgt }}</span>
          <select
            class="ml-auto border border-border rounded px-1 py-0.5 bg-background"
            :value="editorEdge.data.joinType"
            @change="setJoinType(editorEdge.id, $event.target.value)"
          >
            <option v-for="jt in JOIN_TYPES" :key="jt.value" :value="jt.value">{{ jt.label }} join</option>
          </select>
          <button class="text-muted-foreground hover:text-destructive" title="Remove join" @click="removeEdge(editorEdge.id)"><X class="h-3.5 w-3.5" /></button>
        </div>

        <template v-if="!editorEdge.data.rawOn">
          <div v-for="(c, i) in editorEdge.data.conditions" :key="i" class="flex items-center gap-1 mb-1">
            <select
              v-if="i > 0"
              class="border border-border rounded px-1 py-0.5 bg-background w-12 text-muted-foreground"
              :value="c.conn || 'AND'"
              @change="updateRow(editorEdge.id, i, 'conn', $event.target.value)"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            <span v-else class="w-12 text-[9px] text-muted-foreground text-center">ON</span>
            <select
              class="border border-border rounded px-1 py-0.5 bg-background flex-1 min-w-0"
              :value="c.leftField"
              @change="updateRow(editorEdge.id, i, 'leftField', $event.target.value)"
            >
              <option value="" disabled>left field…</option>
              <option v-for="f in fieldNames(editorEdge.source)" :key="f" :value="f">{{ f }}</option>
            </select>
            <select
              class="border border-border rounded px-1 py-0.5 bg-background w-12"
              :value="c.operator"
              @change="updateRow(editorEdge.id, i, 'operator', $event.target.value)"
            >
              <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
            </select>
            <select
              class="border border-border rounded px-1 py-0.5 bg-background flex-1 min-w-0"
              :value="c.rightField"
              @change="updateRow(editorEdge.id, i, 'rightField', $event.target.value)"
            >
              <option value="" disabled>right field…</option>
              <option v-for="f in fieldNames(editorEdge.target)" :key="f" :value="f">{{ f }}</option>
            </select>
            <button class="text-muted-foreground hover:text-destructive" @click="removeRow(editorEdge.id, i)"><X class="h-3 w-3" /></button>
          </div>
          <button class="flex items-center gap-1 text-primary hover:underline mt-1" @click="addRow(editorEdge.id)">
            <Plus class="h-3 w-3" /> Add condition
          </button>
        </template>

        <div v-else class="mb-1">
          <textarea
            class="w-full h-20 border border-border rounded p-1 bg-background font-mono text-[10px]"
            placeholder="(t1.[A] = t2.[A] AND t1.[B] = t2.[B]) OR (t1.[C] = t2.[C])"
            :value="editorEdge.data.onClause"
            @input="setRawOn(editorEdge.id, $event.target.value)"
          />
          <p class="text-[9px] text-muted-foreground">Use table aliases (t1, t2…) and brackets. This overrides the rows.</p>
        </div>

        <label class="flex items-center gap-1 mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground cursor-pointer">
          <input type="checkbox" :checked="editorEdge.data.rawOn" @change="setRaw(editorEdge.id, $event.target.checked)" />
          <Code2 class="h-3 w-3" /> Advanced: raw ON expression (for custom grouping)
        </label>

        <div class="flex justify-end mt-2">
          <button
            class="flex items-center gap-1 text-[10px] font-semibold px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            @click="openEditor = null"
          >
            <Check class="h-3 w-3" /> Save
          </button>
        </div>
      </div>
    </template>

    <!-- DE nodes -->
    <div
      v-for="node in canvasNodes"
      :key="node.id"
      :ref="(el) => { if (el) nodeEls[node.id] = el; else delete nodeEls[node.id] }"
      class="absolute rounded-lg border-2 bg-card shadow-md select-none"
      :class="pending && pending.nodeId === node.id ? 'border-primary' : 'border-border'"
      :style="{ left: node.x + 'px', top: node.y + 'px', width: NODE_W + 'px' }"
    >
      <div class="px-2 py-1.5 border-b border-border flex items-center justify-between cursor-move" @mousedown="onDragStart($event, node)">
        <span class="text-xs font-bold truncate">{{ node.data?.name }}</span>
        <button class="text-[10px] text-muted-foreground hover:text-destructive" @mousedown.stop @click="removeNode(node.id)">×</button>
      </div>

      <div class="max-h-40 overflow-y-auto bg-muted/10">
        <div v-if="fieldsLoading(node.id)" class="flex items-center gap-1 px-2 py-1 text-[9px] text-muted-foreground">
          <Loader2 class="h-2.5 w-2.5 animate-spin" /> Loading fields…
        </div>
        <template v-else-if="fieldsFor(node.id).length">
          <button
            v-for="f in fieldsFor(node.id)"
            :key="f.name"
            class="w-full flex items-center gap-1 px-2 py-1 text-[10px] hover:bg-muted text-left"
            :class="isPending(node.id, f.name) ? 'bg-primary/15 ring-1 ring-inset ring-primary' : ''"
            @mousedown.stop
            @click="onFieldClick(node.id, f.name)"
          >
            <KeyRound v-if="isKey(f)" class="h-3 w-3 text-amber-500 shrink-0" />
            <component :is="typeIcon(f)" v-else class="h-3 w-3 text-muted-foreground shrink-0" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </template>
        <div v-else class="px-2 py-1 text-[9px] text-muted-foreground italic">No fields</div>
      </div>

      <div class="px-2 py-1 text-[9px] text-muted-foreground border-t border-border">
        {{ pending && pending.nodeId === node.id ? 'Click a field on another table…' : 'Click a field to join' }}
      </div>
    </div>

    <div v-if="!canvasNodes.length" class="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground text-center px-6 pointer-events-none">
      Drag data extensions here (or click them) to add tables, then click a field on one table and a field on another to join them — click the join label to edit the mapping
    </div>
  </div>
</template>

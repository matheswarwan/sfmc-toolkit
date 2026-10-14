<script setup>
// A journey drawn like the Journey Builder canvas: horizontal (flow left to right,
// paths stacked) or vertical (flow top to bottom, paths side by side). Nodes are
// positioned by layoutJourney(); edges are SVG elbows with the path labels.
import { computed } from 'vue'
import { LogIn, Mail, Clock, GitBranch, Zap, LogOut } from 'lucide-vue-next'
import { nodeKind, nodeSummary, nodeTypeLabel } from '@/utils/journeys.js'

const props = defineProps({
  graph: { type: Object, required: true },
  layout: { type: Object, required: true },
  orientation: { type: String, default: 'horizontal' },
  selected: { type: String, default: null },
})
const emit = defineEmits(['select'])

const NODE_W = 184
const NODE_H = 76
const GAP_FLOW = 72 // between steps along the flow
const GAP_LANE = 36 // between paths

const horizontal = computed(() => props.orientation !== 'vertical')
const cell = computed(() => (horizontal.value
  ? { w: NODE_W + GAP_FLOW, h: NODE_H + GAP_LANE }
  : { w: NODE_W + GAP_LANE, h: NODE_H + GAP_FLOW }))

function box(key) {
  const p = props.layout.pos.get(key)
  if (!p) return null
  const [col, row] = horizontal.value ? [p.depth, p.lane] : [p.lane, p.depth]
  return { x: 16 + col * cell.value.w, y: 16 + row * cell.value.h }
}

const size = computed(() => {
  const [cols, rows] = horizontal.value ? [props.layout.depths, props.layout.lanes] : [props.layout.lanes, props.layout.depths]
  return { w: 32 + cols * cell.value.w - (horizontal.value ? GAP_FLOW : GAP_LANE), h: 32 + rows * cell.value.h - (horizontal.value ? GAP_LANE : GAP_FLOW) }
})

const nodes = computed(() => props.graph.nodes.map((n) => ({ ...n, box: box(n.key), kind: nodeKind(n.type), summary: nodeSummary(n) })).filter((n) => n.box))

// Elbow from the parent's exit side to the child's entry side.
const edges = computed(() => props.graph.edges.map((e, i) => {
  const a = box(e.from)
  const b = box(e.to)
  if (!a || !b) return null
  let d, lx, ly
  if (horizontal.value) {
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2
    const mx = x2 > x1 ? x1 + (x2 - x1) / 2 : x1 + GAP_FLOW / 2
    d = `M${x1},${y1} H${mx} V${y2} H${x2}`
    lx = mx + 4; ly = y2 - 4
  } else {
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y
    const my = y2 > y1 ? y1 + (y2 - y1) / 2 : y1 + GAP_FLOW / 2
    d = `M${x1},${y1} V${my} H${x2} V${y2}`
    lx = x2 + 4; ly = my - 4
  }
  return { id: i, d, label: e.label, lx, ly }
}).filter(Boolean))

const KIND = {
  entry: { icon: LogIn, cls: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40', tag: 'text-emerald-700 dark:text-emerald-300' },
  message: { icon: Mail, cls: 'border-sky-400 bg-sky-50 dark:bg-sky-950/40', tag: 'text-sky-700 dark:text-sky-300' },
  wait: { icon: Clock, cls: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40', tag: 'text-amber-700 dark:text-amber-300' },
  split: { icon: GitBranch, cls: 'border-violet-400 bg-violet-50 dark:bg-violet-950/40', tag: 'text-violet-700 dark:text-violet-300' },
  action: { icon: Zap, cls: 'border-slate-400 bg-slate-50 dark:bg-slate-900', tag: 'text-slate-700 dark:text-slate-300' },
  exit: { icon: LogOut, cls: 'border-dashed border-border bg-muted/40', tag: 'text-muted-foreground' },
}
</script>

<template>
  <div class="relative" :style="{ width: `${size.w}px`, height: `${size.h}px` }">
    <svg class="absolute inset-0 pointer-events-none text-muted-foreground" :width="size.w" :height="size.h" aria-hidden="true">
      <defs>
        <marker id="jarrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
        </marker>
      </defs>
      <g v-for="e in edges" :key="e.id">
        <path :d="e.d" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#jarrow)" />
        <text v-if="e.label" :x="e.lx" :y="e.ly" class="fill-foreground" font-size="10">{{ e.label.length > 28 ? e.label.slice(0, 27) + '…' : e.label }}</text>
      </g>
    </svg>
    <button v-for="n in nodes" :key="n.key" type="button"
      class="absolute text-left rounded-lg border-2 px-2.5 py-1.5 shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="[KIND[n.kind].cls, selected === n.key ? 'ring-2 ring-primary' : '']"
      :style="{ left: `${n.box.x}px`, top: `${n.box.y}px`, width: `${NODE_W}px`, height: `${n.kind === 'exit' ? 40 : NODE_H}px` }"
      :aria-pressed="selected === n.key" :title="n.name" @click="emit('select', n.key)">
      <div class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide" :class="KIND[n.kind].tag">
        <component :is="KIND[n.kind].icon" class="h-3 w-3 flex-shrink-0" />
        <span class="truncate">{{ n.kind === 'entry' ? 'Entry' : n.kind === 'exit' ? 'Exit' : nodeTypeLabel(n.type) }}</span>
      </div>
      <div v-if="n.kind !== 'exit'" class="text-xs font-medium truncate text-foreground">{{ n.name }}</div>
      <div v-if="n.summary" class="text-[10px] text-muted-foreground truncate">{{ n.summary }}</div>
    </button>
  </div>
</template>

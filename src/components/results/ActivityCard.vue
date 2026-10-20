<script setup>
// One activity's details, from describeActivity() in utils/activityTypes.js: main
// properties, extra properties behind "Show additional details", code, tables.
// Data extension values link to the Toolkit and Contact Builder; a SQL Query
// activity can be run in Run Query or started in SFMC.
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ExternalLink, Play, Loader2 } from 'lucide-vue-next'
import CodeView from './CodeView.vue'
import { useStack } from '@/composables/useStack.js'
import { showToast } from '@/composables/useToast.js'
import { contactBuilderDEUrl } from '@/utils/activityTypes.js'
import { startQueryActivity, getQueryActivityStatus } from '@/utils/sfmcApi.js'

const props = defineProps({
  description: { type: Object, required: true },
  showAllFields: { type: Boolean, default: false }, // set by a page-wide toggle
  heading: { type: String, default: '' }, // e.g. "Step 1.2"
})

const showExtra = ref(props.showAllFields)
watch(() => props.showAllFields, (v) => { showExtra.value = v })

const d = computed(() => props.description)
const hasExtra = computed(() => d.value.extra?.length || d.value.tables?.some((t) => t.extra))
const tables = computed(() => (d.value.tables || []).filter((t) => !t.extra || showExtra.value))

const router = useRouter()
const { stack } = useStack()
const deRef = (label) => d.value.deRefs?.[label] || null
function openDEInToolkit(ref) {
  router.push({ path: '/data-extensions', query: { q: ref.name } })
}

// ── Run this query (SQL Query activities) ─────────────────
const runMenu = ref(false)
const running = ref(false)
let pollTimer = null
onUnmounted(() => clearTimeout(pollTimer))

function runInToolkit() {
  runMenu.value = false
  router.push({ path: '/queries/workspace', query: { sql: d.value.run.sql } })
}

const POLL_MS = 3000
const MAX_POLL_MS = 30 * 60 * 1000

async function runInSFMC() {
  runMenu.value = false
  const r = d.value.run
  const ok = window.confirm(
    `Run the Query activity "${d.value.title}" in SFMC now?\n\n` +
    `It writes to ${r.targetName ? `"${r.targetName}"` : 'its target data extension'}${r.updateType ? ` (${r.updateType})` : ''}, ` +
    'the same as when its automation runs it.'
  )
  if (!ok) return
  running.value = true
  const started = Date.now()
  try {
    await startQueryActivity(stack.value, r.queryDefinitionId)
    showToast(`Started "${d.value.title}" in SFMC.`)
  } catch (e) {
    running.value = false
    showToast(`Could not start the activity: ${e.message}`)
    return
  }
  const poll = async () => {
    try {
      const s = await getQueryActivityStatus(stack.value, r.queryDefinitionId)
      if (s?.isRunning && Date.now() - started < MAX_POLL_MS) {
        pollTimer = setTimeout(poll, POLL_MS)
        return
      }
      running.value = false
      showToast(s?.isRunning
        ? `"${d.value.title}" is still running in SFMC; check Automation Studio.`
        : `"${d.value.title}" finished in SFMC (${Math.round((Date.now() - started) / 1000)} s).`)
    } catch (e) {
      running.value = false
      showToast(`Could not read the activity status: ${e.message}`)
    }
  }
  pollTimer = setTimeout(poll, POLL_MS)
}
</script>

<template>
  <article class="rounded-lg border border-border bg-card">
    <header class="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg">
      <img v-if="d.icon" :src="d.icon" alt="" class="h-5 w-5 object-contain" referrerpolicy="no-referrer" @error="$event.target.style.display = 'none'" />
      <span v-if="heading" class="text-[11px] text-muted-foreground tabular-nums">{{ heading }}</span>
      <span class="text-[10px] font-semibold uppercase tracking-wide text-primary">{{ d.typeLabel }}</span>
      <h3 class="flex-1 min-w-0 truncate text-sm font-semibold">{{ d.title }}</h3>
      <slot name="actions" />
      <div v-if="d.run" class="relative shrink-0">
        <button class="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60" :disabled="running"
          :aria-expanded="runMenu" aria-haspopup="menu" @click="runMenu = !runMenu">
          <Loader2 v-if="running" class="h-3 w-3 animate-spin" /><Play v-else class="h-3 w-3" />
          {{ running ? 'Running in SFMC' : 'Run this query' }}
        </button>
        <div v-if="runMenu" class="fixed inset-0 z-10" @click="runMenu = false" />
        <div v-if="runMenu" class="absolute right-0 top-6 z-20 w-64 rounded-md border border-border bg-card shadow-lg p-1 text-xs" role="menu" @keydown.esc="runMenu = false">
          <button class="w-full text-left px-2 py-1.5 rounded hover:bg-accent" role="menuitem" :disabled="!d.run.sql" @click="runInToolkit">
            <span class="block font-medium">Run in Toolkit</span>
            <span class="block text-muted-foreground">Opens the SQL in Run Query; results go to a new data extension.</span>
          </button>
          <button class="w-full text-left px-2 py-1.5 rounded hover:bg-accent" role="menuitem" @click="runInSFMC">
            <span class="block font-medium">Run activity in SFMC</span>
            <span class="block text-muted-foreground">Starts this Query activity; it writes to its own target data extension.</span>
          </button>
        </div>
      </div>
      <a v-if="d.link" :href="d.link" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
        Open in SFMC <ExternalLink class="h-3 w-3" />
      </a>
    </header>
    <div class="p-3 space-y-3 text-xs">
      <p v-if="d.note" class="text-muted-foreground italic">{{ d.note }}</p>
      <dl class="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-x-4 gap-y-1">
        <template v-for="([label, value], i) in d.main" :key="'m' + i">
          <dt class="text-muted-foreground">{{ label }}</dt>
          <dd class="wrap-break-word">
            {{ value }}
            <template v-if="deRef(label)">
              <button class="ml-2 text-primary hover:underline" :title="`Find ${deRef(label).name} in Data Extensions`" @click="openDEInToolkit(deRef(label))">View</button>
              <a v-if="contactBuilderDEUrl(stack, deRef(label).id)" :href="contactBuilderDEUrl(stack, deRef(label).id)" target="_blank" rel="noopener"
                class="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline" title="Open in Contact Builder">SFMC <ExternalLink class="h-3 w-3" /></a>
            </template>
          </dd>
        </template>
        <template v-if="showExtra">
          <template v-for="([label, value], i) in d.extra" :key="'e' + i">
            <dt class="text-muted-foreground">{{ label }}</dt><dd class="wrap-break-word font-mono text-[11px]">{{ value }}</dd>
          </template>
        </template>
      </dl>
      <div v-if="d.code?.text">
        <div class="text-muted-foreground mb-1">{{ d.code.label || 'Code' }}</div>
        <CodeView :code="d.code.text" :lang="d.code.lang || 'sql'" />
      </div>
      <div v-for="(t, i) in tables" :key="'t' + i">
        <div class="text-muted-foreground mb-1">{{ t.title }}</div>
        <div v-if="t.rows.length" class="overflow-x-auto">
          <table class="w-full border border-border">
            <thead><tr class="bg-muted/40 text-left"><th v-for="c in t.columns" :key="c" class="px-2 py-1 font-semibold">{{ c }}</th></tr></thead>
            <tbody><tr v-for="(r, j) in t.rows" :key="j" class="border-t border-border"><td v-for="(c, k) in r" :key="k" class="px-2 py-1 align-top wrap-break-word">{{ c }}</td></tr></tbody>
          </table>
        </div>
        <p v-else class="text-muted-foreground">None.</p>
      </div>
      <button v-if="hasExtra" class="text-primary hover:underline" :aria-expanded="showExtra" @click="showExtra = !showExtra">
        {{ showExtra ? 'Hide additional details' : 'Show additional details' }}
      </button>
    </div>
  </article>
</template>

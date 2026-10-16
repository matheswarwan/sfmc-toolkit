<script setup>
// "Where used" for one data extension: the scan's steps with progress bars while it
// runs (it carries on in the background when the panel is closed), then the Query
// activities that write to or read from the DE and the automations they run in.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X, RefreshCw, Loader2, CheckCircle2, Circle, MinusCircle, Square, ChevronDown, ChevronRight, Database } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import StatusBadge from '@/components/results/StatusBadge.vue'
import CodeView from '@/components/results/CodeView.vue'
import DownloadMenu from '@/components/results/DownloadMenu.vue'
import { useDEUsage } from '@/composables/useDEUsage.js'
import { formatDateTime } from '@/utils/format.js'

const router = useRouter()
const { state, start, stop, progress, stages } = useDEUsage()

const percent = computed(() => Math.round(100 * progress()))
const matches = computed(() => {
  const list = state.result?.matches || []
  return [...list].sort((a, b) => (b.writes - a.writes) || a.query.name.localeCompare(b.query.name))
})
const writers = computed(() => matches.value.filter((m) => m.writes).length)
const readers = computed(() => matches.value.filter((m) => m.reads).length)
const automationsChecked = computed(() => (state.result?.automationsScanned || 0) > 0)

const openSql = ref(new Set())
watch(() => state.de, () => { openSql.value = new Set() })
function toggleSql(id) {
  const next = new Set(openSql.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openSql.value = next
}

function stageText(s) {
  if (s.state === 'skipped') return s.note ? `Skipped: ${s.note}` : 'Skipped'
  if (s.state === 'waiting') return 'Waiting'
  if (s.state === 'stopped') return 'Stopped'
  const count = s.total ? `${s.done.toLocaleString()} of ${s.total.toLocaleString()}` : s.done ? s.done.toLocaleString() : ''
  const parts = [count, s.state === 'cached' ? 'from the last scan' : '', s.note].filter(Boolean)
  return parts.join(', ') || (s.state === 'running' ? 'Starting' : 'Done')
}

function openAutomation(id) {
  router.push(`/automations/${encodeURIComponent(id)}`)
}

const updateType = (q) => q.targetUpdateTypeName || ''

function buildDoc() {
  const de = state.de
  return {
    title: `Where ${de.name} is used`,
    blocks: [
      { type: 'p', text: `${writers.value} Query activities write to this data extension and ${readers.value} read from it. Business unit checked: the current one only.` },
      {
        type: 'table',
        columns: ['Query activity', 'Writes', 'Reads', 'Update type', 'Target', 'Automations', 'Modified'],
        rows: matches.value.map((m) => [
          m.query.name, m.writes ? 'Yes' : '', m.reads ? (m.viaEnt ? 'Yes (ENT.)' : 'Yes') : '',
          m.writes ? updateType(m.query) : '', m.query.targetName || '',
          m.automations.map((a) => `${a.name} (step ${a.step})`).join('; ') || (automationsChecked.value ? 'None' : ''),
          formatDateTime(m.query.modifiedDate),
        ]),
      },
      ...matches.value.flatMap((m) => [
        { type: 'h', level: 2, text: m.query.name },
        { type: 'code', lang: 'sql', text: m.query.queryText || '' },
      ]),
    ],
  }
}
</script>

<template>
  <aside v-if="state.open && state.de" class="fixed inset-y-0 right-0 z-[110] w-full sm:w-[560px] flex flex-col border-l border-border bg-card text-foreground shadow-2xl" role="dialog" aria-labelledby="de-usage-title">
    <header class="flex items-start gap-2 px-4 py-3 border-b border-border">
      <Database class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div class="min-w-0 flex-1">
        <h2 id="de-usage-title" class="text-sm font-semibold">Where used</h2>
        <p class="text-xs text-muted-foreground truncate" :title="state.de.name">
          {{ state.de.name }}<template v-if="state.de.customerKey"> · key {{ state.de.customerKey }}</template>
          <template v-if="state.de.sourceType"> · {{ state.de.sourceType === 'shared' ? 'Shared' : 'Synchronized' }}</template>
        </p>
      </div>
      <Button v-if="!state.running" variant="ghost" size="sm" class="h-7 text-xs" title="Scan again, reloading queries and automations from SFMC" @click="start(state.stack, state.de, { refresh: true })">
        <RefreshCw class="h-3.5 w-3.5 mr-1" /> Rescan
      </Button>
      <Button variant="ghost" size="icon" class="h-7 w-7" :title="state.running ? 'Close (the scan keeps going)' : 'Close'" @click="state.open = false"><X class="h-4 w-4" /></Button>
    </header>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Process -->
      <section class="px-4 py-3 border-b border-border" aria-label="Process">
        <div class="flex items-center gap-2 text-xs mb-1.5">
          <span class="font-semibold">Process</span>
          <span class="text-muted-foreground">{{ state.running ? `${percent}%` : state.error ? state.error : 'Finished' }}</span>
          <div class="flex-1" />
          <button v-if="state.running" class="inline-flex items-center gap-1 text-primary hover:underline" @click="stop"><Square class="h-3 w-3" /> Stop</button>
        </div>
        <div class="h-1.5 rounded bg-muted overflow-hidden mb-3" role="progressbar" aria-label="Overall progress" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full transition-all" :class="state.error && !state.running ? 'bg-amber-500' : 'bg-primary'" :style="{ width: `${percent}%` }" />
        </div>
        <ol class="space-y-2">
          <li v-for="(s, i) in stages" :key="s.id" class="text-xs">
            <div class="flex items-center gap-2">
              <Loader2 v-if="state.stages[s.id]?.state === 'running'" class="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              <CheckCircle2 v-else-if="['done', 'cached'].includes(state.stages[s.id]?.state)" class="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <MinusCircle v-else-if="['skipped', 'stopped'].includes(state.stages[s.id]?.state)" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Circle v-else class="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <span :class="state.stages[s.id]?.state === 'waiting' ? 'text-muted-foreground' : ''">{{ i + 1 }}. {{ s.label }}</span>
              <span class="ml-auto text-muted-foreground text-right">{{ stageText(state.stages[s.id] || {}) }}</span>
            </div>
            <div v-if="state.stages[s.id]?.state === 'running' && state.stages[s.id].total" class="mt-1 h-1 rounded bg-muted overflow-hidden" style="margin-left: 1.375rem">
              <div class="h-full bg-primary/70 transition-all" :style="{ width: `${100 * state.stages[s.id].done / state.stages[s.id].total}%` }" />
            </div>
          </li>
        </ol>
        <p v-if="state.running" class="mt-3 text-[11px] text-muted-foreground">
          You can close this panel or open another section; the scan carries on. Automations are read 10 at a time, so a large business unit takes a while the first time. The next data extension you check reuses what was loaded (for 30 minutes, or until Rescan).
        </p>
      </section>

      <!-- Results -->
      <section v-if="state.result" class="px-4 py-3" aria-label="Results">
        <div class="flex items-center gap-2 mb-2">
          <p class="text-xs flex-1">
            <template v-if="matches.length">
              <strong>{{ writers }}</strong> {{ writers === 1 ? 'query writes' : 'queries write' }} to this data extension,
              <strong>{{ readers }}</strong> {{ readers === 1 ? 'reads' : 'read' }} from it.
            </template>
            <template v-else>No Query activity in this business unit writes to or reads from this data extension.</template>
            <span class="text-muted-foreground"> {{ state.result.queriesScanned.toLocaleString() }} queries checked<template v-if="automationsChecked">, {{ state.result.automationsScanned.toLocaleString() }} automations</template>.</span>
          </p>
          <DownloadMenu v-if="matches.length" :get-doc="buildDoc" :file-name="`where-used-${state.de.name}`" label="Download" />
        </div>

        <p v-if="state.result.queriesCapped" class="mb-2 text-xs text-amber-700 dark:text-amber-400">Only the newest 2,000 Query activities were checked.</p>
        <p v-if="state.result.automationsCapped" class="mb-2 text-xs text-amber-700 dark:text-amber-400">Only the 2,000 most recently run automations were checked.</p>
        <p v-if="state.result.automationErrors" class="mb-2 text-xs text-amber-700 dark:text-amber-400">{{ state.result.automationErrors }} automations could not be read, so a query may be missing an automation.</p>

        <ul class="space-y-2">
          <li v-for="m in matches" :key="m.query.queryDefinitionId" class="rounded-md border border-border p-2.5 text-xs">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-medium text-sm">{{ m.query.name }}</span>
              <span v-if="m.writes" class="rounded-full px-1.5 py-px text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Writes{{ updateType(m.query) ? `: ${updateType(m.query)}` : '' }}</span>
              <span v-if="m.reads" class="rounded-full px-1.5 py-px text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Reads{{ m.viaEnt ? ' (ENT.)' : '' }}</span>
            </div>
            <p class="mt-0.5 text-muted-foreground">
              <template v-if="!m.writes && m.query.targetName">Target: {{ m.query.targetName }} · </template>Modified {{ formatDateTime(m.query.modifiedDate) }}
            </p>
            <div class="mt-1.5">
              <p v-if="!automationsChecked" class="text-muted-foreground italic">Automations not checked.</p>
              <p v-else-if="!m.automations.length" class="text-muted-foreground italic">Not in any automation.</p>
              <ul v-else class="space-y-1">
                <li v-for="a in m.automations" :key="`${a.automationId}-${a.step}`" class="flex flex-wrap items-center gap-1.5">
                  <button class="text-primary hover:underline font-medium" @click="openAutomation(a.automationId)">{{ a.name }}</button>
                  <span class="text-muted-foreground">step {{ a.step }}{{ a.stepName ? ` (${a.stepName})` : '' }}</span>
                  <StatusBadge :status="a.status" />
                  <span v-if="a.lastRunTime" class="text-muted-foreground">last run {{ formatDateTime(a.lastRunTime) }}</span>
                </li>
              </ul>
            </div>
            <button class="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline" :aria-expanded="openSql.has(m.query.queryDefinitionId)" @click="toggleSql(m.query.queryDefinitionId)">
              <ChevronDown v-if="openSql.has(m.query.queryDefinitionId)" class="h-3.5 w-3.5" /><ChevronRight v-else class="h-3.5 w-3.5" /> SQL
            </button>
            <div v-if="openSql.has(m.query.queryDefinitionId)" class="mt-1.5">
              <CodeView :code="m.query.queryText || ''" lang="sql" max-height="260px" />
            </div>
          </li>
        </ul>

        <p class="mt-4 text-[11px] text-muted-foreground">
          Only the current business unit is checked. Writes means the query's target is this data extension (by key or ID). Reads means its name appears after FROM or JOIN,
          ignoring comments; data extensions in other business units with the same name can't be told apart. Imports, filters, scripts, journeys and emails are not checked yet.
        </p>
      </section>
    </div>
  </aside>
</template>

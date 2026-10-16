<script setup>
// "Where used" for anything (see utils/usage/): the scan's steps with progress bars
// while it runs (it carries on in the background when the panel is closed), then the
// results in sections. Mounted once in App.vue.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X, RefreshCw, Loader2, CheckCircle2, Circle, MinusCircle, AlertCircle, Square, ChevronDown, ChevronRight, Network, ArrowLeft, ExternalLink } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import StatusBadge from '@/components/results/StatusBadge.vue'
import CodeView from '@/components/results/CodeView.vue'
import DownloadMenu from '@/components/results/DownloadMenu.vue'
import LineageNode from './LineageNode.vue'
import { useUsage, targetTitle, targetKindLabel } from '@/composables/useUsage.js'
import { formatDateTime } from '@/utils/format.js'

const router = useRouter()
const { state, start, stop, follow, back, progress } = useUsage()

const percent = computed(() => Math.round(100 * progress()))
const sections = computed(() => state.result?.sections || [])
const total = computed(() => sections.value.reduce((n, s) => n + (s.items?.length || 0), 0))
const title = computed(() => state.result?.title || targetTitle(state.target))

const openCode = ref(new Set())
const collapsed = ref(new Set())
watch(() => state.target, () => { openCode.value = new Set(); collapsed.value = new Set() })
function toggle(setRef, k) {
  const next = new Set(setRef.value)
  next.has(k) ? next.delete(k) : next.add(k)
  setRef.value = next
}

const TONES = {
  write: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  read: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  maybe: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  info: 'bg-muted text-muted-foreground',
}

function stageText(s) {
  if (!s) return ''
  if (s.state === 'skipped') return s.note ? `Skipped: ${s.note}` : 'Skipped'
  if (s.state === 'waiting') return 'Waiting'
  if (s.state === 'stopped') return 'Stopped'
  if (s.state === 'error') return `Failed: ${s.note}`
  const count = s.total ? `${s.done.toLocaleString()} of ${s.total.toLocaleString()}` : s.done ? s.done.toLocaleString() : ''
  const parts = [count, s.state === 'cached' ? 'from the last scan' : '', s.note].filter(Boolean)
  return parts.join(', ') || (s.state === 'running' ? 'Starting' : 'Done')
}

function go(route) { router.push(route) }
function pivotDE(name) { follow({ kind: 'de', de: { name } }) }

function lineageRows(node, direction, depth = 0, rows = []) {
  for (const c of node?.children || []) {
    rows.push([`${'  '.repeat(depth)}${direction === 'up' ? 'from' : 'to'} ${c.via.kind} ${c.via.name}`, c.name || (c.via.file ? `file ${c.via.file}` : 'a file')])
    lineageRows(c, direction, depth + 1, rows)
  }
  return rows
}

function buildDoc() {
  const blocks = [{ type: 'p', text: `${targetKindLabel(state.target)}: ${title.value}. ${total.value} found. Current business unit only.` }]
  for (const s of sections.value) {
    blocks.push({ type: 'h', level: 2, text: s.title })
    if (s.tree) {
      for (const [dir, label] of [['up', 'Comes from'], ['down', 'Goes to']]) {
        if (!s.tree[dir]) continue
        const rows = lineageRows(s.tree[dir], dir)
        blocks.push({ type: 'p', text: label }, rows.length ? { type: 'table', columns: ['Through', 'Data extension'], rows } : { type: 'p', text: 'Nothing found.' })
      }
      continue
    }
    if (!s.items.length) { blocks.push({ type: 'p', text: s.empty }); continue }
    blocks.push({
      type: 'table',
      columns: ['Name', 'Type', 'How', 'Details', 'Automations'],
      rows: s.items.map((i) => [i.title, i.kind, i.badges.map((b) => b.text).filter(Boolean).join(', '), i.lines.join('; '),
        i.automations ? (i.automations.map((a) => `${a.name} (step ${a.step})`).join('; ') || 'None') : '']),
    })
  }
  return { title: `Where ${title.value} is used`, blocks }
}
</script>

<template>
  <aside v-if="state.open && state.target" class="fixed inset-y-0 right-0 z-[110] w-full sm:w-[600px] flex flex-col border-l border-border bg-card text-foreground shadow-2xl" role="dialog" aria-labelledby="usage-title">
    <header class="flex items-start gap-2 px-4 py-3 border-b border-border">
      <button v-if="state.history.length" class="mt-0.5 p-0.5 rounded hover:bg-accent text-muted-foreground" title="Back" @click="back"><ArrowLeft class="h-4 w-4" /></button>
      <Network v-else class="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div class="min-w-0 flex-1">
        <h2 id="usage-title" class="text-sm font-semibold">Where used</h2>
        <p class="text-xs text-muted-foreground truncate" :title="title">
          {{ targetKindLabel(state.target) }}: <span class="text-foreground">{{ title }}</span>
          <template v-if="state.target.de?.customerKey"> · key {{ state.target.de.customerKey }}</template>
        </p>
      </div>
      <Button v-if="!state.running" variant="ghost" size="sm" class="h-7 text-xs" title="Scan again, reloading everything from SFMC" @click="start(state.stack, state.target, { refresh: true, keepHistory: true })">
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
          <div class="h-full transition-all" :class="state.error && !state.running ? 'bg-amber-500' : 'bg-primary'" :style="{ width: `${state.running || state.error ? percent : 100}%` }" />
        </div>
        <ol class="space-y-2">
          <li v-for="(s, i) in state.order" :key="s.id" class="text-xs">
            <div class="flex items-start gap-2">
              <Loader2 v-if="state.stages[s.id]?.state === 'running'" class="h-3.5 w-3.5 mt-px animate-spin text-primary shrink-0" />
              <CheckCircle2 v-else-if="['done', 'cached'].includes(state.stages[s.id]?.state)" class="h-3.5 w-3.5 mt-px text-emerald-600 shrink-0" />
              <AlertCircle v-else-if="state.stages[s.id]?.state === 'error'" class="h-3.5 w-3.5 mt-px text-red-600 shrink-0" />
              <MinusCircle v-else-if="['skipped', 'stopped'].includes(state.stages[s.id]?.state)" class="h-3.5 w-3.5 mt-px text-muted-foreground shrink-0" />
              <Circle v-else class="h-3.5 w-3.5 mt-px text-muted-foreground/50 shrink-0" />
              <span :class="state.stages[s.id]?.state === 'waiting' ? 'text-muted-foreground' : ''">{{ i + 1 }}. {{ s.label }}</span>
              <span class="ml-auto text-muted-foreground text-right" :class="{ 'text-red-600': state.stages[s.id]?.state === 'error' }">{{ stageText(state.stages[s.id]) }}</span>
            </div>
            <div v-if="state.stages[s.id]?.state === 'running' && state.stages[s.id].total" class="mt-1 h-1 rounded bg-muted overflow-hidden" style="margin-left: 1.375rem">
              <div class="h-full bg-primary/70 transition-all" :style="{ width: `${100 * state.stages[s.id].done / state.stages[s.id].total}%` }" />
            </div>
          </li>
        </ol>
        <p v-if="state.running" class="mt-3 text-[11px] text-muted-foreground">
          You can close this panel or open another section; the scan carries on. Automations and journeys are read 10 at a time, so a large business unit takes a while the first time.
          The next check reuses what was loaded (for 30 minutes, or until Rescan).
        </p>
      </section>

      <!-- Results -->
      <section v-if="state.result" class="px-4 py-3" aria-label="Results">
        <div class="flex items-center gap-2 mb-3">
          <p class="text-xs flex-1"><strong>{{ total }}</strong> found. <span class="text-muted-foreground">Current business unit only.</span></p>
          <DownloadMenu :get-doc="buildDoc" :file-name="`where-used-${title}`" label="Download" />
        </div>
        <p v-if="state.result.note" class="mb-3 text-xs text-muted-foreground">{{ state.result.note }}</p>

        <div v-for="s in sections" :key="s.id" class="mb-4">
          <button class="w-full flex items-center gap-1.5 text-left text-xs font-semibold mb-1.5" :aria-expanded="!collapsed.has(s.id)" @click="toggle(collapsed, s.id)">
            <ChevronDown v-if="!collapsed.has(s.id)" class="h-3.5 w-3.5" /><ChevronRight v-else class="h-3.5 w-3.5" />
            {{ s.title }} <span v-if="!s.tree" class="font-normal text-muted-foreground">({{ s.items.length }})</span>
          </button>
          <template v-if="!collapsed.has(s.id)">
            <p v-if="s.unavailable" class="mb-1.5 text-xs text-red-600">This could not be loaded (see the Process steps above), so the list may be incomplete.</p>
            <p v-if="s.note" class="mb-1.5 text-[11px] text-muted-foreground">{{ s.note }}</p>

            <!-- Lineage -->
            <div v-if="s.tree" class="rounded-md border border-border p-2.5 text-xs space-y-3">
              <div v-for="[dir, heading, none] in [['up', 'Where its data comes from', 'Nothing writes to it that was found.'], ['down', 'Where its data goes', 'Nothing reads it that was found.']]" :key="dir">
                <template v-if="s.tree[dir]">
                  <p class="font-semibold mb-1">{{ heading }}</p>
                  <LineageNode v-if="s.tree[dir].children.length" :node="s.tree[dir]" :direction="dir" @pivot="pivotDE" />
                  <p v-else class="text-muted-foreground italic">{{ none }}</p>
                </template>
              </div>
              <p class="text-[11px] text-muted-foreground">Built from SQL queries, filters, imports and data extracts, by data extension name, up to 6 levels.</p>
            </div>

            <p v-else-if="!s.items.length" class="text-xs text-muted-foreground italic">{{ s.empty }}</p>
            <ul v-else class="space-y-2">
              <li v-for="m in s.items" :key="m.key" class="rounded-md border border-border p-2.5 text-xs">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[10px] uppercase tracking-wide text-muted-foreground">{{ m.kind }}</span>
                  <button v-if="m.route" class="font-medium text-sm text-primary hover:underline text-left" @click="go(m.route)">{{ m.title }}</button>
                  <span v-else class="font-medium text-sm">{{ m.title }}</span>
                  <template v-for="(b, bi) in m.badges" :key="bi">
                    <StatusBadge v-if="b.tone === 'status' && b.text" :status="b.text" />
                    <span v-else-if="b.text && b.tone !== 'status'" class="rounded-full px-1.5 py-px text-[10px] font-semibold" :class="TONES[b.tone] || TONES.info">{{ b.text }}</span>
                  </template>
                  <div class="flex-1" />
                  <a v-if="m.href" :href="m.href" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 text-primary hover:underline">SFMC <ExternalLink class="h-3 w-3" /></a>
                  <button v-if="m.pivot" class="inline-flex items-center gap-0.5 text-primary hover:underline" :title="`Where is ${m.pivot.de?.name || m.title} used?`" @click="follow(m.pivot)"><Network class="h-3 w-3" /> Where used</button>
                </div>
                <p v-for="(l, li) in m.lines" :key="li" class="mt-0.5 text-muted-foreground">{{ l }}</p>
                <div v-if="m.automations !== undefined" class="mt-1.5">
                  <p v-if="m.automations === null" class="text-muted-foreground italic">Automations could not be checked.</p>
                  <p v-else-if="!m.automations.length" class="text-muted-foreground italic">Not in any automation.</p>
                  <ul v-else class="space-y-1">
                    <li v-for="a in m.automations" :key="`${a.automationId}-${a.step}`" class="flex flex-wrap items-center gap-1.5">
                      <button class="text-primary hover:underline font-medium" @click="go(`/automations/${encodeURIComponent(a.automationId)}`)">{{ a.name }}</button>
                      <span class="text-muted-foreground">step {{ a.step }}{{ a.stepName ? ` (${a.stepName})` : '' }}</span>
                      <StatusBadge :status="a.status" />
                      <span v-if="a.lastRunTime" class="text-muted-foreground">last run {{ formatDateTime(a.lastRunTime) }}</span>
                    </li>
                  </ul>
                </div>
                <template v-if="m.code?.text">
                  <button class="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline" :aria-expanded="openCode.has(m.key)" @click="toggle(openCode, m.key)">
                    <ChevronDown v-if="openCode.has(m.key)" class="h-3.5 w-3.5" /><ChevronRight v-else class="h-3.5 w-3.5" /> {{ m.code.lang === 'sql' ? 'SQL' : 'Code' }}
                  </button>
                  <div v-if="openCode.has(m.key)" class="mt-1.5"><CodeView :code="m.code.text" :lang="m.code.lang" max-height="260px" /></div>
                </template>
              </li>
            </ul>
          </template>
        </div>

        <p class="mt-4 text-[11px] text-muted-foreground">
          Only the current business unit is checked. Matches in SQL are by data extension name after FROM or JOIN (comments ignored) and by target key or ID;
          matches in AMPscript, SSJS and journey criteria are by name or key and can miss names built in code. Items with the same name in other business units can't be told apart.
        </p>
      </section>
    </div>
  </aside>
</template>

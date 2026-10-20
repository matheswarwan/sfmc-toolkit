<script setup>
// Automation Templates (feedback #38): pick a template, fill in its options, read
// exactly what will be created, then create it in SFMC. Nothing is scheduled or run.
import { computed, reactive, ref } from 'vue'
import { ExternalLink, Loader2, Check, X, ChevronRight } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import CodeView from '@/components/results/CodeView.vue'
import { useStack } from '@/composables/useStack.js'
import { TEMPLATES, createFromPlan } from '@/utils/templates/index.js'
import { contactBuilderDEUrl, automationStudioUrl } from '@/utils/activityTypes.js'
import { QUERY_UPDATE_TYPES } from '@/utils/sfmcApi.js'

const { stack } = useStack()
const picked = ref(TEMPLATES[0])
const values = reactive({})
const reset = (t) => { for (const k of Object.keys(values)) delete values[k]; Object.assign(values, JSON.parse(JSON.stringify(t.defaults))) }
reset(picked.value)
function pick(t) { picked.value = t; reset(t); progress.value = []; result.value = null }

const plan = computed(() => {
  try { return { ok: picked.value.plan({ ...values }) } } catch (e) { return { error: e.message } }
})
const shown = (opt) => !opt.showIf || values[opt.showIf]
function toggleChoice(key, choice) {
  const list = values[key]
  const i = list.indexOf(choice)
  i >= 0 ? list.splice(i, 1) : list.push(choice)
}

const creating = ref(false)
const progress = ref([])
const result = ref(null)

async function create() {
  const p = plan.value.ok
  if (!p || !stack.value) return
  const ok = window.confirm(
    `Create in SFMC (${stack.value}): ${p.des.length} data extension(s), ${p.queries.length} Query activit${p.queries.length === 1 ? 'y' : 'ies'} and the automation "${p.automation.name}"?\n\nNothing is scheduled or run.`
  )
  if (!ok) return
  creating.value = true
  progress.value = []
  result.value = null
  const r = await createFromPlan(stack.value, p, (entry) => {
    const i = progress.value.findIndex((x) => x.kind === entry.kind && x.name === entry.name)
    i >= 0 ? progress.value.splice(i, 1, entry) : progress.value.push(entry)
  })
  result.value = r
  creating.value = false
}

const KIND = { de: 'Data extension', query: 'Query activity', automation: 'Automation', setup: 'Setup' }
</script>

<template>
  <div class="h-full flex min-h-0">
    <nav class="w-64 shrink-0 border-r border-border bg-card p-3 space-y-1 overflow-y-auto" aria-label="Templates">
      <p class="px-2 pb-2 text-xs text-muted-foreground">Ready-made automations. The Toolkit creates them; you run them.</p>
      <button v-for="t in TEMPLATES" :key="t.id" class="w-full text-left px-2 py-2 rounded-md text-sm hover:bg-accent"
        :class="picked.id === t.id ? 'bg-accent font-medium' : ''" @click="pick(t)">
        <span class="flex items-center gap-1">{{ t.title }} <ChevronRight v-if="picked.id === t.id" class="h-3.5 w-3.5 ml-auto" /></span>
      </button>
    </nav>

    <div class="flex-1 min-w-0 overflow-y-auto p-5 space-y-5 text-sm">
      <header>
        <h1 class="text-lg font-semibold">{{ picked.title }}</h1>
        <p class="text-muted-foreground mt-1">{{ picked.summary }}</p>
        <a v-if="picked.source" :href="picked.source.url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline">
          Based on {{ picked.source.label }} <ExternalLink class="h-3 w-3" />
        </a>
      </header>

      <section v-if="picked.before?.length" class="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
        <h2 class="font-semibold mb-1">Before you start</h2>
        <ol class="list-decimal pl-5 space-y-1 text-xs"><li v-for="(b, i) in picked.before" :key="i">{{ b }}</li></ol>
      </section>

      <section class="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 class="font-semibold">Options</h2>
        <template v-for="opt in picked.options" :key="opt.key">
          <div v-if="shown(opt)">
            <label v-if="opt.type === 'checkbox'" class="flex items-center gap-2 text-sm">
              <input v-model="values[opt.key]" type="checkbox" /> {{ opt.label }}
            </label>
            <div v-else-if="opt.type === 'multi'">
              <div class="text-xs font-medium mb-1">{{ opt.label }}</div>
              <div class="flex flex-wrap gap-3">
                <label v-for="c in opt.choices" :key="c" class="flex items-center gap-1.5 text-xs font-mono">
                  <input type="checkbox" :checked="values[opt.key].includes(c)" @change="toggleChoice(opt.key, c)" /> {{ c }}
                </label>
              </div>
            </div>
            <label v-else class="block">
              <span class="text-xs font-medium">{{ opt.label }}</span>
              <input v-if="opt.type === 'number'" v-model.number="values[opt.key]" type="number" :min="opt.min" :max="opt.max"
                class="mt-1 block h-8 w-24 rounded-md border border-border bg-background px-2 text-xs" />
              <input v-else v-model.trim="values[opt.key]" type="text" class="mt-1 block h-8 w-full max-w-md rounded-md border border-border bg-background px-2 text-xs" />
              <span v-if="opt.help" class="block text-xs text-muted-foreground mt-0.5">{{ opt.help }}</span>
            </label>
          </div>
        </template>
      </section>

      <section class="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 class="font-semibold">What will be created</h2>
        <p v-if="plan.error" class="text-red-600 text-xs" role="alert">{{ plan.error }}</p>
        <template v-else>
          <div>
            <div class="text-xs font-medium mb-1">Data extensions (in the Data Extensions folder)</div>
            <ul class="text-xs space-y-1">
              <li v-for="d in plan.ok.des" :key="d.ref">
                <span class="font-mono">{{ d.name }}</span>
                <span class="text-muted-foreground"> · key {{ d.key }} · {{ d.fields.length }} fields{{ d.sendableField ? ` · sendable (${d.sendableField} to Subscriber Key)` : '' }} · primary key {{ d.fields.filter((f) => f.isPrimaryKey).map((f) => f.name).join(', ') || 'none' }}</span>
              </li>
            </ul>
          </div>
          <div>
            <div class="text-xs font-medium mb-1">Query activities</div>
            <details v-for="q in plan.ok.queries" :key="q.ref" class="mb-1">
              <summary class="cursor-pointer text-xs">
                <span class="font-mono">{{ q.name }}</span>
                <span class="text-muted-foreground"> → {{ plan.ok.des.find((d) => d.ref === q.target)?.name }} ({{ QUERY_UPDATE_TYPES[q.updateType] }})</span>
              </summary>
              <div class="mt-1"><CodeView :code="q.sql" lang="sql" /></div>
            </details>
          </div>
          <div>
            <div class="text-xs font-medium mb-1">Automation (not scheduled, not run)</div>
            <p class="text-xs font-mono">{{ plan.ok.automation.name }}</p>
            <ol class="list-decimal pl-5 text-xs text-muted-foreground">
              <li v-for="s in plan.ok.automation.steps" :key="s.name">{{ s.queries.map((r) => plan.ok.queries.find((q) => q.ref === r).name).join(', ') }}</li>
            </ol>
          </div>
          <div class="flex items-center gap-3">
            <Button size="sm" class="h-8 text-xs" :disabled="creating || !stack" @click="create">
              <Loader2 v-if="creating" class="h-3.5 w-3.5 mr-1 animate-spin" /> Create in SFMC
            </Button>
            <span class="text-xs text-muted-foreground">{{ stack ? `In the business unit you are logged in to (${stack}).` : 'Not connected to Marketing Cloud.' }}</span>
          </div>
        </template>
      </section>

      <section v-if="progress.length" class="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 class="font-semibold">{{ creating ? 'Creating...' : result?.failed ? 'Stopped' : 'Created' }}</h2>
        <ul class="text-xs space-y-1">
          <li v-for="e in progress" :key="e.kind + e.name" class="flex items-start gap-2">
            <Loader2 v-if="e.status === 'creating'" class="h-3.5 w-3.5 mt-0.5 animate-spin shrink-0" />
            <Check v-else-if="e.status === 'done'" class="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
            <X v-else class="h-3.5 w-3.5 mt-0.5 text-red-600 shrink-0" />
            <span>
              {{ KIND[e.kind] }} <span class="font-mono">{{ e.name }}</span>
              <a v-if="e.kind === 'de' && contactBuilderDEUrl(stack, e.id)" :href="contactBuilderDEUrl(stack, e.id)" target="_blank" rel="noopener" class="ml-1 text-primary hover:underline">SFMC</a>
              <a v-if="e.kind === 'automation' && e.status === 'done'" :href="automationStudioUrl(stack)" target="_blank" rel="noopener" class="ml-1 text-primary hover:underline">Automation Studio</a>
              <span v-if="e.error" class="block text-red-600">{{ e.error }}</span>
              <span v-if="e.note" class="block text-amber-700 dark:text-amber-400">{{ e.note }}</span>
            </span>
          </li>
        </ul>
        <p v-if="result?.failed && result.created.length" class="text-xs text-muted-foreground">
          The items above with a tick were created before it stopped. Fix the cause (for example the list or data extension name) and delete them in SFMC before creating again, or the names will clash.
        </p>
      </section>

      <section v-if="result && !result.failed" class="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3">
        <h2 class="font-semibold mb-1">Next steps</h2>
        <ol class="list-decimal pl-5 space-y-1 text-xs"><li v-for="(a, i) in picked.after(values)" :key="i">{{ a }}</li></ol>
      </section>
    </div>
  </div>
</template>

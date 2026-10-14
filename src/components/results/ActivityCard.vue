<script setup>
// One activity's details, from describeActivity() in utils/activityTypes.js: main
// properties, extra properties behind "Show additional details", code, tables.
import { computed, ref, watch } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import CodeView from './CodeView.vue'

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
</script>

<template>
  <article class="rounded-lg border border-border bg-card">
    <header class="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg">
      <span v-if="heading" class="text-[11px] text-muted-foreground tabular-nums">{{ heading }}</span>
      <span class="text-[10px] font-semibold uppercase tracking-wide text-primary">{{ d.typeLabel }}</span>
      <h3 class="flex-1 min-w-0 truncate text-sm font-semibold">{{ d.title }}</h3>
      <a v-if="d.link" :href="d.link" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0">
        Open in SFMC <ExternalLink class="h-3 w-3" />
      </a>
    </header>
    <div class="p-3 space-y-3 text-xs">
      <p v-if="d.note" class="text-muted-foreground italic">{{ d.note }}</p>
      <dl class="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-x-4 gap-y-1">
        <template v-for="([label, value], i) in d.main" :key="'m' + i">
          <dt class="text-muted-foreground">{{ label }}</dt><dd class="break-words">{{ value }}</dd>
        </template>
        <template v-if="showExtra">
          <template v-for="([label, value], i) in d.extra" :key="'e' + i">
            <dt class="text-muted-foreground">{{ label }}</dt><dd class="break-words font-mono text-[11px]">{{ value }}</dd>
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
            <tbody><tr v-for="(r, j) in t.rows" :key="j" class="border-t border-border"><td v-for="(c, k) in r" :key="k" class="px-2 py-1 align-top break-words">{{ c }}</td></tr></tbody>
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

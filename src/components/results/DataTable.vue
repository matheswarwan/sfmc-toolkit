<script setup>
// Result table shared by the Automation, Activity, DE, Journey and CloudPage screens.
// Columns can be hidden (remembered per table in localStorage, like Automation
// Viewer's Columns menu). Cells render with a `cell-<key>` slot when one is given;
// a row whose key is in `expanded` gets a full-width `expanded` slot below it.
// Headers render with a `head-<key>` slot when one is given.
import { computed, ref } from 'vue'
import { Columns3 } from 'lucide-vue-next'

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key, label, class?, hideable? }]
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  storageKey: { type: String, default: '' },
  expanded: { type: Set, default: () => new Set() },
  emptyText: { type: String, default: 'Nothing to show.' },
})

const hidden = ref(new Set())
try {
  const saved = props.storageKey && JSON.parse(localStorage.getItem(`toolkit_cols_${props.storageKey}`) || '[]')
  if (Array.isArray(saved)) hidden.value = new Set(saved)
} catch { /* storage blocked */ }

const visible = computed(() => props.columns.filter((c) => !hidden.value.has(c.key)))
const menuOpen = ref(false)

function toggle(key) {
  const next = new Set(hidden.value)
  next.has(key) ? next.delete(key) : next.add(key)
  hidden.value = next
  try { if (props.storageKey) localStorage.setItem(`toolkit_cols_${props.storageKey}`, JSON.stringify([...next])) } catch { /* storage blocked */ }
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card">
    <div v-if="columns.some((c) => c.hideable !== false)" class="flex justify-end px-2 pt-2 relative">
      <button class="flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:bg-accent" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
        <Columns3 class="h-3.5 w-3.5" /> Columns
      </button>
      <template v-if="menuOpen">
        <div class="fixed inset-0 z-30" @click="menuOpen = false" />
        <div class="absolute right-2 top-9 z-40 w-48 rounded-md border border-border bg-popover shadow-lg py-1">
          <label v-for="c in columns.filter((c) => c.hideable !== false)" :key="c.key" class="flex items-center gap-2 px-3 py-1 text-xs hover:bg-accent cursor-pointer">
            <input type="checkbox" :checked="!hidden.has(c.key)" @change="toggle(c.key)" /> {{ c.label }}
          </label>
        </div>
      </template>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-border text-left text-muted-foreground">
            <th v-for="c in visible" :key="c.key" class="px-3 py-2 font-semibold whitespace-nowrap" :class="c.class">
              <slot :name="`head-${c.key}`">{{ c.label }}</slot>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length"><td :colspan="visible.length" class="px-3 py-6 text-center text-muted-foreground">{{ emptyText }}</td></tr>
          <template v-for="row in rows" :key="row[rowKey]">
            <tr class="border-b border-border last:border-0 hover:bg-muted/40 align-top">
              <td v-for="c in visible" :key="c.key" class="px-3 py-2" :class="c.class">
                <slot :name="`cell-${c.key}`" :row="row">{{ row[c.key] ?? '' }}</slot>
              </td>
            </tr>
            <tr v-if="expanded.has(row[rowKey])" class="border-b border-border bg-muted/20">
              <td :colspan="visible.length" class="px-3 py-3"><slot name="expanded" :row="row" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

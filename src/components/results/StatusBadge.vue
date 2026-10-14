<script setup>
// Coloured pill for SFMC status values (from Automation Viewer's sfmcStatusBadge).
import { computed } from 'vue'
const props = defineProps({ status: { type: [String, Number], default: '' } })
const tone = computed(() => {
  const s = String(props.status || '').toLowerCase()
  if (/error|fail/.test(s)) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
  if (/paused|stopped|draft|unpublished|inactive|building/.test(s)) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  if (/running|scheduled|queued|ready/.test(s)) return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
  if (/complete|published|active|success/.test(s)) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  return 'bg-muted text-muted-foreground'
})
</script>

<template>
  <span v-if="status !== '' && status != null" class="inline-block rounded-full px-2 py-px text-[11px] font-medium whitespace-nowrap" :class="tone">{{ status }}</span>
  <span v-else class="text-muted-foreground">—</span>
</template>

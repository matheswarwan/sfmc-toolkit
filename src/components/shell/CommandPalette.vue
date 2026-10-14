<script setup>
// Ctrl+K / Cmd+K: jump to any section. Step 7 adds saved queries, DEs and automations.
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { NAV_ITEMS } from '@/app/nav.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const router = useRouter()

const query = ref('')
const active = ref(0)
const input = ref(null)

const entries = computed(() => {
  const all = [...NAV_ITEMS, { path: '/settings', name: 'Settings', group: 'App' }]
  const q = query.value.trim().toLowerCase()
  return q ? all.filter((e) => `${e.group} ${e.name}`.toLowerCase().includes(q)) : all
})

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  active.value = 0
  await nextTick()
  input.value?.focus()
})
watch(query, () => { active.value = 0 })

function go(entry) {
  if (!entry) return
  router.push(entry.path)
  emit('close')
}

function onKey(e) {
  if (e.key === 'ArrowDown') { active.value = Math.min(active.value + 1, entries.value.length - 1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(active.value - 1, 0); e.preventDefault() }
  else if (e.key === 'Enter') go(entries.value[active.value])
  else if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40" @mousedown.self="emit('close')">
    <div class="w-full max-w-lg mx-4 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden" role="dialog" aria-label="Search">
      <div class="flex items-center gap-2 px-3 border-b border-border">
        <Search class="h-4 w-4 text-muted-foreground" />
        <input
          ref="input"
          v-model="query"
          class="flex-1 h-11 bg-transparent outline-none text-sm"
          placeholder="Go to…"
          @keydown="onKey"
        />
        <kbd class="text-[10px] text-muted-foreground border border-border rounded px-1">Esc</kbd>
      </div>
      <ul class="max-h-80 overflow-y-auto py-1">
        <li v-for="(e, i) in entries" :key="e.path">
          <button
            class="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left"
            :class="i === active ? 'bg-accent text-accent-foreground' : ''"
            @mouseenter="active = i"
            @click="go(e)"
          >
            <component :is="e.icon" v-if="e.icon" class="h-4 w-4 text-muted-foreground" />
            <span class="flex-1">{{ e.name }}</span>
            <span class="text-xs text-muted-foreground">{{ e.group }}</span>
          </button>
        </li>
        <li v-if="!entries.length" class="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches.</li>
      </ul>
    </div>
  </div>
</template>

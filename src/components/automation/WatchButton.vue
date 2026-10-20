<script setup>
// Watch an automation (feedback #50): pick what to be told about. The service worker
// checks watched automations when the Toolkit opens and when an SFMC page loads.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { WATCHES_KEY, DEFAULT_ON, watchKey } from '@/utils/watches.js'
import { showToast } from '@/composables/useToast.js'

const props = defineProps({
  stack: { type: String, default: null },
  automation: { type: Object, default: null }, // { id, name, status, lastRunTime, lastRunStatus }
  automationId: { type: String, required: true }, // the ID the page was opened with
})

const watches = ref({})
const menu = ref(false)
const on = ref({ ...DEFAULT_ON })
const key = computed(() => watchKey(props.stack, props.automationId))
const current = computed(() => watches.value[key.value] || null)

const load = () => chrome.storage.local.get(WATCHES_KEY, (r) => { watches.value = r?.[WATCHES_KEY] || {} })
const onChange = (c, area) => { if (area === 'local' && WATCHES_KEY in c) watches.value = c[WATCHES_KEY].newValue || {} }
onMounted(() => { try { load(); chrome.storage.onChanged.addListener(onChange) } catch { /* not in an extension */ } })
onUnmounted(() => { try { chrome.storage.onChanged.removeListener(onChange) } catch { /* ignore */ } })

function open() {
  on.value = { ...DEFAULT_ON, ...(current.value?.on || {}) }
  menu.value = !menu.value
}
function save() {
  if (!props.stack) return
  const a = props.automation || {}
  const next = { ...watches.value }
  next[key.value] = {
    stack: props.stack, id: props.automationId, name: a.name || props.automationId, on: { ...on.value },
    // Changes are counted from now.
    last: current.value?.last || { status: a.status ?? null, lastRunTime: a.lastRunTime ?? null, lastRunStatus: a.lastRunStatus ?? null },
    addedAt: current.value?.addedAt || Date.now(),
  }
  chrome.storage.local.set({ [WATCHES_KEY]: next })
  menu.value = false
  showToast(`Watching ${a.name || 'this automation'}. You will see changes when you open SFMC Toolkit or an SFMC page.`)
}
function stop() {
  const next = { ...watches.value }
  delete next[key.value]
  chrome.storage.local.set({ [WATCHES_KEY]: next })
  menu.value = false
}
const OPTIONS = [
  ['paused', 'Paused or stopped'], ['activated', 'Activated (scheduled or running again)'], ['fails', 'A run fails'], ['runs', 'Every run'],
]
</script>

<template>
  <div class="relative">
    <button class="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-xs hover:bg-accent"
      :class="current ? 'border-primary/50 text-primary' : 'border-border'" :aria-expanded="menu" aria-haspopup="dialog" @click="open">
      <Eye class="h-3.5 w-3.5" /> {{ current ? 'Watching' : 'Watch' }}
    </button>
    <template v-if="menu">
      <div class="fixed inset-0 z-30" @click="menu = false" />
      <div class="absolute right-0 mt-1 z-40 w-72 rounded-md border border-border bg-popover shadow-lg p-3 text-xs space-y-2" role="dialog" aria-label="Watch this automation">
        <div class="font-semibold">Tell me when this automation</div>
        <label v-for="[k, label] in OPTIONS" :key="k" class="flex items-center gap-2"><input v-model="on[k]" type="checkbox" /> {{ label }}</label>
        <p class="text-muted-foreground">Checked when you open SFMC Toolkit, and at most every 15 minutes while you use SFMC. Changes show on the bell and the toolbar icon.</p>
        <div class="flex items-center gap-2 pt-1">
          <button class="h-7 px-2.5 rounded-md bg-primary text-primary-foreground font-medium" @click="save">{{ current ? 'Save' : 'Watch' }}</button>
          <button v-if="current" class="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border hover:bg-accent" @click="stop"><EyeOff class="h-3.5 w-3.5" /> Stop watching</button>
        </div>
      </div>
    </template>
  </div>
</template>

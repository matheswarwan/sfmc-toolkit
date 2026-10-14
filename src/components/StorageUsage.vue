<script setup>
import { ref, computed, onMounted } from 'vue'
import { Trash2, Loader2 } from 'lucide-vue-next'

const localBytes = ref(0)
const extBytes = ref(0)
const loading = ref(true)
const clearing = ref(false)

const totalBytes = computed(() => localBytes.value + extBytes.value)

function formatBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(2)} ${units[i]}`
}

function measureLocalStorage() {
  try {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const val = localStorage.getItem(key) ?? ''
      bytes += (key.length + val.length) * 2 // UTF-16 approximation
    }
    return bytes
  } catch {
    return 0
  }
}

function refresh() {
  loading.value = true
  localBytes.value = measureLocalStorage()
  try {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      extBytes.value = bytes || 0
      loading.value = false
    })
  } catch {
    loading.value = false
  }
}

async function clearAll() {
  const ok = window.confirm(
    'Clear ALL extension data?\n\n' +
    'This permanently deletes every saved query, saved email, Query Builder draft, ' +
    'and all settings. This cannot be undone.'
  )
  if (!ok) return
  clearing.value = true
  try {
    await new Promise((resolve) => chrome.storage.local.clear(resolve))
    try { localStorage.clear() } catch { /* ignore */ }
  } finally {
    // Reload so the UI reflects the now-empty state.
    window.location.reload()
  }
}

onMounted(refresh)
</script>

<template>
  <div class="text-xs">
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Storage Usage</span>
      <Loader2 v-if="loading" class="h-3 w-3 animate-spin text-muted-foreground" />
    </div>

    <div class="flex items-center justify-between py-0.5">
      <span class="text-muted-foreground">Local storage</span>
      <span class="text-[10px] font-medium bg-muted text-foreground rounded px-1.5 py-0.5">{{ formatBytes(localBytes) }}</span>
    </div>
    <div class="flex items-center justify-between py-0.5">
      <span class="text-muted-foreground">Chrome extension storage</span>
      <span class="text-[10px] font-medium bg-muted text-foreground rounded px-1.5 py-0.5">{{ formatBytes(extBytes) }}</span>
    </div>
    <div class="flex items-center justify-between py-0.5 border-t border-border mt-1 pt-1.5">
      <span class="font-semibold">Total</span>
      <span class="text-[10px] font-semibold bg-primary text-primary-foreground rounded px-1.5 py-0.5">{{ formatBytes(totalBytes) }}</span>
    </div>

    <button
      class="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md py-1.5 hover:bg-red-50 disabled:opacity-50"
      :disabled="clearing"
      @click="clearAll"
    >
      <Loader2 v-if="clearing" class="h-3.5 w-3.5 animate-spin" />
      <Trash2 v-else class="h-3.5 w-3.5" />
      {{ clearing ? 'Clearing…' : 'Clear all data' }}
    </button>
  </div>
</template>

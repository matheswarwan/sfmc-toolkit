<script setup>
// Automations (SFMC Automation Viewer's Automation Viewer tab): search by name or list
// all, newest run first; View opens the automation without pausing it.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Loader2 } from 'lucide-vue-next'
import DataTable from '@/components/results/DataTable.vue'
import StatusBadge from '@/components/results/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useStack } from '@/composables/useStack.js'
import { showToast } from '@/composables/useToast.js'
import { searchAutomations } from '@/utils/automationApi.js'
import { formatDateTime } from '@/utils/format.js'

const router = useRouter()
const { stack } = useStack()
const query = ref('')
const searched = ref(null)
const entries = ref([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')

async function search() {
  if (!stack.value) { error.value = 'Not connected to Marketing Cloud. Log in to SFMC in this browser.'; return }
  loading.value = true
  error.value = ''
  try {
    const r = await searchAutomations(stack.value, query.value, 0)
    entries.value = r.entries
    total.value = r.total
    searched.value = query.value.trim()
  } catch (e) {
    error.value = `Could not search automations: ${e.message}`
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const r = await searchAutomations(stack.value, searched.value, entries.value.length)
    entries.value = [...entries.value, ...r.entries]
  } catch (e) {
    showToast(`Could not load more: ${e.message}`)
  } finally {
    loadingMore.value = false
  }
}

const columns = [
  { key: 'name', label: 'Name', hideable: false },
  { key: 'status', label: 'Status' },
  { key: 'lastRunStatus', label: 'Last run' },
  { key: 'lastRunTime', label: 'Last run at', class: 'whitespace-nowrap' },
  { key: 'modifiedDate', label: 'Modified', class: 'whitespace-nowrap' },
  { key: 'actions', label: '', hideable: false, class: 'text-right' },
]
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-card">
      <form class="flex items-center gap-2" @submit.prevent="search">
        <div class="relative">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input v-model="query" type="search" placeholder="Automation name (empty lists all)" aria-label="Automation name"
            class="h-8 w-72 rounded-md border border-border bg-background pl-7 pr-2 text-xs" />
        </div>
        <Button size="sm" class="h-8 text-xs" type="submit" :disabled="loading"><Loader2 v-if="loading" class="h-3.5 w-3.5 mr-1 animate-spin" /> Search</Button>
      </form>
      <span class="text-xs text-muted-foreground">Viewing an automation never pauses or changes it.</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <p v-if="error" class="mb-3 text-sm text-red-600" role="alert">{{ error }}</p>
      <div v-if="searched === null && !loading" class="max-w-md mx-auto mt-12 text-center text-sm text-muted-foreground">
        Search for an automation by name, or search with an empty box to list all, most recently run first.
      </div>
      <template v-else-if="searched !== null">
        <p class="mb-2 text-xs text-muted-foreground">{{ total.toLocaleString() }} found{{ searched ? ` for "${searched}"` : '' }}.</p>
        <DataTable :columns="columns" :rows="entries" row-key="id" storage-key="automations" empty-text="No automations found.">
          <template #cell-name="{ row }">
            <RouterLink :to="`/automations/${encodeURIComponent(row.id)}`" class="font-medium hover:underline">{{ row.name || 'Untitled automation' }}</RouterLink>
          </template>
          <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
          <template #cell-lastRunStatus="{ row }"><StatusBadge :status="row.lastRunStatus" /></template>
          <template #cell-lastRunTime="{ row }">{{ formatDateTime(row.lastRunTime) }}</template>
          <template #cell-modifiedDate="{ row }">{{ formatDateTime(row.modifiedDate) }}</template>
          <template #cell-actions="{ row }">
            <button class="text-primary hover:underline" @click="router.push(`/automations/${encodeURIComponent(row.id)}`)">View</button>
          </template>
        </DataTable>
        <div v-if="entries.length < total" class="mt-3 text-center">
          <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="h-3.5 w-3.5 mr-1 animate-spin" /> Load more ({{ entries.length }} of {{ total }})
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

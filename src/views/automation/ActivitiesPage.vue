<script setup>
// Activities by type (SFMC Automation Viewer's View Activity Details): Query, Script,
// Import, Data Extract, File Transfer, Filter. Search by name, list all, or fetch
// every one (50 a request, up to 2,000), with each activity's details.
import { computed, ref } from 'vue'
import { Search, Loader2, ListChecks } from 'lucide-vue-next'
import ActivityCard from '@/components/results/ActivityCard.vue'
import DownloadMenu from '@/components/results/DownloadMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import { useStack, whenStack } from '@/composables/useStack.js'
import { useRouteSearch } from '@/composables/useRouteSearch.js'
import { showToast } from '@/composables/useToast.js'
import { ACTIVITY_SEARCH_TYPES, searchActivities, fetchAllActivities, fetchActivityDetails } from '@/utils/automationApi.js'
import { describeActivity, activityBlocks } from '@/utils/activityTypes.js'

const { stack } = useStack()
const type = ref(ACTIVITY_SEARCH_TYPES[0])
const query = ref('')
const searched = ref(null) // { type, query, all }
const items = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const fetchProgress = ref(null) // { done, total } while fetching all
const error = ref('')
const showAllFields = ref(false)

// Filters come back from the list without their definition; fetch it on demand.
const filterDetails = ref({})

const descs = computed(() => items.value.map((it) => describeActivity(searched.value.type.objectTypeId,
  filterDetails.value[it.filterActivityId] || it, stack.value)))

function pickType(t) {
  type.value = t
  searched.value = null
  items.value = []
  error.value = ''
}

async function search() {
  if (!stack.value) { error.value = 'Not connected to Marketing Cloud. Log in to SFMC in this browser.'; return }
  loading.value = true
  error.value = ''
  try {
    const r = await searchActivities(stack.value, type.value.endpoint, query.value, 1)
    items.value = r.items
    total.value = r.total
    page.value = 1
    searched.value = { type: type.value, query: query.value.trim(), all: false }
    filterDetails.value = {}
  } catch (e) {
    error.value = `Could not search ${type.value.label} activities: ${e.message}`
  } finally {
    loading.value = false
  }
}

async function fetchAll() {
  if (!stack.value) { error.value = 'Not connected to Marketing Cloud. Log in to SFMC in this browser.'; return }
  error.value = ''
  fetchProgress.value = { done: 0, total: 0 }
  try {
    const r = await fetchAllActivities(stack.value, type.value.endpoint, (done, t) => { fetchProgress.value = { done, total: t } })
    items.value = r.items
    total.value = r.items.length
    searched.value = { type: type.value, query: '', all: true }
    filterDetails.value = {}
    if (r.capped) showToast(`Showing the first ${r.items.length.toLocaleString()} of ${r.total.toLocaleString()}.`)
  } catch (e) {
    error.value = `Could not fetch ${type.value.label} activities: ${e.message}`
  } finally {
    fetchProgress.value = null
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const r = await searchActivities(stack.value, searched.value.type.endpoint, searched.value.query, page.value + 1)
    items.value = [...items.value, ...r.items]
    page.value++
  } catch (e) {
    showToast(`Could not load more: ${e.message}`)
  } finally {
    loadingMore.value = false
  }
}

async function loadFilterDefinitions() {
  const missing = items.value.filter((it) => it.filterActivityId && !filterDetails.value[it.filterActivityId])
  for (const it of missing) {
    try {
      filterDetails.value = { ...filterDetails.value, [it.filterActivityId]: await fetchActivityDetails(stack.value, { objectTypeId: 303, activityObjectId: it.filterActivityId }) }
    } catch { /* keep the list item */ }
  }
}

// From Ctrl+K: searches the selected type (Query unless another was picked).
useRouteSearch('/activities', (q) => { query.value = q; whenStack(search) })

function getDoc() {
  const s = searched.value
  return {
    title: s.query ? `${s.type.label} activities matching "${s.query}"` : `${s.type.label} activities`,
    blocks: descs.value.flatMap((d) => activityBlocks(d, '', 2)),
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-card">
      <div class="flex flex-wrap gap-1" role="group" aria-label="Activity type">
        <button v-for="t in ACTIVITY_SEARCH_TYPES" :key="t.id" class="h-8 px-3 rounded-full border text-xs"
          :class="type.id === t.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'"
          :aria-pressed="type.id === t.id" @click="pickType(t)">{{ t.label }}</button>
      </div>
      <form class="flex items-center gap-2" @submit.prevent="search">
        <div class="relative">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input v-model="query" type="search" :placeholder="`${type.label} name (empty lists all)`" :aria-label="`${type.label} activity name`"
            class="h-8 w-60 rounded-md border border-border bg-background pl-7 pr-2 text-xs" />
        </div>
        <Button size="sm" class="h-8 text-xs" type="submit" :disabled="loading"><Loader2 v-if="loading" class="h-3.5 w-3.5 mr-1 animate-spin" /> Search</Button>
      </form>
      <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="!!fetchProgress" @click="fetchAll">
        <Loader2 v-if="fetchProgress" class="h-3.5 w-3.5 mr-1 animate-spin" /><ListChecks v-else class="h-3.5 w-3.5 mr-1" />
        {{ fetchProgress ? `Fetching ${fetchProgress.done}${fetchProgress.total ? ` of ${fetchProgress.total}` : ''}` : 'Fetch all' }}
      </Button>
      <div class="flex-1" />
      <template v-if="searched && items.length">
        <label class="flex items-center gap-1.5 text-xs text-muted-foreground"><input v-model="showAllFields" type="checkbox" /> All fields</label>
        <Button v-if="searched.type.id === 'filter' && items.some((it) => !filterDetails[it.filterActivityId])" variant="outline" size="sm" class="h-8 text-xs" @click="loadFilterDefinitions">Load filter definitions</Button>
        <DownloadMenu :get-doc="getDoc" :file-name="`${searched.type.label}-activities`" />
      </template>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <p v-if="error" class="mb-3 text-sm text-red-600" role="alert">{{ error }}</p>
      <div v-if="!searched && !loading" class="max-w-md mx-auto mt-12 text-center text-sm text-muted-foreground">
        Pick a type, then search by name, search with an empty box to list all (newest first), or use Fetch all to load every one.
      </div>
      <template v-else-if="searched">
        <p class="mb-2 text-xs text-muted-foreground">
          {{ total.toLocaleString() }} {{ searched.type.label }} {{ total === 1 ? 'activity' : 'activities' }}{{ searched.query ? ` for "${searched.query}"` : '' }}{{ items.length < total ? `, ${items.length} shown` : '' }}.
        </p>
        <p v-if="!items.length" class="text-sm text-muted-foreground">No {{ searched.type.label }} activities found.</p>
        <div class="space-y-3">
          <ActivityCard v-for="(d, i) in descs" :key="i" :description="d" :show-all-fields="showAllFields" />
        </div>
        <div v-if="!searched.all && items.length < total" class="mt-3 text-center">
          <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="h-3.5 w-3.5 mr-1 animate-spin" /> Load more ({{ items.length }} of {{ total }})
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

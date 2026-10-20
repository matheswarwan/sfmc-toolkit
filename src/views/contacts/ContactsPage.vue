<script setup>
// Contacts (feedback #57): how many contacts the account has, and a Contact Key
// search with the attributes Contact Builder returns.
import { ref } from 'vue'
import { Loader2, RefreshCw, Search, ChevronDown, ChevronRight } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useStack, whenStack } from '@/composables/useStack.js'
import { fetchContactCount, searchContactKey } from '@/utils/contactsApi.js'
import { formatDateTime } from '@/utils/format.js'

const { stack } = useStack()

const count = ref(null)
const countBusy = ref(false)
const countError = ref('')
async function loadCount() {
  if (!stack.value) { countError.value = 'Not connected to Marketing Cloud.'; return }
  countBusy.value = true
  countError.value = ''
  try {
    count.value = await fetchContactCount(stack.value)
  } catch (e) {
    countError.value = `Could not read the contact count: ${e.message}. Open Contact Builder once in SFMC, then Refresh.`
  } finally {
    countBusy.value = false
  }
}

const key = ref('')
const result = ref(null)
const searchBusy = ref(false)
const searchError = ref('')
const openRows = ref({})
async function search() {
  searchBusy.value = true
  searchError.value = ''
  openRows.value = {}
  try {
    result.value = await searchContactKey(stack.value, key.value)
    if (result.value.contacts.length === 1) openRows.value = { 0: true }
  } catch (e) {
    result.value = null
    searchError.value = `Search failed: ${e.message}`
  } finally {
    searchBusy.value = false
  }
}
const showRaw = ref(false)
// Last, so everything loadCount() touches is defined when it runs straight away.
whenStack(loadCount)
</script>

<template>
  <div class="h-full overflow-y-auto p-4 space-y-4 text-sm">
    <div class="flex items-center gap-2">
      <h1 class="text-base font-semibold flex-1">Contacts</h1>
      <Button variant="outline" size="sm" class="h-8 text-xs" :disabled="countBusy" @click="loadCount">
        <Loader2 v-if="countBusy" class="h-3.5 w-3.5 mr-1 animate-spin" /><RefreshCw v-else class="h-3.5 w-3.5 mr-1" /> Refresh
      </Button>
    </div>

    <section class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-lg border border-border bg-card p-3">
        <div class="text-xs text-muted-foreground">Contact count</div>
        <div class="text-2xl font-semibold tabular-nums">
          <Loader2 v-if="countBusy && count === null" class="h-5 w-5 animate-spin" />
          <template v-else>{{ count === null ? '—' : count.toLocaleString() }}</template>
        </div>
        <div class="text-[11px] text-muted-foreground">All contacts in Contact Builder (the whole account, not one business unit).</div>
      </div>
    </section>
    <p v-if="countError" class="text-red-600 text-xs" role="alert">{{ countError }}</p>

    <section class="rounded-lg border border-border bg-card p-3 space-y-2">
      <h2 class="font-semibold">Find a contact</h2>
      <form class="flex flex-wrap items-end gap-2 text-xs" @submit.prevent="search">
        <label class="flex flex-col gap-0.5">Contact Key (exact)
          <input v-model="key" type="search" class="h-8 w-72 rounded-md border border-border bg-background px-2" placeholder="e.g. 0031x00000AbCdE" />
        </label>
        <Button size="sm" class="h-8 text-xs" :disabled="searchBusy || !key.trim() || !stack" type="submit">
          <Loader2 v-if="searchBusy" class="h-3.5 w-3.5 mr-1 animate-spin" /><Search v-else class="h-3.5 w-3.5 mr-1" /> Search
        </Button>
      </form>
      <p v-if="searchError" class="text-red-600 text-xs" role="alert">{{ searchError }}</p>
      <template v-if="result">
        <p class="text-xs text-muted-foreground">{{ result.contacts.length ? `${result.total} found.` : 'No contact has that key.' }}</p>
        <table v-if="result.contacts.length" class="w-full text-xs">
          <thead><tr class="text-left text-muted-foreground border-b border-border"><th class="py-1 pr-3 w-5"></th><th class="py-1 pr-3">Contact Key</th><th class="py-1 pr-3">Contact ID</th><th class="py-1 pr-3">Created</th><th class="py-1 pr-3">Modified</th></tr></thead>
          <tbody>
            <template v-for="(c, i) in result.contacts" :key="c.contactId || i">
              <tr class="border-b border-border/50 cursor-pointer hover:bg-muted/40" @click="openRows[i] = !openRows[i]">
                <td class="py-1 pr-1"><ChevronDown v-if="openRows[i]" class="h-3 w-3" /><ChevronRight v-else class="h-3 w-3" /></td>
                <td class="py-1 pr-3 font-medium font-mono">{{ c.contactKey || '—' }}</td>
                <td class="py-1 pr-3 tabular-nums">{{ c.contactId || '—' }}</td>
                <td class="py-1 pr-3 whitespace-nowrap">{{ c.createdDate ? formatDateTime(c.createdDate) : '—' }}</td>
                <td class="py-1 pr-3 whitespace-nowrap">{{ c.modifiedDate ? formatDateTime(c.modifiedDate) : '—' }}</td>
              </tr>
              <tr v-if="openRows[i]" class="border-b border-border/50">
                <td></td>
                <td colspan="4" class="py-2 pr-3">
                  <p v-if="!c.values.length" class="text-muted-foreground">Contact Builder sent no attribute values for this contact.</p>
                  <dl v-else class="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-0.5">
                    <template v-for="(v, j) in c.values" :key="j">
                      <dt class="text-muted-foreground">{{ v.set ? `${v.set}: ` : '' }}{{ v.name }}</dt>
                      <dd class="break-all">{{ v.value || '—' }}</dd>
                    </template>
                  </dl>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <button v-if="result.contacts.length" class="text-xs text-primary hover:underline" @click="showRaw = !showRaw">{{ showRaw ? 'Hide' : 'Show' }} the response from Contact Builder</button>
        <pre v-if="showRaw" class="max-h-96 overflow-auto rounded bg-muted p-2 text-[11px]">{{ JSON.stringify(result.contacts.map((c) => c.raw), null, 2) }}</pre>
      </template>
    </section>
  </div>
</template>

<script setup>
// Query Builder section. Kept alive while you visit other sections; `?id=` opens a
// saved Query Builder query, New starts an empty one.
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FilePlus2 } from 'lucide-vue-next'
import QueryBuilder from '@/components/builder/QueryBuilder.vue'
import Button from '@/components/ui/button/Button.vue'

const LAST_BUILDER_KEY = 'toolkit_lastBuilder'

const route = useRoute()
const router = useRouter()
const openId = ref(null)
const session = ref(0) // a new value remounts the builder

function open(id) {
  openId.value = id
  session.value++
}

function onSaved(id) {
  openId.value = id
  chrome.storage.local.set({ [LAST_BUILDER_KEY]: id })
}

function startNew() {
  chrome.storage.local.remove(LAST_BUILDER_KEY)
  open(null)
}

// First visit: the query asked for, else the one you were last building.
const first = typeof route.query.id === 'string' ? route.query.id : null
if (first) open(first)
else chrome.storage.local.get(LAST_BUILDER_KEY, (r) => { if (r?.[LAST_BUILDER_KEY]) open(r[LAST_BUILDER_KEY]); else session.value++ })

watch(() => route.query.id, (id) => {
  if (route.path !== '/queries/builder' || typeof id !== 'string') return
  if (id !== openId.value) open(id)
  router.replace({ path: route.path })
})
if (first) router.replace({ path: route.path })
</script>

<template>
  <QueryBuilder v-if="session" :key="session" :open-id="openId" @saved="onSaved">
    <template #actions>
      <Button variant="ghost" size="sm" class="h-8 text-xs" title="Start a new query; this one stays saved" @click="startNew">
        <FilePlus2 class="h-3.5 w-3.5 mr-1" /> New query
      </Button>
    </template>
  </QueryBuilder>
</template>

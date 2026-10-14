<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Search } from 'lucide-vue-next'
import { useTheme } from './composables/useTheme.js'
import { FEATURE_GROUPS } from './data/features.js'
import { TODO_GROUPS, TODO_STATUS_LABELS } from './data/todo.js'

// features.html and todo.html: a plain reference page and a list of what is
// coming. Content lives in src/data/features.js and src/data/todo.js.
const props = defineProps({
  page: { type: String, default: 'features' },
})

const { loadTheme } = useTheme()
onMounted(() => {
  loadTheme()
  document.title = props.page === 'todo' ? 'SFMC Query Saver: To do' : 'SFMC Query Saver: Features'
})

const version = (() => {
  try { return chrome.runtime.getManifest().version } catch { return '' }
})()

const query = ref('')
const filteredFeatures = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return FEATURE_GROUPS
  return FEATURE_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(f =>
        [f.title, f.how, f.detail, g.title].filter(Boolean).some(t => t.toLowerCase().includes(q))),
    }))
    .filter(g => g.items.length)
})
const featureCount = computed(() => FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0))

function pageUrl(name) {
  try { return chrome.runtime.getURL(name) } catch { return name }
}
function goBack() {
  window.location.href = pageUrl('index.html')
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="flex items-center gap-3 px-5 py-3 border-b border-border bg-card sticky top-0 z-10">
      <button
        class="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Back to saved queries"
        @click="goBack"
      >
        <ArrowLeft class="h-4 w-4" />
      </button>
      <h1 class="text-sm font-bold">SFMC Query Saver</h1>
      <span v-if="version" class="text-[10px] text-muted-foreground">v{{ version }}</span>
      <nav class="ml-auto flex gap-1 text-xs">
        <a
          :href="pageUrl('features.html')"
          class="px-2.5 py-1 rounded-md border"
          :class="page === 'features' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
        >Features</a>
        <a
          :href="pageUrl('todo.html')"
          class="px-2.5 py-1 rounded-md border"
          :class="page === 'todo' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'"
        >To do</a>
      </nav>
    </header>

    <main class="max-w-3xl mx-auto px-5 py-6">
      <!-- Features -->
      <template v-if="page === 'features'">
        <h2 class="text-lg font-bold">Features</h2>
        <p class="text-sm text-muted-foreground mt-1">
          What the extension does, screen by screen ({{ featureCount }} features).
        </p>

        <div class="relative mt-4">
          <Search class="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="query"
            type="search"
            placeholder="Search features"
            class="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <nav v-if="!query" class="flex flex-wrap gap-1.5 mt-3 text-xs">
          <a v-for="g in FEATURE_GROUPS" :key="g.id" :href="`#${g.id}`"
            class="px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground">{{ g.title }}</a>
        </nav>

        <p v-if="!filteredFeatures.length" class="text-sm text-muted-foreground mt-6">No feature matches "{{ query }}".</p>

        <section v-for="g in filteredFeatures" :id="g.id" :key="g.id" class="mt-8 scroll-mt-16">
          <h3 class="text-base font-bold border-b border-border pb-1">{{ g.title }}</h3>
          <p v-if="g.intro" class="text-sm text-muted-foreground mt-2">{{ g.intro }}</p>
          <dl class="mt-3 space-y-4">
            <div v-for="f in g.items" :key="f.title">
              <dt class="text-sm font-semibold flex items-baseline gap-2 flex-wrap">
                {{ f.title }}
                <span v-if="f.since" class="text-[10px] font-medium px-1.5 py-px rounded-full bg-muted text-muted-foreground">new in {{ f.since }}</span>
              </dt>
              <dd class="text-sm mt-0.5">
                <span v-if="f.how" class="text-muted-foreground">{{ f.how }}. </span>{{ f.detail }}
              </dd>
            </div>
          </dl>
        </section>
      </template>

      <!-- To do -->
      <template v-else>
        <h2 class="text-lg font-bold">To do</h2>
        <p class="text-sm text-muted-foreground mt-1">
          What is being worked on or considered next. Have an idea or found a bug? Use the feedback button on any page.
        </p>

        <section v-for="g in TODO_GROUPS" :id="g.id" :key="g.id" class="mt-8">
          <h3 class="text-base font-bold border-b border-border pb-1">{{ g.title }}</h3>
          <ul class="mt-3 space-y-3">
            <li v-for="t in g.items" :key="t.title" class="flex gap-3">
              <span class="mt-0.5 h-4 flex-shrink-0 text-[10px] font-medium px-1.5 rounded-full bg-muted text-muted-foreground leading-4">
                {{ TODO_STATUS_LABELS[g.id] }}
              </span>
              <div>
                <div class="text-sm font-semibold">{{ t.title }}</div>
                <div class="text-sm text-muted-foreground">{{ t.detail }}</div>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

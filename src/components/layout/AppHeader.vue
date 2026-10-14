<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import { computed } from 'vue'
import {
  Search, Plus, Download, Upload, Trash2, Play, X, Check, Settings, MessageSquare, Wand2, BookOpen, ListTodo,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher.vue'
import FeedbackModal from '@/components/modals/FeedbackModal.vue'

function infoUrl(page) {
  try { return chrome.runtime.getURL(page) } catch { return page }
}
import ConnectionStatus from '@/components/ConnectionStatus.vue'
import StorageUsage from '@/components/StorageUsage.vue'

const store = useStore()

const props = defineProps({
  activeTab:           { type: String, default: 'queries' },
  deleteMode:          { type: Boolean, default: false },
  selectedCount:       { type: Number, default: 0 },
  totalCount:          { type: Number, default: 0 },
  emailDeleteMode:     { type: Boolean, default: false },
  selectedEmailCount:  { type: Number, default: 0 },
  totalEmailCount:     { type: Number, default: 0 },
  emailSaverEnabled:   { type: Boolean, default: true },
  emailSaveDebounce:   { type: Number,  default: 5 },
  reuseQueryDe:        { type: Boolean, default: false },
})

const emit = defineEmits([
  'add-query',
  'export-csv',
  'import-csv',
  'toggle-delete-mode',
  'select-all',
  'delete-selected',
  'toggle-email-delete-mode',
  'select-all-emails',
  'delete-selected-emails',
  'run-query',
  'open-query-builder',
  'toggle-email-saver',
  'update-email-save-debounce',
  'toggle-reuse-query-de',
])

// True when either delete mode is active
const anyDeleteMode = computed(() => props.deleteMode || props.emailDeleteMode)
const isEmailTab = computed(() => props.activeTab === 'emails')

// ── Settings popover ──────────────────────────────────────
const showFeedback = ref(false)
const settingsOpen = ref(false)
const settingsPanel = ref(null)

function toggleSettings() { settingsOpen.value = !settingsOpen.value }

function onDocClick(e) {
  if (settingsPanel.value && !settingsPanel.value.contains(e.target)) {
    settingsOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

const csvInput = ref(null)

function triggerImport() {
  csvInput.value?.click()
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (file) emit('import-csv', file)
  event.target.value = ''
}

const showSearch = ref(false)
const searchInput = ref(null)

const searchText = computed({
  get: () => store.state.searchText,
  set: (val) => store.dispatch('updateSearchText', val),
})

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    searchText.value = ''
    store.dispatch('updateSearchText', '')
  }
}

function closeSearch() {
  showSearch.value = false
  searchText.value = ''
  store.dispatch('updateSearchText', '')
}
</script>

<template>
  <div>
  <header class="flex items-center px-4 py-2.5 bg-card border-b border-border sticky top-0 z-50">

    <!-- Left col: search button + input -->
    <div class="flex-1 flex items-center justify-start gap-1">
      <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground flex-shrink-0"
        :class="showSearch ? 'bg-violet-100 text-violet-700 hover:bg-violet-200 hover:text-violet-700' : ''"
        title="Search queries"
        @click="toggleSearch">
        <Search class="h-4 w-4" />
      </Button>
      <Transition name="search-slide">
        <Input
          v-if="showSearch"
          ref="searchInput"
          v-model="searchText"
          class="h-8 w-48 text-xs"
          placeholder="Search queries…"
          @keyup.esc="closeSearch"
        />
      </Transition>
    </div>

    <!-- Centre col: branding -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <img src="/images/icon48x48.png" alt="" class="w-[22px] h-[22px] rounded" />
      <span class="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">SFMC Query Saver</span>
    </div>

    <!-- Right col: toolbar -->
    <div class="flex-1 flex items-center justify-end">

      <!-- Normal toolbar -->
      <div v-if="!anyDeleteMode" class="flex items-center gap-0.5">
        <Button
          size="sm"
          class="h-8 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold px-3.5 mr-1"
          @click="emit('run-query')"
          title="Open query workspace to run SQL"
        >
          <Play class="h-3 w-3 mr-1 fill-white" />
          Run Query
        </Button>

        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs font-semibold px-2.5 mr-1 gap-1"
          @click="emit('open-query-builder')"
          title="Experimental: build SQL from DE browser"
        >
          <Wand2 class="h-3 w-3" />
          Query Builder
          <span class="text-[9px] font-bold uppercase bg-amber-200 text-amber-900 rounded px-1 py-px">Beta</span>
        </Button>

        <Separator orientation="vertical" class="h-5 mx-1" />

        <ConnectionStatus class="mr-1" />

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Add a query manually" @click="emit('add-query')">
          <Plus class="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Export all queries to CSV" @click="emit('export-csv')">
          <Download class="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Import queries from CSV" @click="triggerImport">
          <Upload class="h-4 w-4" />
        </Button>
        <input ref="csvInput" type="file" accept=".csv,text/csv,text/plain,application/vnd.ms-excel" class="hidden" @change="onFileSelected" />

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600"
          :title="isEmailTab ? 'Select emails to delete' : 'Select queries to delete'"
          @click="isEmailTab ? emit('toggle-email-delete-mode') : emit('toggle-delete-mode')">
          <Trash2 class="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Send feedback" @click="showFeedback = true">
          <MessageSquare class="h-4 w-4" />
        </Button>

        <ThemeSwitcher />

        <!-- Settings gear -->
        <div ref="settingsPanel" class="relative">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground"
            :class="settingsOpen ? 'bg-accent text-accent-foreground' : ''"
            title="Settings"
            @click="toggleSettings"
          >
            <Settings class="h-4 w-4" />
          </Button>

          <div
            v-if="settingsOpen"
            class="absolute right-0 top-full mt-1 z-[9999] w-64 rounded-lg border border-border bg-popover shadow-lg py-2 overflow-hidden"
          >
            <div class="px-3 py-1 mb-1">
              <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Settings</span>
            </div>

            <!-- Help pages -->
            <a :href="infoUrl('features.html')" target="_blank" class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
              <BookOpen class="h-3.5 w-3.5 text-muted-foreground" /> Features
            </a>
            <a :href="infoUrl('todo.html')" target="_blank" class="flex items-center gap-2 px-3 py-1.5 mb-1 text-xs font-medium text-foreground hover:bg-accent transition-colors border-b border-border">
              <ListTodo class="h-3.5 w-3.5 text-muted-foreground" /> To do
            </a>

            <!-- Email Saver toggle -->
            <label class="flex items-center justify-between gap-3 px-3 py-1.5 cursor-pointer hover:bg-accent transition-colors">
              <div>
                <span class="text-xs font-medium text-foreground block">Email Saver</span>
                <span class="text-[10px] text-muted-foreground">Auto-save emails from Content Builder</span>
              </div>
              <button
                role="switch"
                :aria-checked="emailSaverEnabled"
                class="relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border transition-colors focus:outline-none"
                :class="emailSaverEnabled ? 'bg-primary border-primary' : 'bg-muted border-border'"
                @click.stop="emit('toggle-email-saver')"
              >
                <span
                  class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-px"
                  :class="emailSaverEnabled ? 'translate-x-3.5' : 'translate-x-px'"
                />
              </button>
            </label>

            <!-- Debounce timer -->
            <div class="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-accent transition-colors">
              <div>
                <span class="text-xs font-medium text-foreground block">Debounce timer</span>
                <span class="text-[10px] text-muted-foreground">Skip duplicate saves within N seconds (0 = off)</span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  :value="emailSaveDebounce"
                  class="w-12 h-6 text-xs text-center border border-border rounded bg-background text-foreground focus:outline-none focus:border-primary"
                  @change="emit('update-email-save-debounce', Number($event.target.value))"
                  @click.stop
                />
                <span class="text-[10px] text-muted-foreground">s</span>
              </div>
            </div>

            <!-- Reuse DE & Query Activity toggle -->
            <label class="flex items-center justify-between gap-3 px-3 py-1.5 cursor-pointer hover:bg-accent transition-colors">
              <div>
                <span class="text-xs font-medium text-foreground block">Reuse DE & Query Activity</span>
                <span class="text-[10px] text-muted-foreground">Re-running an identical query reuses its last DE/Activity instead of creating new ones</span>
              </div>
              <button
                role="switch"
                :aria-checked="reuseQueryDe"
                class="relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border transition-colors focus:outline-none"
                :class="reuseQueryDe ? 'bg-primary border-primary' : 'bg-muted border-border'"
                @click.stop="emit('toggle-reuse-query-de')"
              >
                <span
                  class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-px"
                  :class="reuseQueryDe ? 'translate-x-3.5' : 'translate-x-px'"
                />
              </button>
            </label>

            <!-- Storage usage -->
            <div class="border-t pt-2 mt-2 px-3">
              <StorageUsage />
            </div>
          </div>
        </div>
      </div>

      <!-- Delete-mode toolbar: queries -->
      <div v-else-if="deleteMode" class="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-xs text-muted-foreground"
          @click="emit('select-all')" title="Toggle select all">
          <input
            type="checkbox"
            class="h-3.5 w-3.5 cursor-pointer accent-primary"
            :checked="selectedCount === totalCount && totalCount > 0"
            :indeterminate="selectedCount > 0 && selectedCount < totalCount"
            readonly
          />
          <span>{{ selectedCount === totalCount && totalCount > 0 ? 'Deselect all' : 'Select all' }}</span>
        </Button>
        <Button variant="destructive" size="sm" class="h-8 text-xs"
          :disabled="selectedCount === 0"
          :title="selectedCount === 0 ? 'Select at least one query' : `Delete ${selectedCount} selected`"
          @click="emit('delete-selected')">
          Delete{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Cancel" @click="emit('toggle-delete-mode')">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Delete-mode toolbar: emails -->
      <div v-else-if="emailDeleteMode" class="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-xs text-muted-foreground"
          @click="emit('select-all-emails')" title="Toggle select all emails">
          <input
            type="checkbox"
            class="h-3.5 w-3.5 cursor-pointer accent-primary"
            :checked="selectedEmailCount === totalEmailCount && totalEmailCount > 0"
            :indeterminate="selectedEmailCount > 0 && selectedEmailCount < totalEmailCount"
            readonly
          />
          <span>{{ selectedEmailCount === totalEmailCount && totalEmailCount > 0 ? 'Deselect all' : 'Select all' }}</span>
        </Button>
        <Button variant="destructive" size="sm" class="h-8 text-xs"
          :disabled="selectedEmailCount === 0"
          :title="selectedEmailCount === 0 ? 'Select at least one email' : `Delete ${selectedEmailCount} selected`"
          @click="emit('delete-selected-emails')">
          Delete{{ selectedEmailCount > 0 ? ` (${selectedEmailCount})` : '' }}
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground"
          title="Cancel" @click="emit('toggle-email-delete-mode')">
          <X class="h-4 w-4" />
        </Button>
      </div>

    </div>
  </header>
  <FeedbackModal v-if="showFeedback" screen="popup" @close="showFeedback = false" />
  </div>
</template>

<style scoped>
/* Search slide animation */
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  width: 0;
  padding: 0;
}
.search-slide-enter-active,
.search-slide-leave-active {
  transition: opacity 0.2s ease, width 0.2s ease, padding 0.2s ease;
  overflow: hidden;
}
.search-slide-enter-to,
.search-slide-leave-from {
  opacity: 1;
  width: 192px;
}
</style>

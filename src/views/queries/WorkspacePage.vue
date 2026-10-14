<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'radix-vue'
import {
  ArrowLeft, Settings, HelpCircle, Plus, LayoutGrid, Moon, MessageSquare, X, BookOpen, ListTodo,
} from 'lucide-vue-next'
import WorkspaceGrid from './components/workspace/WorkspaceGrid.vue'
import Button from './components/ui/button/Button.vue'
import Switch from './components/ui/switch/Switch.vue'
import FeedbackModal from './components/modals/FeedbackModal.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import { detectStack, readCachedStack, onStackChange } from './utils/stackDetection.js'
import { useTheme } from './composables/useTheme.js'
import { useWorkspace, LAYOUT_PRESETS } from './composables/useWorkspace.js'
import { setApiLogCallback } from './utils/sfmcApi.js'
import { trackEvent } from './utils/analytics.js'
import { BUILD_VERSION, DEV_MODE } from './utils/buildVersion.js'
import { LINT_RULES } from './utils/sqlLint.js'
import { disabledRules, setRuleDisabled, onLintSettingsChange } from './editor/lintSettings.js'
import './assets/tailwind.css'

const { loadTheme, themes, currentTheme, setTheme } = useTheme()

const stack = ref(null)

// Lint rules turned off from a lint message ("Turn off QSxxx"); listed in Settings.
const offRules = ref([...disabledRules()])
const stopLintWatch = onLintSettingsChange((set) => { offRules.value = [...set].sort() })
const offRuleRows = computed(() => offRules.value.map(code => ({
  code, title: LINT_RULES.find(r => r.code === code)?.title || '',
})))

function infoUrl(page) {
  try { return chrome.runtime.getURL(page) } catch { return page }
}
const connectionStatus = ref('detecting')
const loginTabOpened = ref(false)
let loginPollTimer = null
let loginTabId = null

const {
  workspaceId, layoutRows, layoutCols, panels, canAddPanel,
  setLayout, addPanel, removePanel, duplicatePanel, loadFromUrl,
} = useWorkspace()

const showSettings = ref(false)
const showFeedback = ref(false)
const showHowTo = ref(false)
const showIntro = ref(false)
const apiConsoleEnabled = ref(false)
const consoleLogs = ref([])
const consoleOpen = ref(false)
const extensionVersion = ref('')
const INTRO_SEEN_KEY = 'sfmcqs_workspace_intro_seen_v1'
const SETTINGS_KEY = 'sfmcqs_settings'

const canInteract = computed(() => connectionStatus.value === 'connected' && !!stack.value)

setApiLogCallback((entry) => {
  if (apiConsoleEnabled.value) {
    consoleLogs.value = [entry, ...consoleLogs.value].slice(0, 100)
  }
})

function dismissIntro() {
  showIntro.value = false
  chrome.storage.local.set({ [INTRO_SEEN_KEY]: true })
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (result) => {
      apiConsoleEnabled.value = result[SETTINGS_KEY]?.apiConsole ?? false
      resolve()
    })
  })
}

function toggleApiConsole() {
  apiConsoleEnabled.value = !apiConsoleEnabled.value
  chrome.storage.local.set({ [SETTINGS_KEY]: { apiConsole: apiConsoleEnabled.value } })
}

function stopLoginPoll() {
  clearTimeout(loginPollTimer)
  loginPollTimer = null
}

function startLoginPoll() {
  let attempts = 0
  async function tick() {
    if (connectionStatus.value === 'connected') return
    if (++attempts > 40) return
    const detected = await detectStack()
    if (detected) {
      stack.value = detected
      connectionStatus.value = 'connected'
      loginTabOpened.value = false
      if (loginTabId) try { chrome.tabs.remove(loginTabId) } catch {}
      loginTabId = null
    } else {
      loginPollTimer = setTimeout(tick, 3000)
    }
  }
  loginPollTimer = setTimeout(tick, 3000)
}

async function initConnection() {
  const { stack: cached, isFresh } = await readCachedStack()
  if (isFresh) {
    stack.value = cached
    connectionStatus.value = 'connected'
    detectStack().then((live) => { if (live) stack.value = live }).catch(() => {})
  } else {
    const detected = await detectStack()
    stack.value = detected
    connectionStatus.value = detected ? 'connected' : 'disconnected'
    if (!detected) {
      loginTabOpened.value = true
      chrome.tabs.create({ url: 'https://mc.exacttarget.com' }, (tab) => { loginTabId = tab?.id ?? null })
      startLoginPoll()
    }
  }
}

function goBack() {
  window.location.href = chrome.runtime.getURL('index.html')
}

function handleAddPanel() {
  addPanel()
}

function handleLayoutPreset(preset) {
  setLayout(preset.rows, preset.cols)
}

onMounted(async () => {
  loadTheme()
  await loadSettings()
  extensionVersion.value = chrome.runtime.getManifest().version
  await loadFromUrl()
  await initConnection()
  trackEvent('query_workspace_open', { panels: panels.value.length })
  chrome.storage.local.get(INTRO_SEEN_KEY, (r) => {
    if (!r[INTRO_SEEN_KEY]) showIntro.value = true
  })
})

// Follow a stack picked in the Connection Status dropdown, or a stack the SW
// dropped after an auth failure, without reloading the page.
const stopStackWatch = onStackChange((s) => { if (s && s !== stack.value) stack.value = s })

onUnmounted(() => { stopLoginPoll(); stopStackWatch(); stopLintWatch() })
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-background font-sans" @click="showSettings = false">
    <!-- Header -->
    <header class="h-[48px] flex items-center justify-between px-3 gap-3 bg-card border-b border-border flex-shrink-0">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="goBack" title="Back to queries">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm font-bold text-foreground">Query Workspace</span>
        <span v-if="DEV_MODE" class="text-xs font-mono font-bold text-white bg-fuchsia-600 px-2 py-0.5 rounded" title="Build version — confirms this tab is running current code">BUILD {{ BUILD_VERSION }}</span>
        <ConnectionStatus :stack="stack" />
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Layout presets -->
        <div class="flex items-center gap-0.5 border border-border rounded-md p-0.5">
          <button
            v-for="preset in LAYOUT_PRESETS"
            :key="preset.label"
            class="text-[10px] px-2 py-0.5 rounded transition-colors"
            :class="layoutRows === preset.rows && layoutCols === preset.cols ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'"
            @click="handleLayoutPreset(preset)"
          >{{ preset.label }}</button>
        </div>

        <Button variant="outline" size="sm" class="h-7 text-[10px]" :disabled="!canAddPanel" @click="handleAddPanel">
          <Plus class="h-3 w-3 mr-1" /> Panel
        </Button>

        <div class="relative">
          <Button variant="outline" size="icon" class="h-7 w-7" title="Settings" @click.stop="showSettings = !showSettings">
            <Settings class="h-3.5 w-3.5" />
          </Button>
          <div v-if="showSettings" class="absolute top-full right-0 mt-1 w-64 bg-popover border rounded-lg shadow-xl z-50 p-3" @click.stop>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold">API Console</span>
              <Switch :model-value="apiConsoleEnabled" @update:model-value="toggleApiConsole" />
            </div>
            <div class="border-t pt-2 mt-2">
              <div class="text-[10px] font-bold text-muted-foreground mb-1">Theme</div>
              <button v-for="t in themes" :key="t.id" class="block w-full text-left text-xs py-1 px-1 rounded hover:bg-muted" @click="setTheme(t.id)">{{ t.label }}</button>
            </div>
            <div class="border-t pt-2 mt-2">
              <div class="text-[10px] font-bold text-muted-foreground mb-1">Turned-off lint rules</div>
              <p v-if="!offRuleRows.length" class="text-[10px] text-muted-foreground">None. Use "Turn off" on a lint message to hide a rule.</p>
              <div v-for="r in offRuleRows" :key="r.code" class="flex items-center gap-1 text-[10px] py-0.5">
                <span class="font-mono">{{ r.code }}</span>
                <span class="flex-1 truncate text-muted-foreground" :title="r.title">{{ r.title }}</span>
                <button class="underline hover:text-foreground" @click="setRuleDisabled(r.code, false)">Turn on</button>
              </div>
            </div>
            <button class="text-xs mt-2 flex items-center gap-1" @click="showFeedback = true; showSettings = false"><MessageSquare class="h-3 w-3" /> Feedback</button>
            <button class="text-xs mt-1 flex items-center gap-1" @click="showHowTo = true; showSettings = false"><HelpCircle class="h-3 w-3" /> Help</button>
            <a class="text-xs mt-1 flex items-center gap-1" :href="infoUrl('features.html')" target="_blank"><BookOpen class="h-3 w-3" /> Features</a>
            <a class="text-xs mt-1 flex items-center gap-1" :href="infoUrl('todo.html')" target="_blank"><ListTodo class="h-3 w-3" /> To do</a>
          </div>
        </div>
      </div>
    </header>

    <!-- Login banner -->
    <div v-if="loginTabOpened && connectionStatus !== 'connected'" class="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
      Log in to SFMC in the opened tab to connect.
    </div>

    <!-- Grid -->
    <WorkspaceGrid
      :panels="panels"
      :stack="stack"
      :can-interact="canInteract"
      :layout-rows="layoutRows"
      :layout-cols="layoutCols"
      @remove-panel="removePanel"
      @duplicate-panel="duplicatePanel"
    />

    <!-- Intro -->
    <DialogRoot :open="showIntro">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[9999] bg-black/45" @click="dismissIntro" />
        <DialogContent class="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 w-[440px] rounded-xl bg-card border p-6">
          <DialogTitle class="text-lg font-bold mb-2">Multi-Panel Query Workspace</DialogTitle>
          <p class="text-sm text-muted-foreground mb-3">Run up to 6 queries in parallel. Use the layout buttons (1×1 through 2×3) to arrange panels.</p>
          <ul class="text-xs text-muted-foreground list-disc pl-4 space-y-1 mb-4">
            <li>Each panel has its own SQL editor, validate, and run</li>
            <li>Panels run independently in parallel</li>
            <li>Try the experimental <strong>Query Builder</strong> from the main page</li>
          </ul>
          <Button class="w-full" @click="dismissIntro">Got it</Button>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Help -->
    <DialogRoot :open="showHowTo">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[9999] bg-black/45" @click="showHowTo = false" />
        <DialogContent class="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 w-[420px] rounded-xl bg-card border p-5">
          <DialogTitle class="font-bold mb-2">Workspace Help</DialogTitle>
          <p class="text-xs text-muted-foreground leading-relaxed">Log in to SFMC in this browser. Each panel validates and runs SQL independently. Use the layout buttons to show up to 6 panels (2×3). If the stack in the status pill is wrong, open the pill and choose the right one.</p>
          <a class="block text-xs mt-2 text-primary underline" :href="infoUrl('features.html')" target="_blank">See every feature</a>
          <Button class="w-full mt-4" @click="showHowTo = false">Close</Button>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <FeedbackModal v-if="showFeedback" screen="query-workspace" @close="showFeedback = false" />
  </div>
</template>

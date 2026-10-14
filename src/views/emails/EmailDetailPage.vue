<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ArrowLeft, RotateCcw, Check, AlertCircle, Loader2,
  Clock, FolderOpen, ChevronDown, Trash2, MessageSquare, Settings,
} from 'lucide-vue-next'
import { compile }                               from './utils/emailCompiler.js'
import { sfmcFetch, setApiLogCallback, logInfo } from './utils/sfmcApi.js'
import { useTheme }                              from './composables/useTheme.js'
import FeedbackModal                             from './components/modals/FeedbackModal.vue'
import './assets/tailwind.css'

const { loadTheme } = useTheme()

// ── UI state ──────────────────────────────────────────────
const showFeedback      = ref(false)
const emailSettingsOpen = ref(false)

// ── API console enabled toggle ────────────────────────────
const ED_SETTINGS_KEY   = '_edSettings'
const apiConsoleEnabled = ref(false)

function loadEdSettings() {
  if (!chrome?.storage?.local) return
  chrome.storage.local.get(ED_SETTINGS_KEY, (result) => {
    const saved = result[ED_SETTINGS_KEY]
    if (saved?.apiConsole !== undefined) apiConsoleEnabled.value = saved.apiConsole
  })
}

function saveEdSettings() {
  if (!chrome?.storage?.local) return
  chrome.storage.local.set({ [ED_SETTINGS_KEY]: { apiConsole: apiConsoleEnabled.value } })
}

function toggleApiConsole() {
  apiConsoleEnabled.value = !apiConsoleEnabled.value
  if (!apiConsoleEnabled.value) consoleOpen.value = false
  saveEdSettings()
}

function onDocClickEmailSettings(e) {
  const panel = document.getElementById('ed-settings-panel')
  if (panel && !panel.contains(e.target)) emailSettingsOpen.value = false
}

// ── Load record from storage ──────────────────────────────
const emailId = new URLSearchParams(window.location.search).get('id')
const record  = ref(null)
const loading = ref(true)

onMounted(async () => {
  loadTheme()
  loadEdSettings()
  setupApiLog()
  document.addEventListener('mousedown', onDocClickEmailSettings)
  if (!emailId || !chrome?.storage?.local) { loading.value = false; return }
  logInfo(`Loading email record: ${emailId}`)
  chrome.storage.local.get(emailId, (data) => {
    record.value  = data[emailId] || null
    loading.value = false
    if (record.value?.name) {
      document.title = record.value.name + ' - SFMC Email Saver'
      logInfo(`Record loaded: "${record.value.name}" - ${versions.value.length} version(s)`)
    } else {
      logInfo('Record not found in storage.')
    }
  })
})

// ── Version list ──────────────────────────────────────────
const versions = computed(() => {
  if (!record.value) return []
  if (record.value.versions?.length) return record.value.versions
  // Backward-compatible: synthesise a single version from top-level fields
  return [{
    versionId:    `v_${record.value.timeStamp}`,
    savedAt:      record.value.timeStamp,
    subject:      record.value.subject || '',
    name:         record.value.name    || '',
    status:       record.value.status  || '',
    categoryName: record.value.categoryName || '',
    compileAsset: record.value.compileAsset || null,
    assetBody:    null,
    stack:        null,
  }]
})

const selectedIdx     = ref(0)
const selectedVersion = computed(() => versions.value[selectedIdx.value] || null)

const compiledHtml = computed(() => {
  const ca = selectedVersion.value?.compileAsset
  if (!ca) return null
  try { return compile(ca, 'html') || null } catch { return null }
})

// ── Revert ────────────────────────────────────────────────
// revertState[versionId] = 'idle' | 'pending' | 'success' | { error: string }
const revertState = ref({})

async function revertToVersion(version) {
  if (!version.assetBody || !version.stack) return
  revertState.value = { ...revertState.value, [version.versionId]: 'pending' }

  const url = `https://content-builder.${version.stack}.marketingcloudapps.com/fuelapi/asset/v1/content/assets/${record.value.assetId}`
  const vLabel = `v${versions.value.length - versions.value.indexOf(version)}`
  logInfo(`Reverting email "${record.value.name}" to ${vLabel} (saved ${formatDate(version.savedAt)})`)

  try {
    await sfmcFetch(url, 'PUT', version.assetBody)
    revertState.value = { ...revertState.value, [version.versionId]: 'success' }
    logInfo(`Revert to ${vLabel} completed successfully.`)
    showToast(`Reverted to ${vLabel} successfully. Refresh the email in Content Builder to see the changes.`)
  } catch (e) {
    revertState.value = { ...revertState.value, [version.versionId]: { error: e.message } }
    logInfo(`Revert to ${vLabel} failed: ${e.message}`)
  }
}

function getRevertState(versionId) {
  return revertState.value[versionId] || 'idle'
}

// ── Toast notification ────────────────────────────────────
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer = null

function showToast(msg, durationMs = 6000) {
  toastMessage.value = msg
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, durationMs)
}

// ── Version deletion ──────────────────────────────────────
const deletingVersionId = ref(null)

async function deleteVersion(versionId) {
  if (!record.value || !emailId || !chrome?.storage?.local) return
  const remaining = versions.value.filter(v => v.versionId !== versionId)

  if (remaining.length === 0) {
    // Last version - remove the whole record
    if (!confirm('This is the last version. Delete the entire email record?')) return
    await new Promise(resolve => chrome.storage.local.remove(emailId, resolve))
    logInfo(`Deleted last version - email record removed.`)
    window.close()
    return
  }

  deletingVersionId.value = versionId
  const updated = { ...record.value, versions: remaining }
  // If deleted version was displayed, move selection to nearest remaining
  if (selectedIdx.value >= remaining.length) selectedIdx.value = remaining.length - 1

  await new Promise(resolve => chrome.storage.local.set({ [emailId]: updated }, resolve))
  record.value = updated
  delete revertState.value[versionId]
  deletingVersionId.value = null
  logInfo(`Deleted version ${versionId}. ${remaining.length} version(s) remaining.`)
}

// ── API console ───────────────────────────────────────────
const consoleLogs   = ref([])
const consoleOpen   = ref(false)
const consoleHeight = ref(220)
const MAX_LOGS      = 100

function setupApiLog() {
  setApiLogCallback((entry) => {
    consoleLogs.value = [entry, ...consoleLogs.value].slice(0, MAX_LOGS)
  })
}
onUnmounted(() => {
  setApiLogCallback(null)
  document.removeEventListener('mousedown', onDocClickEmailSettings)
})

function clearConsoleLogs() { consoleLogs.value = [] }

function downloadConsoleLogs() {
  const lines = [...consoleLogs.value].reverse().map(entry => {
    const ts = new Date(entry.ts).toISOString()
    if (entry.type === 'info') return `[${ts}] INFO ${entry.message}`
    if (entry.type === 'req') {
      const body = entry.body !== null ? `\n  body: ${JSON.stringify(entry.body)}` : ''
      return `[${ts}] REQ  ${entry.method} ${entry.url}${body}`
    }
    if (entry.type === 'res') return `[${ts}] RES  ${entry.method} ${entry.url}\n  → ${JSON.stringify(entry.result)}`
    return `[${ts}] ERR  ${entry.method} ${entry.url}\n  ✗ ${entry.error}`
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `email-detail-log-${Date.now()}.txt`
  a.click()
}

// Console resize
let _resizing = false
let _resizeStartY = 0
let _resizeStartH = 0

function onConsoleResizeStart(e) {
  _resizing    = true
  _resizeStartY = e.clientY
  _resizeStartH = consoleHeight.value
  document.addEventListener('mousemove', onConsoleResizeMove)
  document.addEventListener('mouseup',   onConsoleResizeEnd)
}
function onConsoleResizeMove(e) {
  if (!_resizing) return
  const delta = _resizeStartY - e.clientY
  consoleHeight.value = Math.max(80, Math.min(600, _resizeStartH + delta))
}
function onConsoleResizeEnd() {
  _resizing = false
  document.removeEventListener('mousemove', onConsoleResizeMove)
  document.removeEventListener('mouseup',   onConsoleResizeEnd)
}

// ── Helpers ───────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2,
  })
}

// Navigate instead of window.close(): Back used to close the whole tab (feedback #5).
function back() { window.location.href = chrome.runtime.getURL('index.html') }
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background font-sans text-foreground overflow-hidden" style="height:100vh">

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Not found -->
    <div v-else-if="!record" class="flex-1 flex flex-col items-center justify-center gap-3">
      <AlertCircle class="h-10 w-10 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">Email record not found.</p>
      <button class="text-xs text-primary underline" @click="back">Close</button>
    </div>

    <template v-else>
      <!-- ── Header ──────────────────────────────────────── -->
      <header class="flex items-center gap-3 px-5 py-3 border-b border-border bg-card sticky top-0 z-50 flex-shrink-0">
        <button
          class="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Close"
          @click="back"
        >
          <ArrowLeft class="h-4 w-4" />
        </button>

        <div class="flex-1 min-w-0">
          <h1 class="text-sm font-bold text-foreground truncate">{{ record.name }}</h1>
          <div class="flex items-center gap-2 mt-0.5 flex-wrap">
            <span v-if="record.categoryName"
              class="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted border border-border rounded-full px-2 py-px">
              <FolderOpen class="h-2.5 w-2.5 flex-shrink-0" />
              {{ record.categoryName }}
            </span>
            <span v-if="record.assetTypeDisplayName" class="text-[10px] text-muted-foreground">
              {{ record.assetTypeDisplayName }}
            </span>
            <span v-if="record.memberId" class="text-[10px] text-muted-foreground/50">
              MID {{ record.memberId }}
            </span>
          </div>
        </div>

        <!-- Feedback button -->
        <button
          class="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
          title="Send feedback"
          @click="showFeedback = true"
        >
          <MessageSquare class="h-4 w-4" />
        </button>

        <!-- Settings gear (API Console toggle) -->
        <div id="ed-settings-panel" class="relative flex-shrink-0">
          <button
            class="p-1.5 rounded-md transition-colors flex-shrink-0"
            :class="emailSettingsOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            title="Settings"
            @click.stop="emailSettingsOpen = !emailSettingsOpen"
          >
            <Settings class="h-4 w-4" />
          </button>
          <div
            v-if="emailSettingsOpen"
            class="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-popover shadow-lg py-2"
            @click.stop
          >
            <div class="px-3 py-1 mb-1">
              <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Settings</span>
            </div>
            <label class="flex items-center justify-between gap-3 px-3 py-1.5 cursor-pointer hover:bg-accent transition-colors">
              <div>
                <span class="text-xs font-medium text-foreground block">API Console</span>
                <span class="text-[10px] text-muted-foreground">Show live API call log</span>
              </div>
              <button
                role="switch"
                :aria-checked="apiConsoleEnabled"
                class="relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border transition-colors focus:outline-none"
                :class="apiConsoleEnabled ? 'bg-primary border-primary' : 'bg-muted border-border'"
                @click.stop="toggleApiConsole"
              >
                <span
                  class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-px"
                  :class="apiConsoleEnabled ? 'translate-x-3.5' : 'translate-x-px'"
                />
              </button>
            </label>
          </div>
        </div>

        <span class="text-[10px] font-semibold bg-muted border border-border rounded-full px-2.5 py-1 text-muted-foreground flex-shrink-0">
          {{ versions.length }} {{ versions.length === 1 ? 'version' : 'versions' }}
        </span>
      </header>

      <!-- ── Body ────────────────────────────────────────── -->
      <div class="flex-1 flex overflow-hidden min-h-0">

        <!-- Left: Version history sidebar -->
        <aside class="w-72 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          <div class="px-4 py-2.5 border-b border-border flex-shrink-0">
            <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Version History</span>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div
              v-for="(version, idx) in versions"
              :key="version.versionId"
              class="border-b border-border last:border-0 cursor-pointer transition-colors border-l-2"
              :class="selectedIdx === idx
                ? 'bg-primary/5 border-l-primary'
                : 'hover:bg-muted/50 border-l-transparent'"
              @click="selectedIdx = idx"
            >
              <div class="px-4 py-3">
                <!-- Version number + Latest badge + Delete -->
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[11px] font-bold text-foreground">
                    v{{ versions.length - idx }}
                  </span>
                  <span v-if="idx === 0"
                    class="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full px-1.5 py-px">
                    Latest
                  </span>
                  <span v-if="version.status"
                    class="text-[9px] rounded-full px-1.5 py-px"
                    :class="version.status === 'Published'
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700'">
                    {{ version.status }}
                  </span>
                  <button
                    class="ml-auto p-1 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex-shrink-0"
                    :disabled="deletingVersionId === version.versionId"
                    title="Delete this version"
                    @click.stop="deleteVersion(version.versionId)"
                  >
                    <Loader2 v-if="deletingVersionId === version.versionId" class="h-3 w-3 animate-spin" />
                    <Trash2 v-else class="h-3 w-3" />
                  </button>
                </div>

                <!-- Timestamp -->
                <div class="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                  <Clock class="h-2.5 w-2.5 flex-shrink-0" />
                  {{ formatDate(version.savedAt) }}
                </div>

                <!-- Subject -->
                <p v-if="version.subject"
                  class="text-[10px] text-foreground/70 leading-relaxed line-clamp-2 mb-2 italic">
                  "{{ version.subject }}"
                </p>

                <!-- Revert button (only for non-latest versions) -->
                <template v-if="idx !== 0">
                  <div v-if="version.assetBody && version.stack">
                    <!-- Idle -->
                    <button
                      v-if="getRevertState(version.versionId) === 'idle'"
                      class="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors w-full justify-center"
                      @click.stop="revertToVersion(version)"
                    >
                      <RotateCcw class="h-3 w-3" />
                      Revert to this version
                    </button>
                    <!-- Pending -->
                    <button
                      v-else-if="getRevertState(version.versionId) === 'pending'"
                      class="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md border border-border text-muted-foreground cursor-not-allowed opacity-60 w-full justify-center"
                      disabled
                    >
                      <Loader2 class="h-3 w-3 animate-spin" />
                      Reverting…
                    </button>
                    <!-- Success -->
                    <div
                      v-else-if="getRevertState(version.versionId) === 'success'"
                      class="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 w-full justify-center"
                    >
                      <Check class="h-3 w-3" />
                      Reverted successfully
                    </div>
                    <!-- Error -->
                    <div v-else-if="getRevertState(version.versionId)?.error" class="flex flex-col gap-1 w-full">
                      <div class="flex items-start gap-1.5 text-[10px] text-red-700 dark:text-red-400 px-2.5 py-1.5 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                        <AlertCircle class="h-3 w-3 flex-shrink-0 mt-px" />
                        <span v-if="getRevertState(version.versionId).error.includes('EBADCSRFTOKEN')" class="break-words leading-snug">
                          Session expired. Open Content Builder once to refresh it, then try again.
                          <a
                            :href="`https://mc.${version.stack}.exacttarget.com/cloud/#app/Content%20Builder`"
                            target="_blank"
                            class="underline font-semibold ml-1"
                          >Open Content Builder</a>
                        </span>
                        <span v-else class="break-words leading-snug">{{ getRevertState(version.versionId).error }}</span>
                      </div>
                      <button
                        class="text-[10px] text-primary underline text-center"
                        @click.stop="revertState = { ...revertState, [version.versionId]: 'idle' }"
                      >Try again</button>
                    </div>
                  </div>
                  <!-- No assetBody (legacy record captured before versioning) -->
                  <p v-else class="text-[9px] text-muted-foreground/50 italic text-center">
                    Revert unavailable (captured before versioning)
                  </p>
                </template>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right: email preview -->
        <main class="flex-1 flex flex-col overflow-hidden min-w-0">

          <!-- Preview toolbar -->
          <div class="flex items-center gap-3 px-5 py-2 border-b border-border bg-card flex-shrink-0">
            <span class="text-xs font-semibold text-foreground">
              v{{ versions.length - selectedIdx }}
              <span class="text-muted-foreground font-normal ml-1">{{ formatDate(selectedVersion?.savedAt) }}</span>
            </span>
            <span v-if="selectedVersion?.subject" class="text-xs text-muted-foreground truncate flex-1 min-w-0">
              Subject: {{ selectedVersion.subject }}
            </span>
          </div>

          <!-- iframe preview -->
          <div class="flex-1 overflow-hidden relative bg-white">
            <iframe
              v-if="compiledHtml"
              :srcdoc="compiledHtml"
              sandbox
              class="w-full h-full border-0"
              title="Email preview"
            />
            <div v-else class="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                class="text-muted-foreground/30">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <p class="text-sm">No preview available for this version.</p>
            </div>
          </div>
        </main>
      </div>

      <!-- ── API Console ──────────────────────────────────── -->
      <div v-if="apiConsoleEnabled" class="flex-shrink-0 border-t border-slate-700 bg-[#1E1E1E]" :class="consoleOpen ? 'flex flex-col' : ''">
        <!-- Drag-to-resize handle -->
        <div v-if="consoleOpen" class="h-1.5 bg-[#333] cursor-ns-resize hover:bg-primary transition-colors flex-shrink-0"
          @mousedown="onConsoleResizeStart" />

        <!-- Console title bar -->
        <div
          class="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none bg-[#2D2D2D] hover:bg-[#333] transition-colors"
          @click="consoleOpen = !consoleOpen"
        >
          <span class="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
            API Console
            <span v-if="consoleLogs.length" class="text-[10px] bg-[#555] text-slate-300 px-1.5 rounded-full">
              {{ consoleLogs.length }}
            </span>
          </span>
          <div class="flex items-center gap-2" @click.stop>
            <button
              class="text-[10px] border border-[#555] text-slate-400 px-1.5 py-px rounded hover:border-[#888] hover:text-slate-300 font-sans transition-colors disabled:opacity-40"
              :disabled="!consoleLogs.length"
              @click="downloadConsoleLogs"
            >Download</button>
            <button
              class="text-[10px] border border-[#555] text-slate-400 px-1.5 py-px rounded hover:border-[#888] hover:text-slate-300 font-sans transition-colors"
              @click="clearConsoleLogs"
            >Clear</button>
            <ChevronDown class="h-3 w-3 text-slate-500 transition-transform" :class="{ 'rotate-180': consoleOpen }" />
          </div>
        </div>

        <!-- Console log entries -->
        <div v-if="consoleOpen" class="overflow-y-auto font-mono text-[11px]" :style="{ height: consoleHeight + 'px' }">
          <div v-if="!consoleLogs.length" class="text-slate-500 px-3 py-2 italic">
            No API calls yet. Revert an email version to see activity.
          </div>
          <div
            v-for="(entry, i) in consoleLogs"
            :key="i"
            class="flex items-baseline gap-2 px-3 py-0.5 flex-wrap leading-relaxed border-l-2"
            :class="{
              'border-[#0176D3]':                   entry.type === 'req',
              'border-emerald-600':                  entry.type === 'res',
              'border-red-600 bg-red-950/20':        entry.type === 'err',
              'border-[#666] text-slate-400 italic': entry.type === 'info',
            }"
          >
            <span class="text-slate-500 flex-shrink-0">{{ formatTime(entry.ts) }}</span>

            <template v-if="entry.type === 'info'">
              <span class="text-slate-400 italic">{{ entry.message }}</span>
            </template>

            <template v-else>
              <!-- HTTP method badge -->
              <span class="font-bold flex-shrink-0 text-[10px]"
                :class="{
                  'text-teal-400':   entry.method === 'GET',
                  'text-yellow-300': entry.method === 'POST',
                  'text-orange-300': entry.method === 'PUT',
                  'text-red-400':    entry.method === 'DELETE',
                }">
                {{ entry.method }}
              </span>
              <span class="text-sky-300 break-all flex-1">{{ entry.url }}</span>

              <!-- Request body -->
              <template v-if="entry.type === 'req' && entry.body !== null">
                <span class="text-slate-500 flex-shrink-0">body:</span>
                <span class="text-orange-300 break-all">{{ JSON.stringify(entry.body)?.slice(0, 400) }}{{ JSON.stringify(entry.body)?.length > 400 ? '…' : '' }}</span>
              </template>
              <!-- Response -->
              <template v-else-if="entry.type === 'res'">
                <span class="text-slate-500 flex-shrink-0">→</span>
                <span class="text-green-300 break-all">{{ JSON.stringify(entry.result)?.slice(0, 400) }}{{ JSON.stringify(entry.result)?.length > 400 ? '…' : '' }}</span>
              </template>
              <!-- Error -->
              <template v-else-if="entry.type === 'err'">
                <span class="text-slate-500 flex-shrink-0">✗</span>
                <span class="text-red-400 break-all">{{ entry.error }}</span>
              </template>
            </template>
          </div>
        </div>
      </div>

    </template>

    <FeedbackModal v-if="showFeedback" screen="email-detail" @close="showFeedback = false" />

    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toastVisible"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] max-w-sm w-full px-4 py-3 rounded-xl shadow-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-medium leading-relaxed text-center pointer-events-none">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.toast-enter-from, .toast-leave-to  { opacity: 0; transform: translateX(-50%) translateY(12px); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-to, .toast-leave-from  { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>

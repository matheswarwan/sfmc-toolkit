<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { ChevronDown, RefreshCw, ExternalLink, Check, X, Loader2 } from 'lucide-vue-next'
import { useConnectionStatus } from '../composables/useConnectionStatus.js'
import { getStackChoices, setStackOverride, onStackChange } from '../utils/stackDetection.js'

const props = defineProps({
  // Optional stack the host page already detected — lets status resolve even
  // before the SW session store is warm.
  stack: { type: String, default: null },
})

const stackRef = computed(() => props.stack)
const { status, loading, refresh } = useConnectionStatus(stackRef)

const open = ref(false)

// ── Stack picker ─────────────────────────────────────────
// Lists every stack the SW can see (open tabs, cookies, captured sessions) and
// lets the user pin one when automatic detection picks the wrong stack.
const choices = ref({ candidates: [], resolved: null, source: null, override: null })
const otherStack = ref('')
const showOther = ref(false)
const stackError = ref('')
const savingStack = ref(false)

const SOURCE_LABELS = { tab: 'open tab', cookie: 'login cookie', session: 'SFMC page', manual: 'chosen by you', probe: 'probe' }
function sourcesLabel(sources) {
  return (sources || []).map(s => SOURCE_LABELS[s] || s).join(', ')
}

async function loadChoices() {
  const res = await getStackChoices()
  if (res) choices.value = res
}

const pickerValue = computed(() => choices.value.override || '')
const pickerOptions = computed(() => {
  const list = choices.value.candidates.map(c => ({ value: c.stack, label: `${c.stack} (${sourcesLabel(c.sources)})` }))
  const o = choices.value.override
  if (o && !list.some(x => x.value === o)) list.push({ value: o, label: `${o} (chosen by you)` })
  return list
})

async function chooseStack(value) {
  stackError.value = ''
  if (value === '__other') { showOther.value = true; return }
  showOther.value = false
  savingStack.value = true
  const res = await setStackOverride(value || null)
  savingStack.value = false
  if (res?.error) { stackError.value = res.error; return }
  await Promise.all([loadChoices(), refresh()])
}

function applyOther() {
  const v = otherStack.value.trim().toLowerCase()
  if (!/^s?\d+$/.test(v)) { stackError.value = 'A stack looks like s10 or 401.'; return }
  chooseStack(v)
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) loadChoices()
}

loadChoices()
const stopStackWatch = onStackChange(() => { refresh(); loadChoices() })

const effectiveStack = computed(() => status.value.stack || props.stack || null)

// Requirements actually gating query runs: a session (stack) and an MCA bearer
// token (Content Builder / Automation Studio Fuel — minted automatically, no tab
// required). Core CSRF is deliberately NOT counted here: verified live that SFMC
// doesn't enforce it on at least one core mutating endpoint (createTargetDE) for
// this org, and there's no reliable way to know in advance whether it'll matter for
// a given call — showing it as a hard requirement produced a checklist item that
// stayed red even after doing everything its own copy asked ("browse SFMC once"),
// which is exactly the confusing, inaccurate signal it was supposed to prevent.
const okCount = computed(() => {
  let n = 0
  if (status.value.connected) n++
  if (status.value.mcaTokenReady) n++
  return n
})
const overall = computed(() => {
  if (loading.value) return 'loading'
  if (status.value.connected && status.value.mcaTokenReady) return 'ok'
  if (status.value.connected) return 'partial'
  return 'down'
})
const dotClass = computed(() => ({
  loading: 'bg-muted-foreground',
  ok: 'bg-emerald-500',
  partial: 'bg-amber-500',
  down: 'bg-red-500',
}[overall.value]))
const summaryLabel = computed(() => {
  if (loading.value) return 'Checking…'
  if (!status.value.connected) return 'Not connected'
  const label = effectiveStack.value || 'Connected'
  return choices.value.override ? `${label} (pinned)` : label
})

// Post-click token polling: 5s after opening a tab, poll every 2s for up to
// 25s until a CSRF token / session is detected.
const polling = ref(false)
let pollStartTimer = null
let pollInterval = null

function stopPolling() {
  clearTimeout(pollStartTimer); pollStartTimer = null
  clearInterval(pollInterval); pollInterval = null
  polling.value = false
}

function startTokenPolling() {
  stopPolling()
  polling.value = true
  pollStartTimer = setTimeout(() => {
    const deadline = Date.now() + 25000
    const tick = async () => {
      await refresh()
      if (status.value.tokenReady || Date.now() >= deadline) stopPolling()
    }
    tick() // first check at the 5s mark
    pollInterval = setInterval(tick, 2000)
  }, 5000)
}

onUnmounted(() => { stopPolling(); stopStackWatch() })

function openArea(kind) {
  const s = effectiveStack.value
  // Fall back to the generic SFMC login when the stack isn't known yet.
  const base = s ? `https://mc.${s}.exacttarget.com/cloud/` : 'https://mc.exacttarget.com'
  const urls = {
    core: base,
    session: base,
  }
  chrome.tabs.create({ url: urls[kind] || base })
  startTokenPolling()
}

const rows = computed(() => [
  {
    id: 'session',
    label: 'SFMC session',
    hint: effectiveStack.value ? `Stack ${effectiveStack.value}` : 'Log in to any SFMC tab',
    ok: status.value.connected,
    area: 'session',
  },
  {
    id: 'core',
    label: 'Query · Data Extensions · Email · Automation',
    hint: status.value.areas?.core?.open ? 'Tab open' : 'No open tab',
    ok: status.value.areas?.core?.open,
    area: 'core',
  },
  {
    id: 'mcaToken',
    label: 'Content Builder · Automation Studio Fuel',
    hint: status.value.mcaTokenReady ? 'Ready' : 'Provisioning automatically…',
    ok: status.value.mcaTokenReady,
    area: null, // minted automatically in the background — no tab to open
  },
  // Core CSRF isn't a reliable requirement (SFMC doesn't enforce it on every
  // mutating endpoint, and there's no way to know in advance which ones it'll
  // matter for) — so it's never shown as a red blocker. Only surfaced as a bonus
  // "extra ready" signal on the rare occasion it happens to be cached.
  ...(status.value.tokenReady ? [{
    id: 'token',
    label: 'API token (CSRF)',
    hint: 'Captured',
    ok: true,
    area: null,
  }] : []),
])
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
      @click="toggleOpen"
    >
      <span class="h-2 w-2 rounded-full flex-shrink-0" :class="dotClass" />
      <span class="font-medium">{{ summaryLabel }}</span>
      <ChevronDown class="h-3 w-3 text-muted-foreground" />
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div class="absolute left-0 mt-1 w-72 z-50 rounded-md border border-border bg-card shadow-lg p-3 text-[11px]">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-xs">Connection status · {{ okCount }}/2 ready</span>
          <button class="text-muted-foreground hover:text-foreground" title="Refresh" @click="refresh">
            <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
          </button>
        </div>

        <div v-if="polling" class="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px]">
          <Loader2 class="h-3 w-3 animate-spin" /> Waiting for SFMC login… checking for token
        </div>

        <ul class="space-y-1.5">
          <li v-for="row in rows" :key="row.id" class="flex items-center gap-2">
            <span
              class="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
              :class="row.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'"
            >
              <Check v-if="row.ok" class="h-2.5 w-2.5" />
              <X v-else class="h-2.5 w-2.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{{ row.label }}</div>
              <div class="truncate text-muted-foreground">{{ row.hint }}</div>
            </div>
            <button
              v-if="row.area && !row.ok"
              class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted flex-shrink-0"
              @click="openArea(row.area)"
            >
              <ExternalLink class="h-3 w-3" /> Open
            </button>
          </li>
        </ul>

        <div class="mt-3 pt-2 border-t border-border">
          <label class="block font-medium mb-1" for="sfmcqs-stack">Stack</label>
          <select
            id="sfmcqs-stack"
            class="w-full rounded border border-border bg-background text-foreground px-1.5 py-1"
            :value="showOther ? '__other' : pickerValue"
            :disabled="savingStack"
            @change="chooseStack($event.target.value)"
          >
            <option value="">Automatic{{ !choices.override && choices.resolved ? ` (${choices.resolved})` : '' }}</option>
            <option v-for="o in pickerOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            <option value="__other">Other…</option>
          </select>
          <div v-if="showOther" class="flex gap-1 mt-1">
            <input
              v-model="otherStack"
              class="flex-1 min-w-0 rounded border border-border bg-background text-foreground px-1.5 py-0.5"
              placeholder="e.g. s10"
              @keydown.enter="applyOther"
            />
            <button class="px-2 rounded border border-border hover:bg-muted" @click="applyOther">Use</button>
          </div>
          <p v-if="stackError" class="mt-1 text-red-600">{{ stackError }}</p>
          <p v-else class="mt-1 text-muted-foreground">
            {{ choices.override
              ? 'Pinned. Pick Automatic to detect it again.'
              : 'Wrong stack? Pick the one you are logged in to.' }}
          </p>
        </div>

        <p v-if="!status.connected" class="mt-2 text-muted-foreground">
          Open a logged-in SFMC tab so the extension can detect your stack.
        </p>
      </div>
    </template>
  </div>
</template>

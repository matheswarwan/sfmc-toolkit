<script setup>
import { computed, onUnmounted, ref } from 'vue'
import Switch from '@/components/ui/switch/Switch.vue'
import StorageUsage from '@/components/StorageUsage.vue'
import FeedbackModal from '@/components/modals/FeedbackModal.vue'
import { useTheme } from '@/composables/useTheme.js'
import { useStoredSetting } from '@/composables/useStoredSetting.js'
import { disabledRules, setRuleDisabled, onLintSettingsChange } from '@/editor/lintSettings.js'
import { buildBackup, backupFileName, parseBackup, planImport, describeImport } from '@/utils/backup.js'
import { saveTextFile, readFileText } from '@/utils/download.js'
import { showToast } from '@/composables/useToast.js'

const { currentTheme, themes, setTheme } = useTheme()

// Same keys as SFMC Query Saver, read by the service worker and the run flow.
const { value: emailSaver } = useStoredSetting('_emailSaverEnabled', true, (v) => v !== false)
const { value: emailDebounce } = useStoredSetting('_emailSaveDebounce', 5,
  (v) => (typeof v === 'number' && v >= 0 ? v : 5))
const { value: reuseQueryDE } = useStoredSetting('_reuseQueryDE', false, (v) => v === true)

const offRules = ref([...disabledRules()].sort())
const stopLint = onLintSettingsChange((set) => { offRules.value = [...set].sort() })
onUnmounted(stopLint)

const showFeedback = ref(false)
const version = computed(() => {
  try { return chrome.runtime.getManifest().version } catch { return '' }
})

// ── Backup ───────────────────────────────────────────────
const backupInput = ref(null)
const importResult = ref('')
const importError = ref('')

const getAll = () => new Promise((r) => chrome.storage.local.get(null, (items) => r(items || {})))

async function exportBackup() {
  const backup = buildBackup(await getAll(), { app: 'sfmc-toolkit', appVersion: version.value })
  await saveTextFile(JSON.stringify(backup, null, 2), backupFileName('sfmc-toolkit'), 'application/json', 'Backup file')
}

async function importBackup(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  importResult.value = ''
  importError.value = ''
  if (!file) return
  try {
    const backup = parseBackup(await readFileText(file))
    const plan = planImport(backup.items, await getAll())
    if (Object.keys(plan.writes).length) await new Promise((r) => chrome.storage.local.set(plan.writes, r))
    importResult.value = describeImport(plan)
    showToast(importResult.value)
  } catch (e) {
    importError.value = e.message
  }
}

function setDebounce(e) {
  const n = Math.round(Number(e.target.value))
  emailDebounce.value = Number.isFinite(n) ? Math.min(60, Math.max(0, n)) : 5
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-6 py-6 space-y-6">
    <section class="rounded-lg border border-border bg-card p-4">
      <h2 class="text-sm font-semibold mb-3">Appearance</h2>
      <div class="flex gap-2" role="radiogroup" aria-label="Theme">
        <button
          v-for="t in themes" :key="t.id" role="radio" :aria-checked="currentTheme === t.id"
          class="flex items-center gap-2 h-8 px-3 rounded-md border text-sm"
          :class="currentTheme === t.id ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-accent'"
          @click="setTheme(t.id)"
        >
          <span class="h-3 w-3 rounded-full border border-border" :style="{ background: t.swatch }" />
          {{ t.label }}
        </button>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-card p-4 space-y-4">
      <h2 class="text-sm font-semibold">Emails</h2>
      <div class="flex items-start gap-3">
        <div class="flex-1">
          <div class="text-sm font-medium">Save email versions</div>
          <p class="text-xs text-muted-foreground">Each time you save an email in Content Builder, a copy is kept here so you can compare or revert it.</p>
        </div>
        <Switch v-model="emailSaver" aria-label="Save email versions" />
      </div>
      <div class="flex items-center gap-3" :class="{ 'opacity-50': !emailSaver }">
        <label for="email-debounce" class="flex-1">
          <div class="text-sm font-medium">Minimum time between versions</div>
          <p class="text-xs text-muted-foreground">Saves of the same email closer together than this are skipped. 0 keeps every save.</p>
        </label>
        <div class="flex items-center gap-1.5 text-sm">
          <input id="email-debounce" type="number" min="0" max="60" :value="emailDebounce" :disabled="!emailSaver"
            class="w-16 h-8 rounded-md border border-border bg-background px-2" @change="setDebounce" />
          seconds
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-card p-4 space-y-4">
      <h2 class="text-sm font-semibold">Running queries</h2>
      <div class="flex items-start gap-3">
        <div class="flex-1">
          <div class="text-sm font-medium">Reuse the data extension and Query Activity</div>
          <p class="text-xs text-muted-foreground">Running the same query again reuses its last target DE and Query Activity instead of creating new ones.</p>
        </div>
        <Switch v-model="reuseQueryDE" aria-label="Reuse the data extension and Query Activity" />
      </div>
      <div>
        <div class="text-sm font-medium">Turned-off lint rules</div>
        <p v-if="!offRules.length" class="text-xs text-muted-foreground">None. Turn a rule off from its message in the SQL editor.</p>
        <ul v-else class="mt-2 space-y-1">
          <li v-for="code in offRules" :key="code" class="flex items-center gap-2 text-sm">
            <code class="flex-1">{{ code }}</code>
            <button class="h-7 px-2 rounded-md border border-border text-xs hover:bg-accent" @click="setRuleDisabled(code, false)">Turn on</button>
          </li>
        </ul>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-card p-4">
      <h2 class="text-sm font-semibold">Backup</h2>
      <p class="text-xs text-muted-foreground mt-1">
        One file with your saved queries (with run history), email versions, workspaces and settings.
        Import a backup from SFMC Query Saver or SFMC Toolkit. Nothing already here is overwritten.
      </p>
      <div class="flex gap-2 mt-3">
        <button class="h-8 px-3 rounded-md border border-border text-xs hover:bg-accent" @click="exportBackup">Export backup</button>
        <button class="h-8 px-3 rounded-md border border-border text-xs hover:bg-accent" @click="backupInput?.click()">Import backup</button>
        <input ref="backupInput" type="file" accept=".json,application/json" class="hidden" @change="importBackup" />
      </div>
      <p v-if="importResult" class="mt-2 text-xs text-emerald-700 dark:text-emerald-400" role="status">{{ importResult }}</p>
      <p v-if="importError" class="mt-2 text-xs text-red-600" role="alert">{{ importError }}</p>
    </section>

    <section class="rounded-lg border border-border bg-card p-4">
      <h2 class="text-sm font-semibold mb-3">Storage</h2>
      <StorageUsage />
    </section>

    <section class="rounded-lg border border-border bg-card p-4 text-sm">
      <h2 class="font-semibold mb-2">About</h2>
      <p class="text-muted-foreground">SFMC Toolkit {{ version }}. It combines SFMC Query Saver and SFMC Automation Viewer.</p>
      <button class="mt-3 h-8 px-3 rounded-md border border-border text-xs hover:bg-accent" @click="showFeedback = true">Send feedback</button>
    </section>

    <FeedbackModal v-if="showFeedback" screen="settings" @close="showFeedback = false" />
  </div>
</template>

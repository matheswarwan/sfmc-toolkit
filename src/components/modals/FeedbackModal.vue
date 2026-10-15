<script setup>
// Feedback: what happened, more details, an optional marked-up screenshot, and
// optional technical details (shown before sending). Goes to the feedback worker
// (workers/feedback), which SFMC Query Saver used too.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { X, Camera, MonitorUp, ImageUp, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-vue-next'
import ScreenshotEditor from '@/components/feedback/ScreenshotEditor.vue'
import { useStack } from '@/composables/useStack.js'
import { useTheme } from '@/composables/useTheme.js'
import { fetchCurrentBU, recentApiErrors } from '@/utils/sfmcApi.js'
import { collectFeedbackMetadata, metadataLines } from '@/utils/feedbackMeta.js'
import { capturePage, captureDisplay, loadImage, fileToDataUrl, toUploadableDataUrl } from '@/utils/screenshot.js'

const FEEDBACK_ENDPOINT = 'https://query-saver-feedback.mathes-btech.workers.dev/feedback'

const props = defineProps({ screen: { type: String, default: 'unknown' } })
const emit = defineEmits(['close'])

const { stack } = useStack()
const { currentTheme } = useTheme()

const kind = ref('problem')
const message = ref('')
const details = ref('')
const name = ref('')
const email = ref('')
const includeMeta = ref(true)
const showMeta = ref(false)
const bu = ref(null)
const state = ref('idle') // idle | sending | sent | error
const sendError = ref('')
const sentNote = ref('') // e.g. the screenshot could not be attached

const image = ref(null) // canvas or <img> being marked up
const editor = ref(null)
const capturing = ref(false)
const hidden = ref(false) // while capturing this page
const shotError = ref('')
const fileInput = ref(null)

onMounted(async () => {
  window.addEventListener('paste', onPaste)
  if (stack.value) { try { bu.value = (await fetchCurrentBU(stack.value))?.name || null } catch { /* leave it out */ } }
})
onUnmounted(() => window.removeEventListener('paste', onPaste))

const meta = computed(() => collectFeedbackMetadata({
  route: props.screen, stack: stack.value, businessUnit: bu.value, theme: currentTheme.value, apiErrors: recentApiErrors(),
}))
const metaLines = computed(() => metadataLines(meta.value))

async function captureThisPage() {
  shotError.value = ''
  capturing.value = true
  hidden.value = true
  try {
    await nextTick()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    image.value = await capturePage(document.getElementById('app'))
  } catch (e) {
    shotError.value = `Could not capture this page: ${e.message}`
  } finally {
    hidden.value = false
    capturing.value = false
  }
}

async function captureOther() {
  shotError.value = ''
  capturing.value = true
  try {
    image.value = await captureDisplay()
  } catch (e) {
    if (e?.name !== 'NotAllowedError') shotError.value = `Could not capture: ${e.message}`
  } finally {
    capturing.value = false
  }
}

async function useFile(file) {
  if (!file || !file.type.startsWith('image/')) { shotError.value = 'That is not an image.'; return }
  shotError.value = ''
  try { image.value = await loadImage(await fileToDataUrl(file)) } catch (e) { shotError.value = e.message }
}
function onFile(e) { useFile(e.target.files?.[0]); e.target.value = '' }
function onPaste(e) {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
  if (item) { e.preventDefault(); useFile(item.getAsFile()) }
}

async function submit() {
  if (!message.value.trim()) return
  state.value = 'sending'
  sendError.value = ''
  try {
    // A picture that includes images from other sites can't be exported by the
    // browser; send the feedback anyway, without it, rather than not at all.
    let screenshot = null
    sentNote.value = ''
    if (image.value && editor.value) {
      try { screenshot = toUploadableDataUrl(editor.value.getResult()) } catch (e) { sentNote.value = `The screenshot could not be attached (${e.message}).` }
    }
    const version = chrome?.runtime?.getManifest?.()?.version ?? 'unknown'
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.value.trim(),
        details: details.value.trim() || null,
        kind: kind.value,
        // Same table as SFMC Query Saver; the prefix and `app` tell the two apart.
        screen: `toolkit/${props.screen.replace(/^\/+/, '')}`,
        app: 'toolkit',
        version,
        name: name.value.trim() || null,
        email: email.value.trim() || null,
        metadata: includeMeta.value ? meta.value : null,
        screenshot,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    state.value = 'sent'
  } catch (e) {
    sendError.value = e.message
    state.value = 'error'
  }
}

const KINDS = [
  { id: 'problem', label: 'Something is wrong' },
  { id: 'idea', label: 'Idea' },
  { id: 'question', label: 'Question' },
]
</script>

<template>
  <div v-show="!hidden" class="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" @mousedown.self="state === 'sending' || emit('close')">
    <div class="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div class="flex items-center gap-2 px-5 py-3 border-b border-border">
        <h2 id="feedback-title" class="flex-1 text-base font-semibold">Send feedback</h2>
        <button class="p-1 rounded hover:bg-accent" title="Close" @click="emit('close')"><X class="h-4 w-4" /></button>
      </div>

      <div v-if="state === 'sent'" class="p-8 text-center">
        <p class="text-base font-semibold">Thank you, it's sent.</p>
        <p v-if="sentNote" class="text-sm text-amber-700 dark:text-amber-400 mt-1">{{ sentNote }} Use Upload an image to send one.</p>
        <p class="text-sm text-muted-foreground mt-1">{{ email ? 'You may get a reply at ' + email + '.' : 'Add your email next time if you would like a reply.' }}</p>
        <button class="mt-4 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm" @click="emit('close')">Close</button>
      </div>

      <form v-else class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 text-sm" @submit.prevent="submit">
        <div class="flex gap-2" role="radiogroup" aria-label="Kind of feedback">
          <button v-for="k in KINDS" :key="k.id" type="button" role="radio" :aria-checked="kind === k.id"
            class="h-8 px-3 rounded-full border text-xs" :class="kind === k.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'"
            @click="kind = k.id">{{ k.label }}</button>
        </div>

        <label class="block">
          <span class="font-medium">{{ kind === 'problem' ? 'What happened?' : kind === 'idea' ? 'Your idea' : 'Your question' }}</span>
          <textarea v-model="message" required rows="3" maxlength="2000" class="mt-1 w-full rounded-md border border-border bg-background p-2"
            :placeholder="kind === 'problem' ? 'For example: Run stops at Create DE with a 403 error' : ''" />
        </label>
        <label class="block">
          <span class="font-medium">More details</span> <span class="text-xs text-muted-foreground">(optional)</span>
          <textarea v-model="details" rows="4" maxlength="5000" class="mt-1 w-full rounded-md border border-border bg-background p-2"
            :placeholder="kind === 'problem' ? 'Steps to get there, what you expected, the exact error text…' : ''" />
        </label>

        <section>
          <div class="font-medium">Screenshot <span class="text-xs font-normal text-muted-foreground">(optional)</span></div>
          <div v-if="!image" class="mt-1.5 flex flex-wrap gap-2">
            <button type="button" class="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-accent disabled:opacity-50" :disabled="capturing" @click="captureThisPage">
              <Loader2 v-if="capturing" class="h-3.5 w-3.5 animate-spin" /><Camera v-else class="h-3.5 w-3.5" /> Capture this page
            </button>
            <button type="button" class="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-accent disabled:opacity-50" :disabled="capturing" @click="captureOther">
              <MonitorUp class="h-3.5 w-3.5" /> Capture another tab or window…
            </button>
            <button type="button" class="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs hover:bg-accent" @click="fileInput?.click()">
              <ImageUp class="h-3.5 w-3.5" /> Upload an image
            </button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
            <span class="self-center text-xs text-muted-foreground">or paste one (Ctrl+V)</span>
          </div>
          <p v-if="shotError" class="mt-1 text-xs text-red-600">{{ shotError }}</p>
          <div v-if="image" class="mt-1.5">
            <ScreenshotEditor ref="editor" :image="image" />
            <div class="flex items-center gap-2 mt-1.5">
              <p class="flex-1 text-xs text-amber-700 dark:text-amber-400">Screenshots can show customer data. Draw over anything private before you send.</p>
              <button type="button" class="flex items-center gap-1 h-7 px-2 rounded-md border border-border text-xs hover:bg-accent" @click="image = null"><Trash2 class="h-3.5 w-3.5" /> Remove</button>
            </div>
          </div>
        </section>

        <section>
          <label class="flex items-start gap-2">
            <input v-model="includeMeta" type="checkbox" class="mt-1" />
            <span><span class="font-medium">Include technical details</span><br />
              <span class="text-xs text-muted-foreground">Version, browser, the section you are on, stack and business unit, and the last failed SFMC calls (no SQL or data).</span></span>
          </label>
          <button v-if="includeMeta" type="button" class="mt-1 ml-6 flex items-center gap-1 text-xs text-primary hover:underline" :aria-expanded="showMeta" @click="showMeta = !showMeta">
            <ChevronDown v-if="showMeta" class="h-3 w-3" /><ChevronRight v-else class="h-3 w-3" /> See exactly what is sent
          </button>
          <dl v-if="includeMeta && showMeta" class="mt-1 ml-6 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 text-xs rounded-md border border-border bg-muted/30 p-2">
            <template v-for="([k, v], i) in metaLines" :key="i"><dt class="text-muted-foreground">{{ k }}</dt><dd class="break-all">{{ v }}</dd></template>
          </dl>
        </section>

        <div class="grid grid-cols-2 gap-3">
          <label class="block"><span class="text-xs text-muted-foreground">Name (optional)</span>
            <input v-model="name" maxlength="100" class="mt-0.5 w-full h-8 rounded-md border border-border bg-background px-2" /></label>
          <label class="block"><span class="text-xs text-muted-foreground">Email, if you'd like a reply (optional)</span>
            <input v-model="email" type="email" maxlength="200" class="mt-0.5 w-full h-8 rounded-md border border-border bg-background px-2" /></label>
        </div>

        <p v-if="state === 'error'" class="text-sm text-red-600" role="alert">Could not send ({{ sendError }}). Please try again.</p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="h-9 px-4 rounded-md border border-border text-sm hover:bg-accent" @click="emit('close')">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50 flex items-center gap-1.5" :disabled="!message.trim() || state === 'sending'">
            <Loader2 v-if="state === 'sending'" class="h-4 w-4 animate-spin" /> Send
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

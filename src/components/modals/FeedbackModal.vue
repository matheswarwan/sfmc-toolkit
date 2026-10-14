<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const FEEDBACK_ENDPOINT = 'https://query-saver-feedback.mathes-btech.workers.dev/feedback'

const props = defineProps({
  screen: { type: String, default: 'popup' },
})
const emit = defineEmits(['close'])

const message = ref('')
const name    = ref('')
const email   = ref('')
const state   = ref('idle') // idle | sending | sent | error

async function submit() {
  const text = message.value.trim()
  if (!text) return
  state.value = 'sending'
  try {
    const version = chrome?.runtime?.getManifest?.()?.version ?? 'unknown'
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: text,
        // Same D1 table as SFMC Query Saver; the prefix tells the two apart.
        screen:  `toolkit/${props.screen}`,
        app:     'toolkit',
        version,
        name:    name.value.trim()  || null,
        email:   email.value.trim() || null,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    state.value = 'sent'
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      @click.self="emit('close')"
    >
      <div class="w-[360px] rounded-xl bg-card border border-border shadow-2xl overflow-hidden">

        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <span class="text-sm font-semibold text-foreground">Feedback</span>
          <button
            class="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div v-if="state === 'sent'" class="px-4 py-6 text-center">
          <p class="text-sm font-medium text-foreground mb-1">Thanks for the feedback.</p>
          <p class="text-xs text-muted-foreground mb-4">We read every message.</p>
          <button class="text-xs text-primary hover:underline" @click="emit('close')">Close</button>
        </div>

        <div v-else class="px-4 py-4 flex flex-col gap-3">
          <textarea
            v-model="message"
            :disabled="state === 'sending'"
            rows="4"
            class="w-full text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:border-ring disabled:opacity-50"
            placeholder="What's working, what's broken, or what you'd like to see..."
            @keydown.meta.enter="submit"
          />

          <div class="flex gap-2">
            <input
              v-model="name"
              :disabled="state === 'sending'"
              type="text"
              class="w-1/2 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground px-2.5 py-1.5 focus:outline-none focus:border-ring disabled:opacity-50"
              placeholder="Name (optional)"
            />
            <input
              v-model="email"
              :disabled="state === 'sending'"
              type="email"
              class="w-1/2 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground px-2.5 py-1.5 focus:outline-none focus:border-ring disabled:opacity-50"
              placeholder="Email (optional)"
            />
          </div>

          <p v-if="state === 'error'" class="text-[11px] text-red-600 dark:text-red-400">
            Could not send. Check your connection and try again.
          </p>
          <div class="flex items-center justify-end gap-2">
            <button
              class="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              :disabled="!message.trim() || state === 'sending'"
              @click="submit"
            >
              {{ state === 'sending' ? 'Sending...' : 'Send' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

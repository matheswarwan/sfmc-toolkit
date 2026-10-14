<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Search, MessageSquare } from 'lucide-vue-next'
import AppSidebar from '@/components/shell/AppSidebar.vue'
import ConnectionMenu from '@/components/shell/ConnectionMenu.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'
import ToastHost from '@/components/shell/ToastHost.vue'
import ApiConsole from '@/components/shell/ApiConsole.vue'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher.vue'
import FeedbackModal from '@/components/modals/FeedbackModal.vue'
import { useTheme } from '@/composables/useTheme.js'
import { trackEvent } from '@/utils/analytics.js'

const route = useRoute()
const paletteOpen = ref(false)
const showFeedback = ref(false)
const isMac = /Mac/i.test(navigator.platform || '')

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

onMounted(() => {
  useTheme().loadTheme()
  window.addEventListener('keydown', onKey)
  trackEvent('app_open')
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <header class="flex items-center gap-3 h-12 px-4 border-b border-border bg-card">
        <div class="min-w-0 flex-1">
          <span v-if="route.meta.group" class="text-xs text-muted-foreground">{{ route.meta.group }} / </span>
          <span class="text-sm font-semibold">{{ route.meta.title }}</span>
        </div>
        <button
          class="hidden sm:flex items-center gap-2 h-8 w-56 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent"
          @click="paletteOpen = true"
        >
          <Search class="h-3.5 w-3.5" />
          <span class="flex-1 text-left">Search</span>
          <kbd class="text-[10px] border border-border rounded px-1">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
        </button>
        <ConnectionMenu />
        <button class="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title="Send feedback" @click="showFeedback = true">
          <MessageSquare class="h-4 w-4" />
        </button>
        <ThemeSwitcher />
      </header>
      <main class="flex-1 min-h-0 overflow-auto">
        <!-- Workspace and Query Builder stay alive in the background, so a running
             query or a half-built join survives a visit to another section. -->
        <RouterView v-slot="{ Component }">
          <KeepAlive :include="['WorkspacePage', 'BuilderPage']">
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </main>
      <ApiConsole />
    </div>
    <CommandPalette :open="paletteOpen" @close="paletteOpen = false" />
    <ToastHost />
    <FeedbackModal v-if="showFeedback" :screen="route.path" @close="showFeedback = false" />
  </div>
</template>

<script setup>
// Shown once after an update that has news: to SFMC Query Saver users the rename
// to Marketing Cloud Toolkit (2.0.0) plus the latest news, to Toolkit users only the news.
// Fresh installs skip it. Uses Query Saver's `_seenVersion` key.
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const VERSION = '2.0.11'
const open = ref(false)
const fromQuerySaver = ref(false)

try {
  chrome.storage.local.get(null, (all) => {
    if (all?._seenVersion === VERSION) return
    const upgrading = !!all?._seenVersion || Object.keys(all || {}).some((k) => /^(sql|email|workspace)_/.test(k))
    // Query Saver stored 1.x here; the Toolkit stores 2.x.
    fromQuerySaver.value = !String(all?._seenVersion || '').startsWith('2.')
    if (upgrading) open.value = true
    else chrome.storage.local.set({ _seenVersion: VERSION })
  })
} catch { /* not in an extension */ }

function close() {
  open.value = false
  try { chrome.storage.local.set({ _seenVersion: VERSION }) } catch { /* not in an extension */ }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-150 flex items-center justify-center bg-black/50 p-4" @mousedown.self="close">
    <div class="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
      <div class="flex items-center justify-between px-5 pt-5">
        <span class="text-[11px] font-bold text-primary bg-primary/10 rounded-full px-3 py-1 uppercase tracking-wide">Version {{ VERSION }}</span>
        <button class="p-1 rounded hover:bg-accent" title="Close" @click="close"><X class="h-4 w-4" /></button>
      </div>
      <h2 id="whatsnew-title" class="px-5 mt-3 text-lg font-bold">{{ fromQuerySaver ? 'SFMC Query Saver is now Marketing Cloud Toolkit' : 'What\'s new in Marketing Cloud Toolkit' }}</h2>
      <ul v-if="!fromQuerySaver" class="px-5 mt-3 mb-5 space-y-3 text-sm">
        <li><strong class="block">A new name</strong><span class="text-muted-foreground">SFMC Toolkit is now Marketing Cloud Toolkit. Nothing else changes: everything you saved is still here.</span></li>
        <li><strong class="block">Share an overview</strong><span class="text-muted-foreground">Automation overview and Journey overview have a Download menu: copy as Markdown, or download Markdown, Word or HTML.</span></li>
        <li><strong class="block">Schema search in Run Query</strong><span class="text-muted-foreground">Find a data extension or data view, see its fields and click one to write it at the cursor. Cmd/Ctrl+Enter runs the query (or the selected part).</span></li>
        <li><strong class="block">Row counts everywhere</strong><span class="text-muted-foreground">Data extensions on activity cards, Journey Entry and Where used show their row counts. Shared DEs get ENT. in generated SQL, and new tabs open next to this one.</span></li>
        <li><strong class="block">Skip slow steps in Where used</strong><span class="text-muted-foreground">Untick a step to leave it out, or Skip it while it runs. Saved data from an earlier check is used where there is some.</span></li>
        <li><strong class="block">Works from mc.exacttarget.com</strong><span class="text-muted-foreground">SFMC opened without a stack in the address (mc.exacttarget.com) now connects too.</span></li>
      </ul>
      <ul v-else class="px-5 mt-3 mb-5 space-y-3 text-sm">
        <li><strong class="block">Everything you saved is here</strong><span class="text-muted-foreground">Saved queries with their run history, workspaces, Query Builder queries and email versions, under Queries and Saved Emails in the sidebar.</span></li>
        <li><strong class="block">New sections</strong><span class="text-muted-foreground">Automations, Activities, Journeys, Journey Entry, Data Extensions and CloudPages.</span></li>
        <li><strong class="block">Settings have their own page</strong><span class="text-muted-foreground">Email versions, reuse DE, lint rules, backups and the API console are under Settings.</span></li>
        <li><strong class="block">Several tabs</strong><span class="text-muted-foreground">The toolbar icon opens a new tab each time; Ctrl+K jumps to any section.</span></li>
        <li><strong class="block">Where used</strong><span class="text-muted-foreground">Data > Where used shows what uses a data extension, field, email or content block, and what an automation touches.</span></li>
      </ul>
      <div class="px-5 pb-5"><button class="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium" @click="close">Got it</button></div>
    </div>
  </div>
</template>

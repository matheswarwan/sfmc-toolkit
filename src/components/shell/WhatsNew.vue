<script setup>
// Shown once after an update that has news: to SFMC Query Saver users the rename
// to Marketing Cloud Toolkit (2.0.0) plus the latest news, to Toolkit users only the news.
// Fresh installs skip it. Uses Query Saver's `_seenVersion` key.
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const VERSION = '2.0.12'
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
        <li><strong class="block">Create DE</strong><span class="text-muted-foreground">Data > Create DE: paste or drop a sample (CSV, TSV, JSON, Parquet, Excel) or start empty, check the guessed fields, pick the folder and retention, and create the data extension.</span></li>
        <li><strong class="block">View a data extension's rows</strong><span class="text-muted-foreground">Data Extensions: View rows reads the rows straight from SFMC, no query needed. Load more or all (up to 50,000), filter, hide columns, and download CSV, Excel or Markdown.</span></li>
        <li><strong class="block">Save as query activity</strong><span class="text-muted-foreground">From Run Query, create a named Query Activity in the folder you pick, writing to a new or existing data extension. Nothing is run or scheduled.</span></li>
        <li><strong class="block">See where results went</strong><span class="text-muted-foreground">After a run, the results data extension and Query Activity are named, with links.</span></li>
        <li><strong class="block">Query Builder</strong><span class="text-muted-foreground">Drag data extensions to reorder or swap them, and the search finds every data extension.</span></li>
        <li><strong class="block">Overviews ready sooner</strong><span class="text-muted-foreground">Automation overview and Journey overview load quietly in the background after the app opens.</span></li>
        <li><strong class="block">No more empty searches</strong><span class="text-muted-foreground">When an SFMC app has no session, a search connects it and tries again; if that fails it says which app, with Retry and a link to log in.</span></li>
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

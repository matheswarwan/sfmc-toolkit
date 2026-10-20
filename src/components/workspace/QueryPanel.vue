<script setup>
import { computed, ref, toRef } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'radix-vue'
import {
  Pencil, Check, X, Play, ShieldCheck, ChevronDown, LogIn, History,
  FolderOpen, RefreshCw, Search, Share2, Copy, ExternalLink, Maximize2, Minimize2, AlignLeft,
} from 'lucide-vue-next'
import QueryEditor from '../detail/QueryEditor.vue'
import ValidationPanel from '../detail/ValidationPanel.vue'
import RunStepper from '../detail/RunStepper.vue'
import ResultsTable from '../detail/ResultsTable.vue'
import CleanupActions from '../detail/CleanupActions.vue'
import Button from '../ui/button/Button.vue'
import Input from '../ui/input/Input.vue'
import QueryActivityTreeNode from './QueryActivityTreeNode.vue'
import InsertFieldsMenu from './InsertFieldsMenu.vue'
import { useQueryPanel } from '../../composables/useQueryPanel.js'

const props = defineProps({
  queryId:     { type: String, required: true },
  stack:       { type: String, default: null },
  canInteract: { type: Boolean, default: false },
  initialSql:  { type: String, default: '' },
  panelIndex:  { type: Number, default: 0 },
  showClose:   { type: Boolean, default: true },
  isExpanded:  { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'duplicate', 'title-change', 'expand'])

const {
  queryName, isEditingName, editableName, saveStatus, isRunning,
  resultsMode, validationResults, stepStatuses, stepErrors, stepDetails,
  elapsedSeconds, completedSummary, resultRows, resultColumns, totalRowCount,
  isFetchingMore, fetchMoreRows, fetchAllRows, LOAD_ALL_LIMIT,
  createdDeKey, createdActivityId, isDeleting,
  runs, currentRunId, activeTab, historyResults,
  sessionExpired, contactBuilderNeeded, isResultsOpen, editorHeightPct, answerPrompt,
  showRunStepper, queryText,
  onEditorChange, enableNameEditing, saveName, runValidation, runQuery,
  handleDeleteDE, handleDeleteActivity,
  onResizeStart, toggleHistoryResults, formatRunDate, openSfmcLogin,
  showQueryPicker, queryPickerLoading, queryPickerSearch, queryPickerError,
  filteredPickerItems, openQueryPicker, refreshQueryPicker, selectQueryActivity,
  relativeDate, queryPickerTree, expandedQaFolders, toggleQaFolder, queryPickerItems,
  showShare, shareUrl, shareLoading, shareError, shareQuery, copiedText, copyToClipboard,
} = useQueryPanel({
  queryId: props.queryId,
  stack: toRef(props, 'stack'),
  panelIndex: props.panelIndex,
  initialSql: props.initialSql,
  onTitleChange: (name) => emit('title-change', { queryId: props.queryId, name }),
})

const panelTitle = computed(() => queryName.value || `Panel ${props.panelIndex + 1}`)

// Format SQL (button or Shift+Alt+F in the editor). A short note shows when it couldn't.
const editorRef = ref(null)
const formatNote = ref('')
let formatNoteTimer = null
function onFormatResult(r) {
  clearTimeout(formatNoteTimer)
  formatNote.value = r.ok ? '' : (r.error || '')
  if (formatNote.value) formatNoteTimer = setTimeout(() => { formatNote.value = '' }, 4000)
}
function formatQuery() {
  editorRef.value?.format()
}
</script>

<template>
  <div class="query-panel flex flex-col min-h-0 min-w-0 rounded-lg border border-border bg-card overflow-hidden shadow-sm">
    <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0">
      <span class="text-[10px] font-bold text-muted-foreground">#{{ panelIndex + 1 }}</span>
      <template v-if="!isEditingName">
        <span class="text-xs font-semibold truncate flex-1" @dblclick="enableNameEditing">{{ panelTitle }}</span>
        <Button variant="ghost" size="icon" class="h-6 w-6" title="Rename panel" @click="enableNameEditing"><Pencil class="h-3 w-3" /></Button>
      </template>
      <template v-else>
        <Input v-model="editableName" class="h-6 text-xs flex-1" @keyup.enter="saveName" />
        <Button variant="ghost" size="icon" class="h-6 w-6" title="Save name" @click="saveName"><Check class="h-3 w-3" /></Button>
      </template>
      <Button variant="outline" size="sm" class="h-6 text-[10px] px-1" :disabled="!canInteract || isRunning" title="Open an existing Query Activity from Automation Studio" @click="openQueryPicker"><FolderOpen class="h-3 w-3" /></Button>
      <Button variant="outline" size="sm" class="h-6 text-[10px] px-1" :disabled="!queryText.trim()" title="Share query" @click="shareQuery"><Share2 class="h-3 w-3" /></Button>
      <Button variant="outline" size="sm" class="h-6 text-[10px] px-1" :disabled="!queryText.trim() || activeTab !== 'editor'" title="Format SQL (Shift+Alt+F)" @click="formatQuery"><AlignLeft class="h-3 w-3" /></Button>
      <InsertFieldsMenu :editor="editorRef" :disabled="activeTab !== 'editor' || isRunning" />
      <Button variant="ghost" size="icon" class="h-6 w-6" :title="isExpanded ? 'Minimize panel' : 'Expand panel'" @click="$emit('expand')">
        <Minimize2 v-if="isExpanded" class="h-3 w-3" />
        <Maximize2 v-else class="h-3 w-3" />
      </Button>
      <Button variant="outline" size="sm" class="h-6 text-[10px] px-1" :disabled="!canInteract || isRunning" title="Validate query" @click="runValidation"><ShieldCheck class="h-3 w-3" /></Button>
      <Button size="sm" class="h-6 text-[10px] px-1 bg-[#0176D3] text-white" :disabled="!canInteract || isRunning" title="Run query" @click="runQuery(0)"><Play class="h-3 w-3 fill-white" /></Button>
      <Button variant="ghost" size="icon" class="h-6 w-6" :title="activeTab === 'history' ? 'Back to editor' : 'View run history'" @click="activeTab = activeTab === 'history' ? 'editor' : 'history'"><History class="h-3 w-3" /></Button>
      <Button v-if="showClose" variant="ghost" size="icon" class="h-6 w-6" title="Close panel" @click="$emit('close')"><X class="h-3 w-3" /></Button>
    </div>

    <!-- Query Activity picker ("Open from AS") -->
    <DialogRoot :open="showQueryPicker">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-9999 bg-black/45" @click="showQueryPicker = false" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-9999 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[70vh] rounded-xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col focus:outline-none"
          @click.stop
        >
          <DialogTitle class="sr-only">Open Query Activity</DialogTitle>

          <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div class="flex items-center gap-2">
              <FolderOpen class="h-4 w-4 text-primary" />
              <span class="text-sm font-bold text-foreground">Open Query Activity</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                class="text-[11px] border border-border text-muted-foreground px-2 py-0.5 rounded hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                :disabled="queryPickerLoading"
                title="Refresh list"
                @click="refreshQueryPicker"
              >
                <RefreshCw class="h-3 w-3" />
              </button>
              <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground" title="Close" @click="showQueryPicker = false">
                <X class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div class="px-4 pt-3 pb-2 shrink-0">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input v-model="queryPickerSearch" class="pl-8 h-8 text-sm" placeholder="Search by name…" autofocus />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1 min-h-0">
            <div v-if="queryPickerLoading" class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <span class="inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading query activities…
            </div>

            <div v-else-if="queryPickerError"
              class="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3 mt-1">
              {{ queryPickerError }}
            </div>

            <div v-else-if="queryPickerSearch.trim()">
              <div v-if="filteredPickerItems.length === 0" class="text-sm text-muted-foreground italic text-center py-8">
                No results match your search.
              </div>
              <button
                v-else
                v-for="item in filteredPickerItems"
                :key="item.queryDefinitionId"
                class="flex items-start justify-between gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-transparent hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer bg-transparent"
                @click="selectQueryActivity(item)"
              >
                <span class="text-sm font-medium text-foreground truncate flex-1 min-w-0">{{ item.name }}</span>
                <span class="text-[10px] text-muted-foreground shrink-0 mt-0.5">{{ relativeDate(item.modifiedDate) }}</span>
              </button>
            </div>

            <!-- Folder tree (default view, no search) -->
            <div v-else-if="queryPickerTree.length === 0" class="text-sm text-muted-foreground italic text-center py-8">
              No query activities found.
            </div>
            <QueryActivityTreeNode
              v-else
              v-for="root in queryPickerTree"
              :key="root.id"
              :node="root"
              :expanded="expandedQaFolders"
              :relative-date="relativeDate"
              @toggle="toggleQaFolder"
              @select="selectQueryActivity"
            />
          </div>

          <div v-if="!queryPickerLoading && queryPickerSearch.trim() && filteredPickerItems.length > 0"
            class="px-4 py-2 border-t border-border shrink-0 text-[11px] text-muted-foreground">
            {{ filteredPickerItems.length }} {{ filteredPickerItems.length === 1 ? 'activity' : 'activities' }} matching "{{ queryPickerSearch.trim() }}"
          </div>
          <div v-else-if="!queryPickerLoading && !queryPickerSearch.trim() && queryPickerItems.length > 0"
            class="px-4 py-2 border-t border-border shrink-0 text-[11px] text-muted-foreground">
            {{ queryPickerItems.length }} {{ queryPickerItems.length === 1 ? 'activity' : 'activities' }} in {{ queryPickerTree.length }} {{ queryPickerTree.length === 1 ? 'folder' : 'folders' }}
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Share query -->
    <DialogRoot :open="showShare">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-9999 bg-black/45" @click="showShare = false" />
        <DialogContent class="fixed left-1/2 top-1/2 z-9999 -translate-x-1/2 -translate-y-1/2 w-[420px] rounded-xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col focus:outline-none" @click.stop>
          <DialogTitle class="sr-only">Share Query</DialogTitle>

          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
            <div class="flex items-center gap-2">
              <Share2 class="h-4 w-4 text-primary" />
              <span class="text-sm font-bold text-foreground">Share Query</span>
            </div>
            <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground" title="Close" @click="showShare = false">
              <X class="h-4 w-4" />
            </Button>
          </div>

          <div class="px-5 py-4 flex flex-col gap-4">
            <div v-if="shareLoading" class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <span class="inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Generating share link…
            </div>

            <div v-else-if="shareError" class="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
              {{ shareError }}
            </div>

            <template v-else-if="shareUrl">
              <p class="text-xs text-muted-foreground leading-relaxed">
                Anyone with this link can view and copy the SQL. The link expires in <strong class="text-foreground">24 hours</strong> and never exposes your SFMC data — only the query text is shared.
              </p>

              <div class="flex items-center gap-2">
                <div class="flex-1 min-w-0 bg-muted rounded-md px-3 py-2 text-xs font-mono text-foreground truncate border border-border">
                  {{ shareUrl }}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 text-xs gap-1.5 shrink-0 transition-colors"
                  :class="copiedText === shareUrl ? 'border-emerald-400 text-emerald-600' : ''"
                  @click="copyToClipboard(shareUrl)"
                >
                  <Check v-if="copiedText === shareUrl" class="h-3 w-3" />
                  <Copy v-else class="h-3 w-3" />
                  {{ copiedText === shareUrl ? 'Copied!' : 'Copy' }}
                </Button>
              </div>

              <a :href="shareUrl" target="_blank"
                class="flex items-center gap-1.5 text-xs text-primary hover:underline self-start">
                <ExternalLink class="h-3 w-3" />
                Open share page
              </a>
            </template>
          </div>

          <div class="px-5 pb-4 shrink-0">
            <Button class="w-full" @click="showShare = false">Close</Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <div v-if="formatNote" class="px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-b border-border shrink-0">{{ formatNote }}</div>
    <div v-show="activeTab === 'editor'" class="flex-1 flex flex-col min-h-0">
      <div class="overflow-hidden shrink-0" :style="{ height: editorHeightPct + '%' }">
        <QueryEditor ref="editorRef" :modelValue="queryText" :stack="stack" @update:modelValue="onEditorChange" @format="onFormatResult" />
      </div>
      <div class="h-1 bg-border cursor-ns-resize shrink-0" @mousedown="onResizeStart($event)" />
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ValidationPanel v-if="resultsMode === 'validating' || resultsMode === 'validation'" :results="validationResults" :isRunning="resultsMode === 'validating'" />
        <RunStepper v-else-if="showRunStepper" :stepStatuses="stepStatuses" :stepErrors="stepErrors" :stepDetails="stepDetails" :elapsedSeconds="elapsedSeconds" :completedSummary="null" @retry="runQuery" @login="openSfmcLogin" @prompt="answerPrompt" />
        <template v-else-if="resultsMode === 'results'">
          <button class="px-2 py-1 text-[10px] font-semibold border-b flex items-center justify-between" @click="isResultsOpen = !isResultsOpen">
            <span>{{ completedSummary }}</span>
            <ChevronDown class="h-3 w-3" :class="{ 'rotate-180': isResultsOpen }" />
          </button>
          <div v-show="isResultsOpen" class="flex-1 overflow-auto min-h-0">
            <ResultsTable :rows="resultRows" :columns="resultColumns" :filename="panelTitle" :sql="queryText" :totalCount="totalRowCount"
              :can-load-more="!!createdDeKey" :loading-more="isFetchingMore" :load-all-limit="LOAD_ALL_LIMIT"
              @load-more="fetchMoreRows" @load-all="fetchAllRows" />
            <CleanupActions :deKey="createdDeKey" :activityId="createdActivityId" :isDeleting="isDeleting" @delete-de="handleDeleteDE(currentRunId)" @delete-activity="handleDeleteActivity(currentRunId)" />
          </div>
        </template>
        <div v-if="sessionExpired" class="px-2 py-1 text-[10px] text-red-600 flex justify-between"><span>Session expired</span><Button size="sm" class="h-5 text-[9px]" @click="openSfmcLogin"><LogIn class="h-3 w-3" /></Button></div>
        <div v-if="contactBuilderNeeded" class="px-2 py-1 text-[10px] text-amber-700">Open Contact Builder and Automation Studio in SFMC, then press Retry</div>
        <div v-if="resultsMode === 'empty' && !sessionExpired" class="flex-1 flex items-center justify-center text-[10px] text-muted-foreground">Run to see results</div>
      </div>
    </div>

    <div v-show="activeTab === 'history'" class="flex-1 overflow-y-auto p-2 text-[10px]">
      <div v-if="!runs.length" class="text-center text-muted-foreground py-4">No runs yet</div>
      <div v-for="run in runs" :key="run.runId" class="mb-2 p-2 border rounded">
        <div class="font-semibold">{{ formatRunDate(run.runAt) }}</div>
        <button class="text-primary underline" @click="toggleHistoryResults(run)">View results</button>
        <div v-if="historyResults[run.runId]?.open && historyResults[run.runId]?.rows" class="mt-1 max-h-24 overflow-auto">
          <ResultsTable :rows="historyResults[run.runId].rows" :columns="historyResults[run.runId].columns" filename="run" :sql="run.queryText" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-panel { height: 100%; }
</style>

<script setup>
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Download, FileText, Copy, Check, Loader2 } from 'lucide-vue-next'
import { buildResultsMarkdown, MARKDOWN_ROW_LIMIT } from '@/utils/markdownExport.js'
import { useStack } from '@/composables/useStack.js'
import { exportBaseName } from '@/utils/exportName.js'
import Button from '@/components/ui/button/Button.vue'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table/index.js'

const PAGE_SIZE = 50

const props = defineProps({
  rows:     { type: Array,  default: () => [] },
  columns:  { type: Array,  default: () => [] },
  filename: { type: String, default: 'results' },
  sql:      { type: String, default: '' },
  totalCount: { type: Number, default: null },
  // Loading more than the first page of the target DE (Run Query).
  canLoadMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  loadAllLimit: { type: Number, default: 50000 },
  // File names start with this (Run Query: query-<name>; DE rows: de-<name>).
  filePrefix: { type: String, default: 'query' },
})
const emit = defineEmits(['load-more', 'load-all'])

const total = computed(() => props.totalCount ?? props.rows.length)
// Zero rows can still be exported: the SQL, the columns and "0 rows" (feedback #31).
const canExport = computed(() => props.rows.length > 0 || props.columns.length > 0 || !!props.sql.trim())
const moreToLoad = computed(() => props.canLoadMore && total.value > props.rows.length)

const page = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(props.rows.length / PAGE_SIZE)))
const visibleRows = computed(() =>
  props.rows.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE)
)

async function saveBlob(content, type, ext) {
  // The stack is only needed for the file name, so the table works without chrome APIs.
  const { stack } = useStack()
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${await exportBaseName(stack.value, `${props.filePrefix}-${props.filename || 'results'}`)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

function markdown() {
  return buildResultsMarkdown({
    title: props.filename, sql: props.sql, columns: props.columns, rows: props.rows,
    totalCount: props.totalCount ?? props.rows.length,
  })
}

function downloadMarkdown() {
  saveBlob(markdown(), 'text/markdown', 'md')
}

// "Copy for AI": the same Markdown, straight to the clipboard.
const copied = ref(false)
async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(markdown())
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
}

function downloadCSV() {
  const escape = (val) => {
    const s = val == null ? '' : String(val)
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    props.columns.join(','),
    ...props.rows.map(row => props.columns.map(col => escape(row[col])).join(',')),
  ]
  saveBlob(lines.join('\n'), 'text/csv', 'csv')
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden min-h-0">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
      <span class="text-xs font-bold text-foreground">
        <template v-if="total > rows.length">Showing {{ rows.length.toLocaleString() }} of {{ total.toLocaleString() }} rows</template>
        <template v-else>{{ rows.length.toLocaleString() }} rows</template>
      </span>
      <div v-if="moreToLoad" class="flex items-center gap-1.5 ml-3 mr-auto">
        <Button variant="outline" size="sm" class="h-7 text-[11px]" :disabled="loadingMore" @click="emit('load-more')">
          <Loader2 v-if="loadingMore" class="h-3 w-3 mr-1 animate-spin" /> Load next {{ Math.min(2500, total - rows.length).toLocaleString() }}
        </Button>
        <Button variant="outline" size="sm" class="h-7 text-[11px]" :disabled="loadingMore" @click="emit('load-all')"
          :title="total > loadAllLimit ? `Loads up to ${loadAllLimit.toLocaleString()} rows; export the target data extension in SFMC for all of them` : 'Loads every row'">
          Load all{{ total > loadAllLimit ? ` (up to ${loadAllLimit.toLocaleString()})` : '' }}
        </Button>
        <ProgressBar v-if="loadingMore" :value="rows.length" :max="Math.min(total, loadAllLimit)" aria-label="Loading rows" class="w-32" />
      </div>

      <div class="flex items-center gap-2">
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Button variant="ghost" size="icon" class="h-7 w-7" title="Previous page" @click="page--" :disabled="page === 0">
            <ChevronLeft class="h-3.5 w-3.5" />
          </Button>
          <span class="tabular-nums">{{ page + 1 }} / {{ totalPages }}</span>
          <Button variant="ghost" size="icon" class="h-7 w-7" title="Next page" @click="page++" :disabled="page >= totalPages - 1">
            <ChevronRight class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- CSV download -->
        <Button variant="outline" size="sm" :disabled="columns.length === 0" @click="downloadCSV"
          class="h-7 text-xs gap-1.5">
          <Download class="h-3 w-3" />
          CSV
        </Button>
        <Button variant="outline" size="sm" :disabled="!canExport" @click="downloadMarkdown"
          class="h-7 text-xs gap-1.5" :title="`Download the SQL and up to ${MARKDOWN_ROW_LIMIT} rows as Markdown`">
          <FileText class="h-3 w-3" />
          MD
        </Button>
        <Button variant="outline" size="sm" :disabled="!canExport" @click="copyMarkdown"
          class="h-7 text-xs gap-1.5" title="Copy the SQL and results as Markdown, to paste into Claude or ChatGPT">
          <Check v-if="copied" class="h-3 w-3" />
          <Copy v-else class="h-3 w-3" />
          {{ copied ? 'Copied' : 'Copy for AI' }}
        </Button>
      </div>
    </div>

    <!-- Table scroll area -->
    <div class="flex-1 overflow-auto min-h-0">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col"
              class="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground bg-muted border-b-2 border-border border-r border-r-border/60 last:border-r-0 sticky top-0 z-10 whitespace-nowrap">
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in visibleRows" :key="i"
            class="border-b border-border/50 hover:bg-muted/40 transition-colors">
            <td v-for="col in columns" :key="col"
              class="px-3 py-1.5 text-foreground border-r border-border/30 last:border-r-0">
              {{ row[col] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

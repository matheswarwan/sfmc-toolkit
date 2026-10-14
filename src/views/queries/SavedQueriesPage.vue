<script setup>
import { ref, onMounted, computed } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'radix-vue'
import { X, Play, Calendar, Link, Star, Rows3, LayoutGrid } from 'lucide-vue-next'

import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import QueryCard from './components/cards/QueryCard.vue'
import EmailCard from './components/cards/EmailCard.vue'
import FindDE from './components/FindDE.vue'
import AddQueryModal from './components/modals/AddQueryModal.vue'
import QueryPreviewModal from './components/modals/QueryPreviewModal.vue'
import DateSidebar from './components/layout/DateSidebar.vue'
import Button from './components/ui/button/Button.vue'
import './assets/tailwind.css'
import { trackEvent } from './utils/analytics.js'
import { useTheme } from './composables/useTheme.js'

const { loadTheme } = useTheme()

// ── What's New ───────────────────────────────────────────
const CURRENT_VERSION = '1.4.0'
const showWhatsNew = ref(false)

function dismissWhatsNew() {
  showWhatsNew.value = false
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ _seenVersion: CURRENT_VERSION })
  }
}

// ── Tabs ─────────────────────────────────────────────────
const activeTab = ref('queries')

// ── State ────────────────────────────────────────────────
let cardData  = ref([])
let emailData = ref([])
const activeDateFilter  = ref(null)
const activeBuFilters   = ref(new Set())

// ── Email delete mode ─────────────────────────────────────
const emailDeleteMode   = ref(false)
const selectedEmailIds  = ref(new Set())

// ── Email saver toggle ────────────────────────────────────
const emailSaverEnabled  = ref(true)
const emailSaveDebounce  = ref(5) // seconds

function loadEmailSaverPref() {
  if (!chrome?.storage?.local) return
  chrome.storage.local.get(['_emailSaverEnabled', '_emailSaveDebounce'], (prefs) => {
    emailSaverEnabled.value = prefs['_emailSaverEnabled'] !== false
    if (typeof prefs['_emailSaveDebounce'] === 'number') {
      emailSaveDebounce.value = prefs['_emailSaveDebounce']
    }
  })
}

function setEmailSaverEnabled(val) {
  emailSaverEnabled.value = val
  chrome.storage.local.set({ '_emailSaverEnabled': val })
}

function setEmailSaveDebounce(val) {
  const n = Math.max(0, Math.min(60, Number(val) || 0))
  emailSaveDebounce.value = n
  chrome.storage.local.set({ '_emailSaveDebounce': n })
}

// ── Reuse DE & Query Activity toggle ──────────────────────
const reuseQueryDe = ref(false) // off by default — every run gets a fresh DE + Activity

function loadReuseQueryDePref() {
  if (!chrome?.storage?.local) return
  chrome.storage.local.get('_reuseQueryDE', (prefs) => {
    reuseQueryDe.value = prefs['_reuseQueryDE'] === true
  })
}

function setReuseQueryDe(val) {
  reuseQueryDe.value = val
  chrome.storage.local.set({ '_reuseQueryDE': val })
}

const showAddModal = ref(false)
let toastMessage = ref('')
let toastVisible = ref(false)

// ── Quick-view preview modal ──────────────────────────────
const previewCard = ref(null)

function openPreview(id) {
  const card = cardData.value.find(c => c.id === id)
  if (card) previewCard.value = card
}

function openEditor(id) {
  previewCard.value = null
  chrome.storage.local.get(id, (data) => {
    const page = data?.[id]?.source === 'builder'
      ? 'query-builder.html'
      : 'query-detail.html'
    chrome.tabs.create({
      url: chrome.runtime.getURL(page) + '?id=' + id,
    })
  })
}

// ── Delete mode ───────────────────────────────────────────
const deleteMode  = ref(false)
const selectedIds = ref(new Set())

// ── Favourites filter ─────────────────────────────────────
const showFavouritesOnly      = ref(false)

// ── Card size (feedback: "make the thumbnails larger") ────
// 'compact' is the original 300px card; 'large' shows more of the SQL.
const cardSize = ref('compact')
chrome.storage?.local?.get('cardSize', (d) => { if (d?.cardSize === 'large') cardSize.value = 'large' })
function toggleCardSize() {
  cardSize.value = cardSize.value === 'large' ? 'compact' : 'large'
  chrome.storage?.local?.set({ cardSize: cardSize.value })
}
const showEmailFavouritesOnly = ref(false)

async function toggleFavourite(id) {
  const card = cardData.value.find(c => c.id === id)
  if (!card || !chrome?.storage?.local) return
  const newVal = !card.isFavourite
  await new Promise(resolve => {
    chrome.storage.local.get(id, (data) => {
      chrome.storage.local.set({ [id]: { ...data[id], isFavourite: newVal } }, resolve)
    })
  })
  card.isFavourite = newVal
}

async function toggleEmailFavourite(id) {
  const email = emailData.value.find(e => e.id === id)
  if (!email || !chrome?.storage?.local) return
  const newVal = !email.isFavourite
  await new Promise(resolve => {
    chrome.storage.local.get(id, (data) => {
      chrome.storage.local.set({ [id]: { ...data[id], isFavourite: newVal } }, resolve)
    })
  })
  email.isFavourite = newVal
}

// ── Date grouping ─────────────────────────────────────────
function getDateGroup(timestamp) {
  const now  = new Date()
  const d    = new Date(timestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000)

  if (diffDays === 0) return { key: 'today', label: 'Today', order: 0 }
  if (diffDays === 1) return { key: 'yesterday', label: 'Yesterday', order: 1 }

  const dow         = startOfToday.getDay()
  const daysToMon   = dow === 0 ? 6 : dow - 1
  const startOfThisWeek = new Date(startOfToday)
  startOfThisWeek.setDate(startOfToday.getDate() - daysToMon)

  if (startOfDate >= startOfThisWeek) return { key: 'this_week', label: 'This Week', order: 2 }

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7)
  if (startOfDate >= startOfLastWeek) return { key: 'last_week', label: 'Last Week', order: 3 }

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  if (startOfDate >= startOfThisMonth) return { key: 'this_month', label: 'This Month', order: 4 }

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  if (startOfDate >= startOfLastMonth) return { key: 'last_month', label: 'Last Month', order: 5 }

  const yr = d.getFullYear()
  const mo = d.getMonth()
  const key   = `m_${yr}_${String(mo).padStart(2, '0')}`
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthsAgo = (now.getFullYear() - yr) * 12 + (now.getMonth() - mo)
  return { key, label, order: monthsAgo + 4 }
}

const allBuOptions = computed(() => {
  const map = new Map()
  for (const card of cardData.value) {
    const bu = card.businessUnit
    if (bu?.name) {
      const entry = map.get(bu.name) || { name: bu.name, accountId: bu.accountId, count: 0 }
      entry.count++
      map.set(bu.name, entry)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const buFilteredCards = computed(() => {
  if (activeBuFilters.value.size === 0) return cardData.value
  return cardData.value.filter(c => c.businessUnit?.name && activeBuFilters.value.has(c.businessUnit.name))
})

const favouriteFilteredCards = computed(() => {
  if (!showFavouritesOnly.value) return buFilteredCards.value
  return buFilteredCards.value.filter(c => c.isFavourite)
})

const allGroups = computed(() => {
  const map = new Map()
  for (const card of favouriteFilteredCards.value) {
    const g = getDateGroup(card.timeStamp)
    if (!map.has(g.key)) {
      map.set(g.key, { key: g.key, label: g.label, order: g.order, cards: [] })
    }
    map.get(g.key).cards.push(card)
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order)
    .map(group => {
      const buMap = new Map()
      const noBU  = []
      for (const card of group.cards) {
        const buName = card.businessUnit?.name
        if (buName) {
          if (!buMap.has(buName)) buMap.set(buName, [])
          buMap.get(buName).push(card)
        } else {
          noBU.push(card)
        }
      }
      const showBuSubs = buMap.size > 1 || (buMap.size === 1 && noBU.length > 0)
      const buSubGroups = showBuSubs
        ? [...buMap.entries()].map(([name, cards]) => ({ name, cards }))
            .concat(noBU.length ? [{ name: null, cards: noBU }] : [])
        : null
      return { ...group, buSubGroups }
    })
})

const sidebarGroups = computed(() =>
  allGroups.value.map(g => ({ key: g.key, label: g.label, count: g.cards.length }))
)

// ── Email groups (date-grouped, no BU sub-grouping) ───────
const emailGroups = computed(() => {
  const source = showEmailFavouritesOnly.value
    ? emailData.value.filter(e => e.isFavourite)
    : emailData.value
  const map = new Map()
  for (const email of source) {
    const g = getDateGroup(email.timeStamp)
    if (!map.has(g.key)) map.set(g.key, { key: g.key, label: g.label, order: g.order, cards: [] })
    map.get(g.key).cards.push(email)
  }
  return [...map.values()].sort((a, b) => a.order - b.order)
})

function toggleEmailDeleteMode() {
  emailDeleteMode.value  = !emailDeleteMode.value
  selectedEmailIds.value = new Set()
}

function toggleSelectEmail(id) {
  const next = new Set(selectedEmailIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedEmailIds.value = next
}

function toggleSelectAllEmails() {
  const allIds = emailData.value.map(e => e.id)
  if (selectedEmailIds.value.size === allIds.length) {
    selectedEmailIds.value = new Set()
  } else {
    selectedEmailIds.value = new Set(allIds)
  }
}

async function deleteSelectedEmails() {
  if (selectedEmailIds.value.size === 0) return
  if (!chrome?.storage?.local) return
  const ids = [...selectedEmailIds.value]
  await new Promise((resolve) => chrome.storage.local.remove(ids, resolve))
  const count = ids.length
  await loadData()
  selectedEmailIds.value = new Set()
  emailDeleteMode.value  = false
  showToast(`Deleted ${count} ${count === 1 ? 'email' : 'emails'}.`)
}

const displayGroups = computed(() => {
  if (activeDateFilter.value === null) return allGroups.value
  return allGroups.value.filter(g => g.key === activeDateFilter.value)
})

const visibleCards = computed(() =>
  displayGroups.value.flatMap(g => g.cards)
)

const selectedCount = computed(() => selectedIds.value.size)
const totalCount    = computed(() => visibleCards.value.length)

function toggleDeleteMode() {
  deleteMode.value  = !deleteMode.value
  selectedIds.value = new Set()
}

function toggleSelectCard(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (selectedIds.value.size === visibleCards.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(visibleCards.value.map(c => c.id))
  }
}

async function deleteSelected() {
  if (selectedIds.value.size === 0) return
  if (!chrome?.storage?.local) return

  const idsToDelete = [...selectedIds.value]
  await new Promise((resolve) => chrome.storage.local.remove(idsToDelete, resolve))
  const count = idsToDelete.length
  await loadData()
  selectedIds.value = new Set()
  deleteMode.value  = false
  showToast(`Deleted ${count} ${count === 1 ? 'query' : 'queries'}.`)
}

// ── Data loading ─────────────────────────────────────────
function fetchFromStorage() {
  if (!chrome?.storage?.local) return Promise.resolve({})
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) resolve({})
      else resolve(result)
    })
  })
}

async function loadData() {
  const raw = await fetchFromStorage()
  if (!raw || Object.keys(raw).length === 0) {
    cardData.value  = []
    emailData.value = []
    return
  }
  cardData.value = Object.values(raw)
    .filter((v) => v && v.queryText)
    .map((v) => {
      const latestRunText = v.runs?.[0]?.queryText
      return {
        id:           v.id,
        queryText:    v.queryText || latestRunText || '',
        timeStamp:    v.timeStamp,
        url:          v.url,
        name:         v.name,
        isFavourite:  v.isFavourite,
        businessUnit: v.businessUnit || null,
      }
    })
    .sort((a, b) => b.timeStamp - a.timeStamp)

  emailData.value = Object.values(raw)
    .filter((v) => v && v.assetId)
    .map((v) => ({
      id:                   v.id,
      assetId:              v.assetId,
      name:                 v.name,
      subject:              v.subject || '',
      status:               v.status || '',
      assetTypeDisplayName: v.assetTypeDisplayName || '',
      categoryName:         v.categoryName || '',
      timeStamp:            v.timeStamp,
      ownerName:            v.ownerName || '',
      isFavourite:          v.isFavourite || false,
      compileAsset:         v.compileAsset || null,
    }))
    .sort((a, b) => b.timeStamp - a.timeStamp)
}

onMounted(async () => {
  loadTheme()
  loadEmailSaverPref()
  loadReuseQueryDePref()
  trackEvent('popup_open')
  await loadData()
  if (chrome?.storage?.local) {
    chrome.storage.local.get('_seenVersion', (result) => {
      if (result._seenVersion !== CURRENT_VERSION) {
        showWhatsNew.value = true
      }
    })
  }
})

// ── Toast helper ─────────────────────────────────────────
function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  setTimeout(() => { toastVisible.value = false }, 3000)
}

// ── CSV helpers ───────────────────────────────────────────
function csvQuote(value) {
  const str = String(value == null ? '' : value)
  return '"' + str.replace(/"/g, '""') + '"'
}

function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false, i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2 }
      else if (ch === '"') { inQuotes = false; i++ }
      else { field += ch; i++ }
    } else {
      if (ch === '"') { inQuotes = true; i++ }
      else if (ch === ',') { row.push(field); field = ''; i++ }
      else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 2 }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++ }
      else { field += ch; i++ }
    }
  }
  if (row.length > 0 || field) { row.push(field); rows.push(row) }
  return rows
}

// ── Header actions ───────────────────────────────────────
function handleExportCSV() {
  if (!chrome?.storage?.local) return
  chrome.storage.local.get(null, (items) => {
    const headers = ['Time Saved', 'Name', 'Query Text']
    const rows = Object.values(items).map((item) => {
      const time = new Date(item.timeStamp).toLocaleString()
      const name = item.name || ''
      const sql  = item.queryText || ''
      return [time, name, sql].map(csvQuote)
    })
    const csv = [headers.map(csvQuote), ...rows].map((r) => r.join(',')).join('\n')
    downloadCSV(csv)
  })
}

async function downloadCSV(content) {
  const now   = new Date()
  const stamp =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '_' + String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  const fileName = `sfmc_queries_${stamp}.csv`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch { /* user cancelled */ }
  }

  const link = document.createElement('a')
  link.href  = URL.createObjectURL(blob)
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function handleImportCSV(file) {
  if (!chrome?.storage?.local) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    const rows    = parseCSV(e.target.result)
    const dataRows = rows.slice(1).filter((r) => r.length >= 3)
    if (dataRows.length === 0) {
      showToast('No valid queries found in CSV.')
      return
    }
    const now = Date.now()
    const entries = {}
    dataRows.forEach((cols, i) => {
      const rawTime  = (cols[0] || '').trim()
      const name     = (cols[1] || '').trim()
      const sql      = (cols[2] || '').trim()
      if (!sql) return
      const parsed   = rawTime ? new Date(rawTime).getTime() : NaN
      const timeStamp = !isNaN(parsed) ? parsed : now + i
      const key = `sql_${timeStamp}_${i}`
      entries[key] = {
        id: key, name: name || 'Imported Query', queryText: sql,
        timeStamp, isFavourite: false, url: 'https://localhost/',
      }
    })
    const count = Object.keys(entries).length
    if (count === 0) {
      showToast('No valid queries found in CSV.')
      return
    }
    await new Promise((resolve) => chrome.storage.local.set(entries, resolve))
    await loadData()
    showToast(`Imported ${count} ${count === 1 ? 'query' : 'queries'}.`)
  }
  reader.readAsText(file)
}

function handleRunQuery() {
  chrome.tabs.create({ url: chrome.runtime.getURL('query-detail.html') })
}

function handleOpenQueryBuilder() {
  chrome.tabs.create({ url: chrome.runtime.getURL('query-builder.html') })
}

async function handleSave(result) {
  showAddModal.value = false
  await loadData()
  showToast(result === false ? 'Could not save - please try again.' : 'Query saved!')
}

function handleValidationError() {
  showAddModal.value = false
  showToast('Please enter both a name and SQL before saving.')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background font-sans">

    <!-- Sticky header -->
    <AppHeader
      :active-tab="activeTab"
      :delete-mode="deleteMode"
      :selected-count="selectedCount"
      :total-count="totalCount"
      :email-delete-mode="emailDeleteMode"
      :selected-email-count="selectedEmailIds.size"
      :total-email-count="emailData.length"
      :email-saver-enabled="emailSaverEnabled"
      :email-save-debounce="emailSaveDebounce"
      :reuse-query-de="reuseQueryDe"
      @add-query="showAddModal = true"
      @export-csv="handleExportCSV"
      @import-csv="handleImportCSV"
      @toggle-delete-mode="toggleDeleteMode"
      @select-all="toggleSelectAll"
      @delete-selected="deleteSelected"
      @toggle-email-delete-mode="toggleEmailDeleteMode"
      @select-all-emails="toggleSelectAllEmails"
      @delete-selected-emails="deleteSelectedEmails"
      @run-query="handleRunQuery"
      @open-query-builder="handleOpenQueryBuilder"
      @toggle-email-saver="setEmailSaverEnabled(!emailSaverEnabled)"
      @toggle-reuse-query-de="setReuseQueryDe(!reuseQueryDe)"
      @update-email-save-debounce="setEmailSaveDebounce"
    />

    <!-- Tab bar -->
    <div class="flex border-b border-border bg-card flex-shrink-0">
      <button
        class="flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2"
        :class="activeTab === 'queries'
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'queries'"
      >
        Queries
        <span class="text-[10px] bg-muted rounded-full px-1.5 py-px tabular-nums">{{ cardData.length }}</span>
      </button>
      <button
        class="flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2"
        :class="activeTab === 'emails'
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="activeTab = 'emails'"
      >
        Emails
        <span class="text-[10px] bg-muted rounded-full px-1.5 py-px tabular-nums">{{ emailData.length }}</span>
      </button>
      <!-- Find DE tab hidden pending API optimization -->
    </div>

    <!-- Queries tab -->
    <main v-show="activeTab === 'queries'" class="flex-1 flex items-start">

      <!-- Date sidebar (only when there's data) -->
      <DateSidebar
        v-if="cardData.length > 0"
        :groups="sidebarGroups"
        :active-key="activeDateFilter"
        :total-count="cardData.length"
        :bu-options="allBuOptions"
        :active-bu-filters="activeBuFilters"
        @select="activeDateFilter = $event"
        @bu-filter-change="activeBuFilters = $event"
      />

      <!-- Content area -->
      <div class="flex-1 p-6 min-w-0">
        <template v-if="cardData.length > 0">

          <!-- Favourites filter toggle -->
          <div class="flex items-center gap-2 mb-4">
            <button
              class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
              :class="showFavouritesOnly
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'
                : 'border-border text-muted-foreground hover:border-amber-300 hover:text-amber-600'"
              @click="showFavouritesOnly = !showFavouritesOnly"
            >
              <Star class="h-3 w-3" :fill="showFavouritesOnly ? 'currentColor' : 'none'" />
              Favourites
            </button>
            <button
              class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
              :title="cardSize === 'large' ? 'Show smaller cards' : 'Show larger cards with more of the SQL'"
              @click="toggleCardSize"
            >
              <LayoutGrid v-if="cardSize === 'large'" class="h-3 w-3" />
              <Rows3 v-else class="h-3 w-3" />
              {{ cardSize === 'large' ? 'Compact cards' : 'Large cards' }}
            </button>
          </div>

          <div v-if="displayGroups.length === 0" class="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Star class="h-8 w-8 text-muted-foreground/30" />
            <p class="text-sm font-semibold text-foreground">No favourited queries</p>
            <p class="text-xs text-muted-foreground">Click the star on any query card to mark it as a favourite.</p>
            <button class="text-xs text-primary underline" @click="showFavouritesOnly = false">Show all queries</button>
          </div>

          <div v-for="group in displayGroups" :key="group.key" class="mb-7">
            <!-- Group header -->
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {{ group.label }}
              </span>
              <span class="text-[11px] text-muted-foreground font-medium bg-muted rounded-full px-2 py-px flex-shrink-0 tabular-nums">
                {{ group.cards.length }}
              </span>
              <div class="flex-1 h-px bg-border" />
            </div>

            <!-- Flat grid (single BU) -->
            <div v-if="!group.buSubGroups" class="flex flex-wrap gap-4 items-start">
              <QueryCard
                v-for="card in group.cards"
                :key="card.id"
                v-bind="card"
                :delete-mode="deleteMode"
                :size="cardSize"
                :is-selected="selectedIds.has(card.id)"
                @toggle-select="toggleSelectCard"
                @toggle-favourite="toggleFavourite"
                @open-preview="openPreview"
              />
            </div>

            <!-- BU sub-grouped -->
            <template v-else>
              <div v-for="buGroup in group.buSubGroups" :key="buGroup.name || '__no_bu__'" class="mb-4 last:mb-0">
                <div class="flex items-center gap-1.5 mb-2.5">
                  <span class="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-px whitespace-nowrap">
                    {{ buGroup.name || 'No Business Unit' }}
                  </span>
                  <span class="text-[10px] text-muted-foreground font-medium tabular-nums">{{ buGroup.cards.length }}</span>
                  <div class="flex-1 h-px bg-indigo-100" />
                </div>
                <div class="flex flex-wrap gap-4 items-start">
                  <QueryCard
                    v-for="card in buGroup.cards"
                    :key="card.id"
                    v-bind="card"
                    :delete-mode="deleteMode"
                    :size="cardSize"
                    :is-selected="selectedIds.has(card.id)"
                    @toggle-select="toggleSelectCard"
                    @toggle-favourite="toggleFavourite"
                    @open-preview="openPreview"
                  />
                </div>
              </div>
            </template>
          </div>

        </template>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            class="text-muted-foreground/40">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <p class="text-lg font-bold text-foreground">No queries saved yet</p>
          <p class="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Run a query in SFMC Query Studio and it will appear here automatically.
          </p>
          <Button class="mt-2" @click="showAddModal = true">Add one manually</Button>
        </div>
      </div>
    </main>

    <!-- Emails tab -->
    <main v-show="activeTab === 'emails'" class="flex-1 flex flex-col">

      <!-- Content area -->
      <div class="flex-1 p-6 min-w-0 overflow-y-auto">
        <template v-if="emailData.length > 0">

          <!-- Favourites filter toggle -->
          <div class="flex items-center gap-2 mb-4">
            <button
              class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
              :class="showEmailFavouritesOnly
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'
                : 'border-border text-muted-foreground hover:border-amber-300 hover:text-amber-600'"
              @click="showEmailFavouritesOnly = !showEmailFavouritesOnly"
            >
              <Star class="h-3 w-3" :fill="showEmailFavouritesOnly ? 'currentColor' : 'none'" />
              Favourites
            </button>
          </div>

          <div v-if="emailGroups.length === 0" class="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Star class="h-8 w-8 text-muted-foreground/30" />
            <p class="text-sm font-semibold text-foreground">No favourited emails</p>
            <p class="text-xs text-muted-foreground">Click the star on any email card to mark it as a favourite.</p>
            <button class="text-xs text-primary underline" @click="showEmailFavouritesOnly = false">Show all emails</button>
          </div>

          <div v-for="group in emailGroups" :key="group.key" class="mb-7">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {{ group.label }}
              </span>
              <span class="text-[11px] text-muted-foreground font-medium bg-muted rounded-full px-2 py-px flex-shrink-0 tabular-nums">
                {{ group.cards.length }}
              </span>
              <div class="flex-1 h-px bg-border" />
            </div>
            <div class="flex flex-wrap gap-4 items-start">
              <EmailCard
                v-for="email in group.cards"
                :key="email.id"
                v-bind="email"
                :delete-mode="emailDeleteMode"
                :is-selected="selectedEmailIds.has(email.id)"
                @toggle-select="toggleSelectEmail"
                @toggle-favourite="toggleEmailFavourite"
              />
            </div>
          </div>

        </template>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            class="text-muted-foreground/40">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <p class="text-lg font-bold text-foreground">No emails saved yet</p>
          <p class="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Save an email in Content Builder and it will appear here automatically.
          </p>
        </div>
      </div>

    </main>

    <!-- Find DE tab hidden pending API optimization -->

    <!-- Modals -->
    <AddQueryModal
      v-if="showAddModal"
      @save="handleSave"
      @validation-error="handleValidationError"
      @close="showAddModal = false"
    />

    <!-- Quick-view query preview -->
    <QueryPreviewModal
      v-if="previewCard"
      :card="previewCard"
      @open-editor="openEditor"
      @close="previewCard = null"
    />

    <!-- What's New modal -->
    <DialogRoot :open="showWhatsNew">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[99998] bg-black/50" @click="dismissWhatsNew" />
        <DialogContent
          class="fixed left-1/2 top-1/2 z-[99999] -translate-x-1/2 -translate-y-1/2 w-[340px] rounded-2xl bg-card shadow-2xl border border-border overflow-hidden focus:outline-none"
          @click.stop
        >
          <DialogTitle class="sr-only">What's new in v{{ CURRENT_VERSION }}</DialogTitle>

          <!-- Modal header -->
          <div class="flex items-center justify-between px-5 pt-5 pb-3">
            <span class="text-[11px] font-bold text-primary bg-primary/10 rounded-full px-3 py-1 tracking-wide uppercase">
              v{{ CURRENT_VERSION }}
            </span>
            <Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground" title="Close" @click="dismissWhatsNew">
              <X class="h-4 w-4" />
            </Button>
          </div>

          <h2 class="px-5 text-lg font-bold text-foreground">What's new</h2>

          <ul class="px-5 mt-4 mb-5 flex flex-col gap-3.5 list-none">
            <li>
              <strong class="block text-[13px] font-semibold text-foreground mb-0.5">Insert all fields</strong>
              <p class="text-xs text-muted-foreground leading-relaxed">The new list button in the Query Workspace toolbar writes the full column list of a DE or data view, replacing * or inserting at the cursor.</p>
            </li>
            <li>
              <strong class="block text-[13px] font-semibold text-foreground mb-0.5">Turn off a check</strong>
              <p class="text-xs text-muted-foreground leading-relaxed">Use Turn off on any SQL check you don't want. Turn it back on from Settings in the Query Workspace. Unknown tables are now flagged too.</p>
            </li>
            <li>
              <strong class="block text-[13px] font-semibold text-foreground mb-0.5">Business unit badges</strong>
              <p class="text-xs text-muted-foreground leading-relaxed">Saved queries record the business unit they came from, shown on the card and in the filter.</p>
            </li>
            <li>
              <strong class="block text-[13px] font-semibold text-foreground mb-0.5">Fewer failed runs</strong>
              <p class="text-xs text-muted-foreground leading-relaxed">The run asks before opening Contact Builder, retries when SFMC can't see the new DE yet, and text columns default to 4000 characters.</p>
            </li>
          </ul>

          <div class="px-5 pb-5">
            <Button class="w-full" @click="dismissWhatsNew">Got it</Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toastVisible"
        class="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl z-[99999] whitespace-nowrap">
        {{ toastMessage }}
      </div>
    </Transition>

    <AppFooter />
  </div>
</template>

<style scoped>
/* Toast transition */
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
</style>

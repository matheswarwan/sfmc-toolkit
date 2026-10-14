<script setup>
import { shallowRef, onBeforeUnmount } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { sfmcSqlExtensions, formatCommand, relintOnCatalogChange } from '@/editor/sqlExtensions.js'
import { createSchemaCatalog } from '@/utils/schemaCatalog.js'
import { planInsertAllFields } from '@/utils/insertFields.js'
import { referencedTables } from '@/utils/sqlContext.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // SFMC stack (s7, s10, ...). Without it, autocomplete only knows the data views.
  stack:      { type: String, default: null },
})

const emit = defineEmits(['update:modelValue', 'format'])

const catalog = createSchemaCatalog(() => props.stack)
const extensions = [
  ...sfmcSqlExtensions(catalog, { onFormat: (r) => emit('format', r) }),
  oneDark,
]

const view = shallowRef(null)
let unsubscribe = null

function onReady({ view: v }) {
  view.value = v
  unsubscribe = relintOnCatalogChange(v, catalog)
}

onBeforeUnmount(() => unsubscribe?.())

/** Formats the editor's SQL. Returns { ok, sql, error? }. */
function format() {
  if (!view.value) return { ok: false, error: 'Editor not ready' }
  const r = formatCommand(view.value)
  emit('format', r)
  return r
}

/**
 * Inserts every field of a DE or data view (see insertFields.js for where it goes).
 * Returns { ok, count?, mode?, error? }.
 */
async function insertAllFields(tableName) {
  const v = view.value
  if (!v) return { ok: false, error: 'Editor not ready' }
  const fields = await catalog.fieldsFor(tableName)
  if (!fields?.length) return { ok: false, error: `No fields found for ${tableName}.` }
  const sql = v.state.doc.toString()
  const plan = planInsertAllFields(sql, v.state.selection.main.head, tableName, fields)
  if (!plan) return { ok: false, error: `No fields found for ${tableName}.` }
  v.dispatch({
    changes: { from: plan.from, to: plan.to, insert: plan.insert },
    selection: { anchor: plan.from + plan.insert.length },
  })
  v.focus()
  return { ok: true, count: fields.length, mode: plan.mode }
}

/** Tables named in FROM/JOIN of the current SQL. */
function tablesInQuery() {
  const seen = new Set()
  return referencedTables(view.value?.state.doc.toString() || props.modelValue || '')
    .map(r => r.name)
    .filter(n => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
}

/** Data views and DEs whose name contains `prefix` (DE search from 2 characters). */
function searchTables(prefix) {
  return catalog.searchTables(prefix)
}

defineExpose({ format, insertAllFields, tablesInQuery, searchTables })
</script>

<template>
  <Codemirror
    :modelValue="modelValue"
    :extensions="extensions"
    :style="{ height: '100%', fontSize: '13px', fontFamily: 'JetBrains Mono, Fira Code, Courier New, monospace' }"
    @ready="onReady"
    @change="(val) => emit('update:modelValue', val)"
  />
</template>

<script setup>
import { useRouter } from 'vue-router'
import { showToast } from '@/composables/useToast.js'
import { ref, watch, computed } from 'vue'
import QueryEditor from '../detail/QueryEditor.vue'
import Button from '../ui/button/Button.vue'
import { buildSqlFromSelections, buildSqlFromGraph } from '../../utils/sqlBuilder.js'
import { saveBuilderRecord } from '../../utils/builderStorage.js'
import { Copy, ExternalLink, Save } from 'lucide-vue-next'

const router = useRouter()
const props = defineProps({
  sql: { type: String, default: '' },
  selectedDEs: { type: Array, default: () => [] },
  joins: { type: Array, default: () => [] },
  where: { type: Object, default: () => ({ combinator: 'AND', conditions: [] }) },
  queryOptions: { type: Object, default: () => ({}) },
  graphNodes: { type: Array, default: () => [] },
  graphEdges: { type: Array, default: () => [] },
  visualMode: { type: Boolean, default: false },
  recordId: { type: String, default: null },
})

const emit = defineEmits(['update:sql', 'saved'])

const localSql = ref(props.sql)
const copied = ref(false)

watch(() => [props.selectedDEs, props.joins, props.where, props.queryOptions, props.visualMode, props.graphNodes, props.graphEdges], () => {
  if (props.visualMode && props.graphNodes.length) {
    localSql.value = buildSqlFromGraph(props.graphNodes, props.graphEdges, props.where, props.queryOptions)
  } else {
    localSql.value = buildSqlFromSelections(props.selectedDEs, props.joins, props.where, props.queryOptions)
  }
  emit('update:sql', localSql.value)
}, { deep: true, immediate: true })

function onEdit(v) {
  localSql.value = v
  emit('update:sql', v)
}

async function copySql() {
  await navigator.clipboard.writeText(localSql.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

async function saveToQuerySaver() {
  const id = await saveBuilderRecord({
    id: props.recordId,
    sql: localSql.value,
    state: {
      selectedDEs: props.selectedDEs,
      joins: props.joins,
      where: props.where,
      queryOptions: props.queryOptions,
      visualMode: props.visualMode,
      graphNodes: props.graphNodes,
      graphEdges: props.graphEdges,
    },
  })
  const wasUpdate = !!props.recordId
  emit('saved', id)
  showToast(wasUpdate ? 'Query updated in Saved queries.' : 'Saved to Saved queries.')
}

function openInWorkspace() {
  router.push({ path: '/queries/workspace', query: { sql: localSql.value } })
}
</script>

<template>
  <div class="sql-output flex flex-col h-full border-l border-border">
    <div class="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
      <span class="text-xs font-bold text-muted-foreground uppercase">Generated SQL</span>
      <div class="flex gap-1">
        <Button variant="outline" size="sm" class="h-7 text-[10px]" @click="copySql">
          <Copy class="h-3 w-3 mr-1" />{{ copied ? 'Copied!' : 'Copy' }}
        </Button>
        <Button variant="outline" size="sm" class="h-7 text-[10px]" @click="saveToQuerySaver">
          <Save class="h-3 w-3 mr-1" /> Save
        </Button>
        <Button size="sm" class="h-7 text-[10px] bg-[#0176D3] text-white" :disabled="!localSql.trim()" @click="openInWorkspace">
          <ExternalLink class="h-3 w-3 mr-1" /> Workspace
        </Button>
      </div>
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      <QueryEditor :modelValue="localSql" @update:modelValue="onEdit" />
    </div>
  </div>
</template>

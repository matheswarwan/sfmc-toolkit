<script setup>
import { computed } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import Button from '../ui/button/Button.vue'

const props = defineProps({
  // [{ alias, field, label }]
  fieldOptions: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({ combinator: 'AND', conditions: [] }) },
})
const emit = defineEmits(['update:modelValue'])

const WHERE_OPERATORS = [
  '=', '<>', '>', '<', '>=', '<=',
  'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL',
]

const where = computed(() => ({
  combinator: props.modelValue?.combinator || 'AND',
  conditions: Array.isArray(props.modelValue?.conditions) ? props.modelValue.conditions : [],
}))

function emitWhere(next) {
  emit('update:modelValue', {
    combinator: next.combinator || 'AND',
    conditions: next.conditions.map((c) => ({ ...c })),
  })
}

function addCondition() {
  const first = props.fieldOptions[0]
  const conditions = [
    ...where.value.conditions,
    {
      alias: first?.alias || '',
      field: first?.field || '',
      operator: '=',
      value: '',
      raw: false,
    },
  ]
  emitWhere({ ...where.value, conditions })
}
function removeCondition(index) {
  const conditions = where.value.conditions.filter((_, i) => i !== index)
  emitWhere({ ...where.value, conditions })
}
function updateField(index, encoded) {
  const [alias, field] = encoded.split('::')
  const conditions = where.value.conditions.map((c, i) =>
    i === index ? { ...c, alias, field } : c)
  emitWhere({ ...where.value, conditions })
}
function updateCondition(index, key, value) {
  const conditions = where.value.conditions.map((c, i) =>
    i === index ? { ...c, [key]: value } : c)
  emitWhere({ ...where.value, conditions })
}
function updateCombinator(value) {
  emitWhere({ ...where.value, combinator: value })
}
function needsValue(op) {
  return op !== 'IS NULL' && op !== 'IS NOT NULL'
}
function isSubqueryOp(op) {
  return op === 'IN' || op === 'NOT IN'
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="where.conditions.length > 1" class="flex items-center gap-1">
      <span class="text-[9px] text-muted-foreground">Match:</span>
      <select
        class="text-[10px] border rounded px-1 py-0.5 bg-background"
        :value="where.combinator"
        @change="updateCombinator($event.target.value)"
      >
        <option value="AND">All (AND)</option>
        <option value="OR">Any (OR)</option>
      </select>
    </div>

    <div
      v-for="(cond, index) in where.conditions"
      :key="index"
      class="flex items-center gap-1"
    >
      <select
        class="flex-1 min-w-0 text-[10px] font-mono border rounded px-1 py-0.5 bg-background"
        :value="`${cond.alias}::${cond.field}`"
        @change="updateField(index, $event.target.value)"
      >
        <option
          v-for="opt in fieldOptions"
          :key="opt.label"
          :value="`${opt.alias}::${opt.field}`"
        >{{ opt.label }}</option>
      </select>
      <select
        class="text-[10px] border rounded px-0.5 py-0.5 bg-background"
        :value="cond.operator"
        @change="updateCondition(index, 'operator', $event.target.value)"
      >
        <option v-for="op in WHERE_OPERATORS" :key="op">{{ op }}</option>
      </select>
      <input
        v-if="needsValue(cond.operator)"
        class="flex-1 min-w-0 text-[10px] font-mono border rounded px-1 py-0.5 bg-background"
        :value="cond.value"
        :placeholder="isSubqueryOp(cond.operator) ? '(SELECT …) or a, b, c' : 'value'"
        @input="updateCondition(index, 'value', $event.target.value)"
      />
      <button
        v-if="needsValue(cond.operator)"
        class="text-[9px] px-1 py-0.5 rounded border flex-shrink-0"
        :class="cond.raw ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'"
        title="Pass value through as raw SQL (functions, columns, subqueries)"
        @click="updateCondition(index, 'raw', !cond.raw)"
      >fx</button>
      <Button variant="ghost" size="icon" class="h-5 w-5 flex-shrink-0" title="Remove condition" @click="removeCondition(index)">
        <X class="h-2.5 w-2.5" />
      </Button>
    </div>

    <button
      class="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
      :disabled="!fieldOptions.length"
      @click="addCondition"
    >
      <Plus class="h-2.5 w-2.5" /> Add condition
    </button>
    <div v-if="!fieldOptions.length" class="text-[9px] text-muted-foreground">
      Fields load once DEs are added
    </div>
    <p class="text-[9px] text-muted-foreground leading-snug">
      Tip: for <code>IN (SELECT …)</code> pick <b>IN</b>, type the subquery, and toggle
      <b>fx</b> to pass it through as raw SQL.
    </p>
  </div>
</template>

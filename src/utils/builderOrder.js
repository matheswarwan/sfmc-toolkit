// Reordering the Query Builder's data extensions (feedback #90). The first one is
// the FROM table; each next one joins the one before it. Aliases are fixed first so
// WHERE conditions, output fields and options keep pointing at the same tables.
import { aliasOf } from './sqlBuilder.js'

const withAliases = (list) => list.map((d, i) => ({ ...d, alias: aliasOf(d, i) }))

/** Moves the item at `from` so it ends up at index `to`. */
export function moveDE(list, from, to) {
  const next = withAliases(list)
  if (from === to || from < 0 || from >= next.length || to < 0 || to >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Swaps the items at `a` and `b`. */
export function swapDEs(list, a, b) {
  const next = withAliases(list)
  if (a === b || !next[a] || !next[b]) return next
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

const FLIP = { '>': '<', '<': '>', '>=': '<=', '<=': '>=' }

/**
 * One join per adjacent pair of `list`: the existing join for that pair, or the one
 * for the reverse pair turned around (sides and operators flipped), else a new
 * empty LEFT JOIN.
 */
export function joinsForOrder(list, joins = []) {
  const out = []
  for (let i = 0; i < list.length - 1; i++) {
    const left = list[i].id
    const right = list[i + 1].id
    const same = joins.find((j) => j.leftDeId === left && j.rightDeId === right)
    if (same) { out.push(same); continue }
    const rev = joins.find((j) => j.leftDeId === right && j.rightDeId === left)
    if (rev) {
      out.push({
        ...rev,
        leftDeId: left,
        rightDeId: right,
        conditions: (rev.conditions || []).map((c) => ({ ...c, leftField: c.rightField, rightField: c.leftField, operator: FLIP[c.operator] || c.operator })),
      })
      continue
    }
    out.push({ leftDeId: left, rightDeId: right, joinType: 'LEFT JOIN', combinator: 'AND', conditions: [] })
  }
  return out
}

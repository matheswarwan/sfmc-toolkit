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

const flipCondition = (c) => ({ ...c, leftField: c.rightField, rightField: c.leftField, operator: FLIP[c.operator] || c.operator })

/**
 * One join for every table after the first: the join that brings it in from any
 * earlier table, or a join with an earlier table that ran the other way, turned
 * around (sides and operators flipped), else a new empty LEFT JOIN to the table
 * before it. So joins form a tree (the visual builder can join C to A, not only
 * to B).
 */
export function joinsForOrder(list, joins = []) {
  const out = []
  const used = new Set()
  for (let i = 1; i < list.length; i++) {
    const right = list[i].id
    const earlier = new Set(list.slice(0, i).map((d) => d.id))
    const same = joins.find((j) => !used.has(j) && j.rightDeId === right && earlier.has(j.leftDeId))
    if (same) { used.add(same); out.push(same); continue }
    const rev = joins.find((j) => !used.has(j) && j.leftDeId === right && earlier.has(j.rightDeId))
    if (rev) {
      used.add(rev)
      out.push({ ...rev, leftDeId: rev.rightDeId, rightDeId: right, conditions: (rev.conditions || []).map(flipCondition) })
      continue
    }
    out.push({ leftDeId: list[i - 1].id, rightDeId: right, joinType: 'LEFT JOIN', combinator: 'AND', conditions: [] })
  }
  return out
}

/**
 * Puts `rootId` first (the FROM table), then the others breadth first along the
 * joins, so every table comes after the table it joins to. Tables with no joined
 * path keep their relative order at the end.
 */
export function orderFromRoot(list, joins = [], rootId) {
  const byId = new Map(withAliases(list).map((d) => [d.id, d]))
  if (!byId.has(rootId)) return withAliases(list)
  const seen = new Set([rootId])
  const queue = [rootId]
  const out = []
  while (queue.length) {
    const id = queue.shift()
    out.push(byId.get(id))
    for (const d of list) {
      if (seen.has(d.id)) continue
      const linked = joins.some((j) => (j.leftDeId === id && j.rightDeId === d.id) || (j.rightDeId === id && j.leftDeId === d.id))
      if (linked) { seen.add(d.id); queue.push(d.id) }
    }
  }
  for (const d of list) if (!seen.has(d.id)) out.push(byId.get(d.id))
  return out
}

/**
 * Adds a join condition between a field of one table and a field of another (drawn
 * on the canvas). The later table is the joined side. Its join gets the condition
 * when it already joins the other table, or takes the other table when it has no
 * condition yet; otherwise the condition names the other table itself (leftDeId),
 * which SQL allows in ON.
 */
export function addJoinCondition(list, joins, a, b) {
  const ia = list.findIndex((d) => d.id === a.deId)
  const ib = list.findIndex((d) => d.id === b.deId)
  if (ia < 0 || ib < 0 || ia === ib) return joins
  const [left, right] = ia < ib ? [a, b] : [b, a]
  const next = joinsForOrder(list, joins).map((j) => ({ ...j, conditions: [...(j.conditions || [])] }))
  const join = next.find((j) => j.rightDeId === right.deId)
  if (!join) return next
  const cond = { leftField: left.field, operator: '=', rightField: right.field, conn: 'AND' }
  const complete = join.conditions.filter((c) => c.leftField && c.rightField)
  if (join.leftDeId === left.deId) {
    if (complete.some((c) => !c.leftDeId && c.leftField === left.field && c.rightField === right.field)) return next
    join.conditions = [...complete, cond]
  } else if (!complete.length && !join.rawOn) {
    join.leftDeId = left.deId
    join.conditions = [cond]
  } else {
    join.conditions = [...complete, { ...cond, leftDeId: left.deId }]
  }
  return next
}

/**
 * Turns a saved visual-mode graph (builder records before the shared model) into
 * the list model: tables in join order, one join per table, positions by id.
 */
export function graphToModel(selectedDEs = [], graphNodes = [], graphEdges = []) {
  const byId = new Map(selectedDEs.map((d) => [d.id, d]))
  for (const n of graphNodes) if (n?.id && !byId.has(n.id) && n.data) byId.set(n.id, { ...n.data, id: n.id })
  const joins = graphEdges.map((e) => ({
    leftDeId: e.source,
    rightDeId: e.target,
    joinType: e.data?.joinType || 'INNER JOIN',
    combinator: e.data?.combinator || 'AND',
    conditions: (e.data?.conditions || []).map((c) => ({ ...c })),
    onClause: e.data?.onClause || '',
    rawOn: !!e.data?.rawOn,
  }))
  const first = graphNodes[0]?.id || selectedDEs[0]?.id
  const list = orderFromRoot([...byId.values()], joins, first)
  const layout = {}
  for (const n of graphNodes) if (n?.id && Number.isFinite(n.x) && Number.isFinite(n.y)) layout[n.id] = { x: n.x, y: n.y }
  return { selectedDEs: list, joins: joinsForOrder(list, joins), layout }
}

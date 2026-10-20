// Watched automations (feedback #50): what to watch, how a change becomes a notice.
// Shared by the service worker (background/watches.js checks) and the pages (Watch
// button, notices menu). Pure apart from the storage keys.

export const WATCHES_KEY = 'toolkit_watches' // { 'stack:id': { stack, id, name, on, last, addedAt } }
export const NOTICES_KEY = 'toolkit_watch_notices' // [{ id, at, stack, automationId, name, kind, text, read }]
export const NOTIFY_KEY = 'toolkit_watch_desktop' // true: also show desktop notifications (optional permission)
export const MAX_NOTICES = 50
export const DEFAULT_ON = { paused: true, activated: true, runs: false, fails: true }

// SFMC REST automation status codes.
const STATUS_NAMES = { '-1': 'Error', 0: 'Build error', 1: 'Building', 2: 'Ready', 3: 'Running', 4: 'Paused', 5: 'Stopped', 6: 'Scheduled', 7: 'Awaiting trigger', 8: 'Inactive trigger' }
export function automationStatusName(v) {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (Number.isInteger(n) && String(n) === String(v).trim() && STATUS_NAMES[n] != null) return STATUS_NAMES[n]
  return String(v)
}

export const watchKey = (stack, id) => `${stack}:${id}`
const isPausedLike = (s) => /^(paused|stopped)$/i.test(s)
const isActiveLike = (s) => /^(scheduled|awaiting trigger|running)$/i.test(s)
export const isFailure = (s) => /error|fail/i.test(String(s || ''))
const time = (v) => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t }

/**
 * Notices for the change from `prev` to `cur` ({ status, lastRunTime, lastRunStatus }),
 * for the kinds switched on in `on`. No notices without a previous snapshot.
 */
export function diffAutomation(prev, cur, on = DEFAULT_ON) {
  if (!prev || !cur) return []
  const out = []
  const was = automationStatusName(prev.status)
  const now = automationStatusName(cur.status)
  if (now && was && now !== was) {
    if (isPausedLike(now) && on.paused) out.push({ kind: 'paused', text: `is now ${now} (was ${was})` })
    else if (isActiveLike(now) && !isActiveLike(was) && on.activated) out.push({ kind: 'activated', text: `is now ${now} (was ${was})` })
  }
  if (time(cur.lastRunTime) > time(prev.lastRunTime)) {
    const failed = isFailure(cur.lastRunStatus)
    if (failed && on.fails) out.push({ kind: 'fails', text: `run failed${cur.lastRunStatus ? ` (${cur.lastRunStatus})` : ''}` })
    else if (on.runs) out.push({ kind: 'runs', text: `ran${cur.lastRunStatus ? `: ${cur.lastRunStatus}` : ''}` })
  }
  return out
}

/** Adds notices (newest first), keeping at most MAX_NOTICES. */
export function addNotices(list, watch, changes, now = Date.now()) {
  const added = changes.map((c, i) => ({
    id: `${now.toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`,
    at: now, stack: watch.stack, automationId: watch.id, name: watch.name, kind: c.kind, text: c.text, read: false,
  }))
  return [...added, ...(Array.isArray(list) ? list : [])].slice(0, MAX_NOTICES)
}

export const unreadCount = (list) => (Array.isArray(list) ? list.filter((n) => !n.read).length : 0)

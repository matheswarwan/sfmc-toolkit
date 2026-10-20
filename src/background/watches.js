// Checks watched automations (feedback #50) and turns changes into notices: when
// the app asks (WATCH_CHECK, on opening) and when an SFMC page loads (at most every
// 15 minutes per stack). Unread notices show as a count on the toolbar icon; with
// the optional notifications permission granted and switched on, also as desktop
// notifications.
import { sfmcFetch } from './fetchProxy.js'
import { storageGet } from './chromeAsync.js'
import {
  WATCHES_KEY, NOTICES_KEY, NOTIFY_KEY, diffAutomation, addNotices, unreadCount, automationStatusName,
} from '../utils/watches.js'

const AS = (stack) => `https://mc.${stack}.marketingcloudapps.com/AutomationStudioFuel3/fuelapi`
const CHECKED_KEY = 'toolkit_watch_checked' // { stack: time }
const PAGE_INTERVAL = 15 * 60 * 1000
const running = new Set()

async function snapshot(stack, w) {
  const d = await sfmcFetch({ url: `${AS(stack)}/automation/v1/automations/${encodeURIComponent(w.id)}` })
  const snap = { status: d?.status ?? null, lastRunTime: d?.lastRunTime ?? null, lastRunStatus: d?.lastRunStatus ?? null, name: d?.name || w.name }
  // A new run without a status on the definition: read it from the run log.
  if (snap.lastRunTime && snap.lastRunTime !== w.last?.lastRunTime && !snap.lastRunStatus) {
    try {
      const day = (t) => new Date(t).toISOString().slice(0, 10)
      const runs = await sfmcFetch({ url: `${AS(stack)}/legacy/v1/beta/automations/automation/instance/?definition_id=${encodeURIComponent(w.id)}&$top=1`
        + `&begin_date=${day(Date.now() - 7 * 86400000)}&end_date=${day(Date.now())}&order_by=${encodeURIComponent('StartTime desc')}&to_server_time=1` })
      const r = (runs?.entry || runs?.items || [])[0]
      snap.lastRunStatus = r?.status ?? r?.statusName ?? r?.StatusName ?? null
    } catch { /* keep it without a status */ }
  }
  return snap
}

export async function updateBadge(list) {
  const notices = list ?? (await storageGet('local', [NOTICES_KEY]))[NOTICES_KEY]
  const n = unreadCount(notices)
  try {
    await chrome.action?.setBadgeText?.({ text: n ? String(Math.min(n, 99)) : '' })
    if (n) await chrome.action?.setBadgeBackgroundColor?.({ color: '#d03b3b' })
  } catch { /* no action API */ }
}

/** Checks the stack's watched automations; `force` skips the 15-minute wait. Returns { checked, notices }. */
export async function checkWatches(stack, { force = false } = {}) {
  if (!stack || running.has(stack)) return { checked: 0, notices: 0 }
  const store = await storageGet('local', [WATCHES_KEY, NOTICES_KEY, CHECKED_KEY, NOTIFY_KEY])
  const watches = store[WATCHES_KEY] || {}
  const mine = Object.entries(watches).filter(([, w]) => w.stack === stack)
  const checkedAt = store[CHECKED_KEY] || {}
  if (!mine.length || (!force && Date.now() - (checkedAt[stack] || 0) < PAGE_INTERVAL)) return { checked: 0, notices: 0 }
  running.add(stack)
  try {
    let notices = store[NOTICES_KEY] || []
    const fresh = []
    for (const [k, w] of mine) {
      try {
        const cur = await snapshot(stack, w)
        const changes = diffAutomation(w.last, cur, w.on)
        if (changes.length) {
          notices = addNotices(notices, { ...w, name: cur.name }, changes)
          fresh.push(...changes.map((c) => `${cur.name} ${c.text}`))
        }
        watches[k] = { ...w, name: cur.name, last: { status: cur.status, statusName: automationStatusName(cur.status), lastRunTime: cur.lastRunTime, lastRunStatus: cur.lastRunStatus }, checkedAt: Date.now() }
      } catch (e) {
        watches[k] = { ...w, error: e?.message || String(e), checkedAt: Date.now() }
      }
    }
    await chrome.storage.local.set({ [WATCHES_KEY]: watches, [NOTICES_KEY]: notices, [CHECKED_KEY]: { ...checkedAt, [stack]: Date.now() } })
    await updateBadge(notices)
    if (fresh.length && store[NOTIFY_KEY] && chrome.notifications?.create) {
      chrome.notifications.create({ type: 'basic', iconUrl: chrome.runtime.getURL('images/icon128x128.png'), title: 'SFMC Toolkit: watched automations', message: fresh.slice(0, 3).join('\n') + (fresh.length > 3 ? `\n+${fresh.length - 3} more` : '') })
    }
    return { checked: mine.length, notices: fresh.length }
  } finally {
    running.delete(stack)
  }
}

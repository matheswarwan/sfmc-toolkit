// Automation and journey overviews (feedback #50): everything in the business unit,
// counted by status, what needs a look, run trends from the run log, and which
// published journeys send email, SMS or push.
import { searchAutomations, loadMoreAutomations, fetchRunHistory } from './automationApi.js'
import { searchJourneys, fetchJourney, JOURNEY_PAGE_SIZE } from './journeys.js'
import { automationStatusName, isFailure } from './watches.js'
import { runInBatches } from './batchRunner.js'

const MAX_ITEMS = 2000
const time = (v) => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t }

function countBy(list, keyOf) {
  const m = new Map()
  for (const x of list) { const k = keyOf(x) || 'Unknown'; m.set(k, (m.get(k) || 0) + 1) }
  return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

/** Every automation (up to 2,000), loading 50 at a time. onProgress(loaded, total). */
export async function listAllAutomations(stack, onProgress = () => {}) {
  const first = await searchAutomations(stack, '', 0)
  let items = first.entries
  let total = first.total
  onProgress(items.length, total)
  while (items.length < Math.min(total, MAX_ITEMS)) {
    const r = await loadMoreAutomations(stack, '', items)
    if (!r.entries.length) break
    items = items.concat(r.entries)
    total = r.total
    onProgress(items.length, total)
  }
  return items
}

const RUNNING_TOO_LONG = 6 * 3600 * 1000

/** Counts by status and last run, and the automations that need a look. */
export function summarizeAutomations(list, now = Date.now()) {
  const status = (a) => automationStatusName(a.status)
  const attention = []
  for (const a of list) {
    const s = status(a)
    if (isFailure(a.lastRunStatus)) attention.push({ automation: a, reason: `Last run: ${a.lastRunStatus}` })
    else if (/error/i.test(s)) attention.push({ automation: a, reason: `Status: ${s}` })
    else if (/^running$/i.test(s) && a.lastRunTime && now - time(a.lastRunTime) > RUNNING_TOO_LONG) attention.push({ automation: a, reason: 'Running for more than 6 hours' })
  }
  attention.sort((x, y) => time(y.automation.lastRunTime) - time(x.automation.lastRunTime))
  return {
    total: list.length,
    byStatus: countBy(list, status),
    byLastRun: countBy(list.filter((a) => a.lastRunStatus), (a) => String(a.lastRunStatus)),
    failedLastRun: list.filter((a) => isFailure(a.lastRunStatus)).length,
    attention,
  }
}

const dayKey = (t) => new Date(t).toISOString().slice(0, 10)

/**
 * Runs per day (succeeded / failed) over the last `days`, from the run log of the
 * `max` most recently run automations, 4 at a time. Returns { days: [{ key, ok,
 * failed }], perAutomation: [{ automation, runs, failed, lastFailure }], read, errors }.
 */
export async function runTrends(stack, list, { days = 30, max = 40, now = Date.now(), onProgress } = {}) {
  const since = now - days * 86400000
  const recent = list.filter((a) => time(a.lastRunTime) >= since).sort((a, b) => time(b.lastRunTime) - time(a.lastRunTime)).slice(0, max)
  const perDay = new Map()
  for (let t = since; t <= now; t += 86400000) perDay.set(dayKey(t), { key: dayKey(t), ok: 0, failed: 0 })
  const perAutomation = []
  let errors = 0
  await runInBatches(recent, 4, async (a) => {
    try {
      const { runs } = await fetchRunHistory(stack, a.id, { days, top: 200, now: new Date(now) })
      let failed = 0
      let lastFailure = null
      for (const r of runs) {
        const t = time(r.start)
        if (!t) continue
        const d = perDay.get(dayKey(t))
        const bad = isFailure(r.status)
        if (d) bad ? d.failed++ : d.ok++
        if (bad) { failed++; if (!lastFailure || t > time(lastFailure.start)) lastFailure = r }
      }
      perAutomation.push({ automation: a, runs: runs.length, failed, lastFailure })
    } catch {
      errors++
    }
  }, { onProgress })
  perAutomation.sort((x, y) => y.failed - x.failed || y.runs - x.runs)
  return { days: [...perDay.values()], perAutomation, read: recent.length, errors }
}

/** Every journey's latest version (up to 2,000). */
export async function listAllJourneys(stack, onProgress = () => {}) {
  let page = 1
  let items = []
  let total = Infinity
  while (items.length < Math.min(total, MAX_ITEMS)) {
    const r = await searchJourneys(stack, { page })
    items = items.concat(r.items)
    total = r.total
    onProgress(items.length, total)
    if (r.items.length < JOURNEY_PAGE_SIZE) break
    page++
  }
  return items
}

export const LIVE_JOURNEY = /^(published|running|scheduledtopublish)$/i

export function summarizeJourneys(list) {
  return { total: list.length, byStatus: countBy(list, (j) => j.status), live: list.filter((j) => LIVE_JOURNEY.test(j.status || '')).length }
}

const CHANNELS = [['email', /EMAIL/], ['sms', /SMS/], ['push', /PUSH|INAPP|INBOX/], ['whatsapp', /WHATSAPP/]]

/** What each live journey sends, read from its definition (up to `max`, 4 at a time). */
export async function journeyChannels(stack, journeys, { max = 100, onProgress } = {}) {
  const live = journeys.filter((j) => LIVE_JOURNEY.test(j.status || '')).slice(0, max)
  const rows = []
  await runInBatches(live, 4, async (j) => {
    try {
      const def = await fetchJourney(stack, j.id, j.version)
      const counts = { email: [], sms: [], push: [], whatsapp: [] }
      for (const a of def?.activities || []) {
        const t = String(a.type || '').toUpperCase()
        const ch = CHANNELS.find(([, re]) => re.test(t))
        if (ch) counts[ch[0]].push(a.name || t)
      }
      rows.push({ journey: j, ...counts })
    } catch (e) {
      rows.push({ journey: j, error: e.message, email: [], sms: [], push: [], whatsapp: [] })
    }
  }, { onProgress })
  rows.sort((a, b) => b.email.length - a.email.length || String(a.journey.name).localeCompare(String(b.journey.name)))
  return { rows, checked: live.length, sendingEmail: rows.filter((r) => r.email.length).length }
}

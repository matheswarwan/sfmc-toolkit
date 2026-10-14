// The export document for one automation (from SFMC Automation Viewer's
// downloadAutomation.js): overview, schedule, error notifications, then every step's
// activities with their details.
import { describeRecurrence } from './ical.js'
import { activityBlocks, activityTypeLabel } from './activityTypes.js'
import { formatDateTime } from './format.js'

export function automationOverviewRows(d) {
  return [
    ['Name', d.name], ['Key', d.key], ['Type', d.type], ['Status', d.status],
    ['Last run', formatDateTime(d.lastRunTime)], ['Last run status', d.lastRunStatus],
    ['Created', formatDateTime(d.createdDate)], ['Modified', formatDateTime(d.modifiedDate)], ['ID', d.id],
  ].filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])
}

export function scheduleRows(s) {
  if (!s) return []
  return [
    ['Status', s.scheduleStatus], ['Recurrence', describeRecurrence(s.icalRecur) || s.icalRecur], ['Time zone', s.timezoneName],
    ['Start', formatDateTime(s.startDate)], ['Next run', formatDateTime(s.scheduledTime)], ['End', formatDateTime(s.endDate)],
  ].map(([k, v]) => [k, v ? String(v) : '—'])
}

/**
 * @param {object} details   the automation
 * @param {object|null} notifications
 * @param {(stepIdx, actIdx) => object|null} descFor  the described activity, if loaded
 */
export function automationDoc(details, notifications, descFor) {
  const blocks = [
    { type: 'h', level: 2, text: 'Overview' },
    { type: 'kv', rows: automationOverviewRows(details) },
  ]
  if (details.schedule) blocks.push({ type: 'h', level: 2, text: 'Schedule' }, { type: 'kv', rows: scheduleRows(details.schedule) })
  const workers = notifications?.workers || []
  if (workers.length) {
    blocks.push({ type: 'h', level: 2, text: 'Error notifications' },
      { type: 'table', columns: ['Type', 'Recipient', 'Channel'], rows: workers.map((w) => [w.notificationType || '', w.definition || '', w.channelType || '']) })
  }
  ;(details.steps || []).forEach((step, si) => {
    blocks.push({ type: 'h', level: 2, text: `Step ${si + 1}${step.name ? `: ${step.name}` : ''}` })
    ;(step.activities || []).forEach((a, ai) => {
      const desc = descFor(si, ai)
      if (desc) blocks.push(...activityBlocks(desc, `${si + 1}.${ai + 1}`))
      else blocks.push({ type: 'h', level: 3, text: `${si + 1}.${ai + 1}: ${a.name || ''}` }, { type: 'p', text: `${activityTypeLabel(a.objectTypeId)}. Details could not be loaded.` })
    })
    if (!step.activities?.length) blocks.push({ type: 'p', text: 'No activities.' })
  })
  return { title: details.name || 'Automation', blocks }
}

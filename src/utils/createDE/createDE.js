// Create DE (feedback #94): field and setting rules, the request SFMC gets, and
// loading the sample rows. The page is views/data/CreateDEPage.vue.
import { createDataExtension, insertDERowsAsync, DEFAULT_TEXT_LENGTH } from '../sfmcApi.js'
import { isBoolText, isDateText, isEmailText, isIntText } from './sample.js'

// SFMC field types and their numbers in Contact Builder's customobjects API.
// Text to Decimal match buildDEFields in sfmcApi.js; Locale (7) is not checked live.
export const FIELD_TYPES = [
  { id: 'Text', num: 0, length: true },
  { id: 'Number', num: 1 },
  { id: 'Decimal', num: 6, length: true, scale: true },
  { id: 'Date', num: 2 },
  { id: 'Boolean', num: 3 },
  { id: 'EmailAddress', num: 4 },
  { id: 'Phone', num: 5 },
  { id: 'Locale', num: 7 },
]
const TYPE = Object.fromEntries(FIELD_TYPES.map((t) => [t.id, t]))

// Data retention: what is deleted, and the period units (SFMC's unit numbers).
export const RETENTION_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'rows', label: 'Delete individual records' },
  { id: 'all', label: 'Delete all records' },
  { id: 'allAndDE', label: 'Delete all records and the data extension' },
]
export const RETENTION_UNITS = [
  { id: 3, label: 'days' },
  { id: 4, label: 'weeks' },
  { id: 5, label: 'months' },
  { id: 6, label: 'years' },
]

export const MAX_FIELDS = 4000
export const LOAD_BATCH = 500
const NAME_CHARS = /^[A-Za-z0-9_ ]+$/
const DE_NAME_CHARS = /^[A-Za-z0-9_ -]+$/
const KEY_CHARS = /^[A-Za-z0-9_-]+$/

export function blankField(n = 1) {
  return { name: `Field${n}`, type: 'Text', length: 255, scale: 0, isPrimaryKey: false, isNullable: true, defaultValue: '' }
}

export function blankSettings() {
  return {
    name: '', key: '', description: '', folderId: null, folderPath: '',
    isSendable: false, sendField: '', isTestable: false,
    retention: { mode: 'off', length: 30, unit: 3, resetOnImport: false },
  }
}

/** Problems with one field ('' when fine), given every field for the name check. */
export function fieldProblem(f, all = []) {
  const name = String(f.name ?? '').trim()
  if (!name) return 'Enter a name.'
  if (name.length > 128) return 'Names are at most 128 characters.'
  if (!NAME_CHARS.test(name)) return 'Use letters, numbers, spaces and underscores only.'
  if (name.startsWith('_')) return 'Names starting with an underscore are kept for SFMC.'
  if (all.filter((g) => String(g.name ?? '').trim().toLowerCase() === name.toLowerCase()).length > 1) return 'Two fields have this name.'
  if (!TYPE[f.type]) return 'Pick a type.'
  if (f.type === 'Text' && f.length !== '' && f.length != null) {
    const n = Number(f.length)
    if (!Number.isInteger(n) || n < 1 || n > 4000) return 'Text length is 1 to 4000 (empty: 4000).'
  }
  if (f.type === 'Decimal') {
    const p = Number(f.length)
    const s = Number(f.scale)
    if (!Number.isInteger(p) || p < 1 || p > 38) return 'Decimal length (precision) is 1 to 38.'
    if (!Number.isInteger(s) || s < 0 || s > p) return 'Decimal places are 0 to the length.'
  }
  if (f.isPrimaryKey && f.isNullable) return 'A primary key field must be required.'
  const d = String(f.defaultValue ?? '')
  if (d && valueProblem(d, f)) return `Default value: ${valueProblem(d, f)}`
  return ''
}

/** Why a value does not fit a field ('' when it does). Empty values are checked by cellProblem. */
export function valueProblem(value, f) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  switch (f.type) {
    case 'Text': return f.length && v.length > Number(f.length) ? `Longer than ${f.length} characters` : ''
    case 'Number': return isIntText(v) ? '' : 'Not a whole number'
    case 'Decimal': {
      if (!/^[-+]?\d+(\.\d+)?$/.test(v)) return 'Not a number'
      const [i, frac = ''] = v.replace(/^[-+]/, '').split('.')
      if (frac.length > Number(f.scale)) return `More than ${f.scale} decimal places`
      if (i.replace(/^0+(?=\d)/, '').length > Number(f.length) - Number(f.scale)) return 'Too many digits'
      return ''
    }
    case 'Date': return isDateText(v) ? '' : 'Not a date'
    case 'Boolean': return isBoolText(v) ? '' : 'Not true or false'
    case 'EmailAddress': return isEmailText(v) && v.length <= 254 ? '' : 'Not an email address'
    case 'Phone': return /^[0-9+().\s-]{3,50}$/.test(v) ? '' : 'Not a phone number'
    case 'Locale': return /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(v) ? '' : 'Not a locale (like en-US)'
    default: return ''
  }
}

/** Why a sample cell would be refused ('' when fine). */
export function cellProblem(value, f) {
  if (String(value ?? '').trim() === '') return f.isNullable || String(f.defaultValue ?? '') ? '' : 'Required'
  return valueProblem(value, f)
}

/** Problems with the settings and fields together: { form: [...], fields: [...] }. */
export function checkCreateForm(settings, fields) {
  const form = []
  const name = String(settings.name ?? '').trim()
  if (!name) form.push('Enter a name for the data extension.')
  else if (name.length > 128) form.push('The data extension name is at most 128 characters.')
  else if (!DE_NAME_CHARS.test(name) || name.startsWith('_')) form.push('Use letters, numbers, spaces, underscores and dashes in the name (not starting with an underscore).')
  const key = String(settings.key ?? '').trim()
  if (key && (key.length > 36 || !KEY_CHARS.test(key))) form.push('The external key is up to 36 letters, numbers, underscores or dashes (or leave it empty).')
  if (settings.folderId == null || settings.folderId === '') form.push('Pick a folder.')
  if (!fields.length) form.push('Add at least one field.')
  if (fields.length > MAX_FIELDS) form.push(`A data extension has at most ${MAX_FIELDS} fields.`)
  if (settings.isSendable) {
    const f = fields.find((x) => x.name === settings.sendField)
    if (!f) form.push('Pick the field that relates to Subscriber Key.')
    else if (!['Text', 'EmailAddress', 'Number'].includes(f.type)) form.push('The send relationship field must be Text, EmailAddress or Number.')
  }
  const r = settings.retention || {}
  if (r.mode && r.mode !== 'off') {
    const n = Number(r.length)
    if (!Number.isInteger(n) || n < 1 || n > 999) form.push('The retention period is 1 to 999.')
  }
  return { form, fields: fields.map((f) => fieldProblem(f, fields)) }
}

export function isFormValid(check) {
  return !check.form.length && check.fields.every((p) => !p)
}

/** The fields array SFMC gets (same shape as buildDEFields in sfmcApi.js). */
export function buildFields(fields) {
  return fields.map((f, i) => {
    const t = TYPE[f.type] || TYPE.Text
    const field = {
      name: String(f.name).trim(),
      ordinal: i,
      type: t.num,
      scale: 0,
      isPrimaryKey: !!f.isPrimaryKey,
      isTemplateField: false, isHidden: false, isReadOnly: false, isOverridable: false, isInheritable: false,
      updatable: true, retrievable: true, isActive: true, mustOverride: false,
      isNullable: f.isPrimaryKey ? false : !!f.isNullable,
    }
    // Text with an empty length gets SFMC's maximum; other types must omit length.
    if (t.num === 0) field.length = f.length !== '' && f.length != null ? Number(f.length) : DEFAULT_TEXT_LENGTH
    if (t.num === 6) { field.length = Number(f.length); field.scale = Number(f.scale) }
    const d = String(f.defaultValue ?? '').trim()
    if (d) field.defaultValue = d
    return field
  })
}

export function retentionBody(r) {
  if (!r || !r.mode || r.mode === 'off') return null
  return {
    isRowBasedRetention: r.mode === 'rows',
    isDeleteAtEndOfRetentionPeriod: r.mode === 'allAndDE',
    isResetRetentionPeriodOnImport: !!r.resetOnImport,
    dataRetentionPeriodLength: Number(r.length),
    dataRetentionPeriodUnitOfMeasure: Number(r.unit),
  }
}

/** The body for Contact Builder's customobjects POST. */
export function buildCreateBody(settings, fields) {
  const body = {
    importActivity: {},
    name: String(settings.name).trim(),
    description: String(settings.description ?? '').trim(),
    categoryID: Number.parseInt(settings.folderId, 10),
    isActive: true,
    status: 0,
    isObjectDeletable: true,
    isFieldAdditionAllowed: true,
    isFieldModificationAllowed: true,
    isTestable: !!settings.isTestable,
    isSendable: !!settings.isSendable,
    fields: buildFields(fields),
  }
  const key = String(settings.key ?? '').trim()
  if (key) body.customerKey = key
  if (settings.isSendable) {
    body.sendableCustomObjectField = settings.sendField
    body.sendableSubscriberField = '_SubscriberKey'
  }
  const ret = retentionBody(settings.retention)
  if (ret) body.dataRetentionProperties = ret
  return body
}

/** Sample rows as SFMC row objects, skipping rows with a problem. { items, skipped } */
export function rowsToLoad(fields, rows, columnIndex) {
  const items = []
  let skipped = 0
  for (const r of rows) {
    const item = {}
    let bad = false
    fields.forEach((f, i) => {
      const src = columnIndex[i]
      const v = src == null ? '' : String(r[src] ?? '').trim()
      if (cellProblem(v, f)) bad = true
      if (v !== '') item[String(f.name).trim()] = f.type === 'Boolean' ? String(/^(true|yes|y)$/i.test(v)) : v
    })
    if (bad) skipped++
    else items.push(item)
  }
  return { items, skipped }
}

/**
 * Creates the data extension; with `rows`, then adds them in batches of LOAD_BATCH.
 * Returns { de: { id, key, name }, loaded, skipped, loadError }.
 */
export async function createDE(stack, settings, fields, { rows = null, columnIndex = [], api = { createDataExtension, insertDERowsAsync } } = {}) {
  const check = checkCreateForm(settings, fields)
  if (!isFormValid(check)) throw new Error(check.form[0] || check.fields.find(Boolean))
  const created = await api.createDataExtension(stack, buildCreateBody(settings, fields))
  const de = { id: created?.id, key: created?.customerKey || String(settings.key ?? '').trim(), name: String(settings.name).trim() }
  const out = { de, loaded: 0, skipped: 0, loadError: '' }
  if (!rows?.length) return out
  const { items, skipped } = rowsToLoad(fields, rows, columnIndex)
  out.skipped = skipped
  if (!de.key) { out.loadError = 'SFMC did not return the new data extension\'s key, so no rows were added.'; return out }
  try {
    for (let i = 0; i < items.length; i += LOAD_BATCH) {
      await api.insertDERowsAsync(stack, de.key, items.slice(i, i + LOAD_BATCH))
      out.loaded += Math.min(LOAD_BATCH, items.length - i)
    }
  } catch (e) {
    out.loadError = e.message
  }
  return out
}

// ── The folder used last, per stack and business unit ──
const FOLDER_KEY = 'toolkit_createDE_folders'

export async function readLastFolder(stack, buId) {
  try {
    const r = await chrome.storage.local.get(FOLDER_KEY)
    return r?.[FOLDER_KEY]?.[`${stack}:${buId ?? ''}`] || null
  } catch {
    return null
  }
}

export async function saveLastFolder(stack, buId, folder) {
  try {
    const r = await chrome.storage.local.get(FOLDER_KEY)
    const all = { ...(r?.[FOLDER_KEY] || {}), [`${stack}:${buId ?? ''}`]: { id: folder.id, path: folder.path } }
    await chrome.storage.local.set({ [FOLDER_KEY]: all })
  } catch { /* storage unavailable */ }
}

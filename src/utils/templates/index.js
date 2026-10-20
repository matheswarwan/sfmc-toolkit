// Automation Templates: each template describes the data extensions, Query
// activities and automation it needs (plan), and what the user does before and
// after. createFromPlan makes them in SFMC; nothing is scheduled or run.
import { orphanContacts } from './orphanContacts.js'
import { dataViewArchive } from './dataViewArchive.js'
import { buildDEFields, createTemplateDE, createQueryActivity, createAutomation, getDERootFolderId, getQueryRootFolderId } from '../sfmcApi.js'

export const TEMPLATES = [orphanContacts, dataViewArchive]

/**
 * Creates a plan's data extensions, then its Query activities, then the
 * automation, stopping at the first failure. progress(entry) is called for each
 * object ({ kind, name, status: 'creating' | 'done' | 'failed', id?, error?, note? }).
 * Returns { created: [...], failed: entry | null }, so a partial run can be cleaned up.
 */
export async function createFromPlan(stack, plan, progress = () => {}) {
  const created = []
  const step = async (kind, name, fn) => {
    progress({ kind, name, status: 'creating' })
    try {
      const r = await fn()
      const entry = { kind, name, status: 'done', ...r }
      created.push(entry)
      progress(entry)
      return entry
    } catch (e) {
      const entry = { kind, name, status: 'failed', error: e.message }
      progress(entry)
      throw Object.assign(e, { entry })
    }
  }
  try {
    const deFolder = await getDERootFolderId(stack)
    const queryFolder = await getQueryRootFolderId(stack).catch(() => null)
    const deByRef = {}
    for (const de of plan.des) {
      deByRef[de.ref] = await step('de', de.name, async () => {
        const r = await createTemplateDE(stack, { name: de.name, key: de.key, fields: buildDEFields(de.fields), categoryID: deFolder, sendableField: de.sendableField })
        return {
          id: r?.id ?? null, key: r?.customerKey ?? de.key,
          note: r?.sendableFailed ? `Created as not sendable. Make it sendable in Contact Builder (send relationship ${de.sendableField} to Subscriber Key) before using it to delete contacts.` : '',
        }
      })
    }
    const queryByRef = {}
    for (const q of plan.queries) {
      const target = deByRef[q.target]
      queryByRef[q.ref] = await step('query', q.name, async () => {
        const r = await createQueryActivity(stack, {
          name: q.name, description: 'Created by SFMC Toolkit (Automation Templates).', queryText: q.sql,
          targetName: target.name, targetKey: target.key, targetId: target.id, updateType: q.updateType, categoryId: queryFolder,
        })
        return { id: r?.queryDefinitionId ?? r?.id ?? null }
      })
    }
    const a = plan.automation
    await step('automation', a.name, async () => {
      const r = await createAutomation(stack, {
        name: a.name, description: a.description,
        steps: a.steps.map((s) => ({ name: s.name, activities: s.queries.map((ref) => ({ name: queryByRef[ref].name, id: queryByRef[ref].id })) })),
      })
      return { id: r?.id ?? null }
    })
    return { created, failed: null }
  } catch (e) {
    return { created, failed: e.entry || { kind: 'setup', name: 'Folders', status: 'failed', error: e.message } }
  }
}

import { describe, it, expect } from 'vitest'
import { automationDoc } from '../automationDoc.js'
import { describeActivity } from '../activityTypes.js'
import { toMarkdown } from '../exportDoc.js'

describe('automationDoc', () => {
  it('lists overview, schedule, notifications and each step activity', () => {
    const details = {
      name: 'Nightly', key: 'NK', status: 'Scheduled',
      schedule: { scheduleStatus: 'active', icalRecur: 'FREQ=DAILY;INTERVAL=1', timezoneName: 'UTC' },
      steps: [{ name: 'Load', activities: [{ name: 'Q1', objectTypeId: 300 }, { name: 'W', objectTypeId: 467 }] }, { activities: [] }],
    }
    const descs = { '0.0': describeActivity(300, { name: 'Q1', queryText: 'SELECT 1' }, 's10') }
    const doc = automationDoc(details, { workers: [{ notificationType: 'Error', definition: 'a@b.c', channelType: 'Email' }] }, (s, a) => descs[`${s}.${a}`] || null)
    const md = toMarkdown(doc)
    expect(doc.title).toBe('Nightly')
    expect(md).toContain('| Recurrence | Every day |')
    expect(md).toContain('| Error | a@b.c | Email |')
    expect(md).toContain('## Step 1: Load')
    expect(md).toContain('### 1.1: Q1')
    expect(md).toContain('```sql\nSELECT 1\n```')
    expect(md).toContain('### 1.2: W')
    expect(md).toContain('Wait. Details could not be loaded.')
    expect(md).toContain('## Step 2\n\nNo activities.')
  })
})

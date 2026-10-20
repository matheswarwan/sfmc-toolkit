// Contacts (feedback #57): the contact count and a Contact Key search, using the
// calls Contact Builder's All Contacts screen makes (contactsmeta, reached with the
// Contact Builder session). From the user's network log; the search response's
// shape is not confirmed, so parseContacts reads it loosely.
import { sfmcFetch } from './sfmcApi.js'

const CM = (stack) => `https://mc.${stack}.marketingcloudapps.com/contactsmeta/fuelapi`
export const CONTACT_PAGE_SIZE = 25
// Contact Builder's attribute ID for Contact Key.
export const CONTACT_KEY_DEFINITION_ID = 101

export async function fetchContactCount(stack) {
  const data = await sfmcFetch(`${CM(stack)}/contacts/v1/addresses/count/?$pageSize=${CONTACT_PAGE_SIZE}&$page=1&$orderBy=contactKey%20ASC`, 'GET')
  const n = Number(data?.totalCount)
  if (!Number.isFinite(n)) throw new Error('Contact Builder did not return a count.')
  return n
}

export async function searchContactKey(stack, contactKey, page = 1) {
  const key = String(contactKey || '').trim()
  if (!key) throw new Error('Enter a contact key.')
  const data = await sfmcFetch(`${CM(stack)}/contacts-internal/v1/addresses/search/?$pageSize=${CONTACT_PAGE_SIZE}&$page=${page}&$orderBy=contactKey%20ASC`, 'POST', {
    queryFilter: {
      hasCriteria: true,
      rootExpressionSet: { expressions: [{ customerDataDefinitionID: CONTACT_KEY_DEFINITION_ID, operator: 'Equal', values: [key] }] },
    },
  })
  return parseContacts(data)
}

const valueOf = (v) => v?.innerValue ?? v?.value ?? v?.displayValue ?? ''

/**
 * Contacts from a search response: `addresses` (or `items`), each with its key, ID,
 * dates and the attribute values Contact Builder sent (valueSets[].values[]).
 */
export function parseContacts(data) {
  const list = data?.addresses || data?.items || data?.contacts || []
  const contacts = list.map((c) => {
    const values = []
    for (const set of c.valueSets || []) {
      for (const v of set.values || []) {
        const name = v.name || v.definitionName || v.definitionKey || String(v.customerDataDefinitionID ?? v.definitionID ?? '')
        values.push({ set: set.name || set.definitionName || '', name, value: String(valueOf(v)) })
      }
    }
    const keyValue = values.find((v) => /^contact ?key$/i.test(v.name))?.value
    return {
      contactKey: c.contactKey ?? keyValue ?? '',
      contactId: c.contactID ?? c.contactId ?? c.id ?? '',
      createdDate: c.createdDate || '',
      modifiedDate: c.modifiedDate || '',
      values,
      raw: c,
    }
  })
  const total = Number(data?.totalCount ?? data?.count)
  return { contacts, total: Number.isFinite(total) ? total : contacts.length }
}

/**
 * Analytics - GA4 Measurement Protocol, routed through the background SW.
 *
 * All events are anonymous. A random UUID client_id is generated once and
 * persisted in chrome.storage.local. No query text, DE names, or user PII
 * is ever sent.
 *
 * Setup (once you have a GA4 property):
 *   1. Go to Analytics > Admin > Data Streams > your web stream
 *   2. Copy the Measurement ID  (looks like G-XXXXXXXXXX)
 *   3. Under "Measurement Protocol API secrets", create a secret and copy it
 *   4. They live in src/background/analytics.js
 */

const CLIENT_ID_KEY = 'sfmcqs_analytics_cid'

let _clientId = null

async function getClientId() {
  if (_clientId) return _clientId
  return new Promise((resolve) => {
    chrome.storage.local.get(CLIENT_ID_KEY, (result) => {
      if (result[CLIENT_ID_KEY]) {
        _clientId = result[CLIENT_ID_KEY]
      } else {
        _clientId = crypto.randomUUID()
        chrome.storage.local.set({ [CLIENT_ID_KEY]: _clientId })
      }
      resolve(_clientId)
    })
  })
}

/**
 * Fire-and-forget event. Never throws.
 * @param {string} name   GA4 event name (snake_case, max 40 chars)
 * @param {object} params Optional event parameters (strings/numbers only)
 */
export async function trackEvent(name, params = {}) {
  try {
    const clientId = await getClientId()
    chrome.runtime.sendMessage({
      type: 'TRACK_EVENT', clientId, name, params,
    })
  } catch {
    // Swallow - analytics must never break the UX
  }
}

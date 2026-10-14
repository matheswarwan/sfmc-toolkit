// GA4 Measurement Protocol (the same property as SFMC Query Saver; events carry
// app: 'toolkit'). Events are anonymous: a random client id, no SQL, names or PII.
const GA4_MEASUREMENT_ID = 'G-KYHPC12MT9'
const GA4_API_SECRET      = 'AacKkgqYTri0uyyZm3Dqhw'

export async function sendAnalyticsEvent({ clientId, name, params }) {
  if (!clientId || !name) return
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name, params: { ...params, app: 'toolkit', extension_version: chrome.runtime.getManifest().version } }],
        }),
      })
  } catch (e) {
    console.warn('[Toolkit:SW] Analytics send failed:', e.message)
  }
}

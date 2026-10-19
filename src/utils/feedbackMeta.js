// Technical details sent with feedback when the user leaves "Include technical
// details" ticked. Nothing from SFMC records: no SQL, no field values.

export function collectFeedbackMetadata({ route, stack, businessUnit, theme, apiErrors = [], apiCalls = [], now = new Date() } = {}) {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const win = typeof window !== 'undefined' ? window : {}
  let version = 'unknown'
  try { version = chrome.runtime.getManifest().version } catch { /* not in an extension */ }
  return {
    appVersion: version,
    section: route || null,
    stack: stack || null,
    businessUnit: businessUnit || null,
    theme: theme || null,
    browser: nav.userAgent || null,
    language: nav.language || null,
    window: win.innerWidth ? `${win.innerWidth}x${win.innerHeight}` : null,
    screen: win.screen?.width ? `${win.screen.width}x${win.screen.height}` : null,
    time: now.toISOString(),
    recentApiErrors: apiErrors.slice(0, 5),
    recentApiCalls: apiCalls.slice(0, 20),
  }
}

/** The details as "label: value" lines for the preview in the form. */
export function metadataLines(meta) {
  const lines = []
  for (const [k, v] of Object.entries(meta || {})) {
    if (k === 'recentApiErrors') {
      if (!v?.length) lines.push(['Recent API errors', 'none'])
      else v.forEach((e, i) => lines.push([`API error ${i + 1}`, `${e.method} ${e.path}${e.status ? ` (${e.status})` : ''}: ${e.error}`]))
    } else if (k === 'recentApiCalls') {
      if (!v?.length) lines.push(['Recent API calls', 'none'])
      else v.forEach((c, i) => lines.push([`API call ${i + 1}`, describeCall(c)]))
    } else if (v != null && v !== '') {
      lines.push([k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), String(v)])
    }
  }
  return lines
}

function describeCall(c) {
  const result = c.error ? `failed: ${c.error}` : [c.items != null && `${c.items} items`, c.total != null && `total ${c.total}`].filter(Boolean).join(', ')
  return `${c.method} ${c.path} (${c.status ?? '?'}, ${c.ms} ms)${result ? ` ${result}` : ''}`
}

// SFMC Toolkit service worker: wires the modules to chrome events and messages.
//
// Messages (all `{ type, ... }`):
//   GET_SESSION, GET_STACKS, SET_STACK_OVERRIDE      stack resolution (stack.js)
//   GET_CONNECTION_STATUS                             stack, MCA token, open SFMC tabs
//   SFMC_SESSION_STATUS { stack }                     per-app sessions, never opens a tab
//   SFMC_CONNECT_APP { stack, appId }                 warm up one app's session
//   SFMC_WARM_UP { stack, force }                     start the missing app sessions when at least one exists
//   SFMC_FETCH { url, method, body, bootstrap }       → { data } or { error, code, status }
//   SAVE_RECORDS { records }, RENAME_QUERY { id, name }, IMPORT_SHARED_QUERY { records }
//   TRACK_EVENT { clientId, name, params }
//   WATCH_CHECK { stack, force }, WATCH_BADGE          watched automations (watches.js)
//   OPEN_APP { path }                                 open app.html#<path> (Automation Summary tab)
//   SFMC_CONTEXT_CAPTURED, MCA_TOKEN_CAPTURED         from content.js
//   PING

import {
  rememberActiveStack, resolveAndPublish, getStacks, setStackOverride,
  captureContext, getSession, forgetStack, onForgetStack,
} from './stack.js'
import { restoreCsrfTokens, sniffCsrf, getCoreCsrf } from './csrf.js'
import {
  getMcaToken, isMcaTokenReady, mintBackoff, dropMcaToken, handleCapturedToken, setOnMintFailure,
} from './mcaToken.js'
import { sessionStatus, connectApp, warmUpMissing } from './sessions.js'
import { sfmcFetch } from './fetchProxy.js'
import {
  saveRecords, renameQuery, captureQueryStudio, captureEmail, loadEmailSaverPrefs, applyEmailSaverPrefs,
} from './capture.js'
import { sendAnalyticsEvent } from './analytics.js'
import { queryTabs, createTab, storageGet } from './chromeAsync.js'
import { QUERY_STUDIO_CREATE_URLS } from '../utils/queryStudio.js'
import { watchForUpdates } from './updates.js'
import { checkWatches, updateBadge } from './watches.js'

onForgetStack(dropMcaToken)
setOnMintFailure(forgetStack)
restoreCsrfTokens()
loadEmailSaverPrefs()
watchForUpdates()
updateBadge()

const APP_PAGE = 'app.html'

// The toolbar icon opens the app in a new tab each time; several tabs can be open
// (each keeps its own workspace and Query Builder query, see utils/tabClaims.js).
chrome.action?.onClicked?.addListener(() => {
  createTab({ url: chrome.runtime.getURL(APP_PAGE) })
})

chrome.tabs?.onActivated?.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => { if (!chrome.runtime.lastError && tab) rememberActiveStack(tab.url) })
})
chrome.tabs?.onUpdated?.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab?.active) rememberActiveStack(tab.url)
})

chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local') return
  const prefs = {}
  for (const k of ['_emailSaverEnabled', '_emailSaveDebounce']) if (k in changes) prefs[k] = changes[k].newValue
  applyEmailSaverPrefs(prefs)
})

chrome.webRequest?.onBeforeSendHeaders.addListener(
  sniffCsrf, { urls: ['https://*.exacttarget.com/*'] }, ['requestHeaders', 'extraHeaders'])
// Query Studio 2's host is an optional permission; Chrome only delivers its
// requests once the user has granted it (Settings > Running queries).
chrome.webRequest?.onBeforeRequest.addListener(
  captureQueryStudio, { urls: QUERY_STUDIO_CREATE_URLS }, ['requestBody'])
chrome.webRequest?.onBeforeRequest.addListener(
  captureEmail, { urls: ['https://*.marketingcloudapps.com/fuelapi/asset/v1/content/assets/*'] }, ['requestBody'])

const isSfmcUrl = (u) => /^https:\/\/[^/]*\.(exacttarget|marketingcloudapps|marketingcloud|salesforce-marketingcloud)\.com\//.test(u || '')
const isLoggedInUrl = (u) => !u.includes('/login') && !u.includes('mc.login.') && !u.includes('sso')

export async function connectionStatus() {
  const { stack } = await resolveAndPublish()
  // Pre-warm the MCA token so it is ready before the user needs it.
  if (stack && !isMcaTokenReady(stack) && !mintBackoff(stack)) getMcaToken(stack)
  let coreOpen = false
  let contentBuilderOpen = false
  for (const t of await queryTabs({})) {
    const u = t.url || ''
    if (!isSfmcUrl(u) || !isLoggedInUrl(u)) continue
    if (u.includes('content-builder.')) contentBuilderOpen = true
    else if (u.includes('mc.') || u.includes('members.')) coreOpen = true
  }
  return {
    stack,
    connected: !!stack,
    tokenReady: !!getCoreCsrf(stack),
    mcaTokenReady: isMcaTokenReady(stack),
    areas: { core: { open: coreOpen }, contentBuilder: { open: contentBuilderOpen } },
  }
}

function errorReply(err) {
  return { error: err?.message || String(err), code: err?.code || null, status: err?.status ?? null }
}

const handlers = {
  PING: () => ({ ok: true }),
  GET_SESSION: (m) => getSession(m.stackKey),
  GET_STACKS: () => getStacks(),
  SET_STACK_OVERRIDE: (m) => setStackOverride(m.stack),
  GET_CONNECTION_STATUS: () => connectionStatus(),
  SFMC_SESSION_STATUS: async (m) => ({ status: await sessionStatus(m.stack || (await resolveAndPublish()).stack) }),
  SFMC_CONNECT_APP: async (m) => {
    await connectApp(m.stack, m.appId, { onLoggedOut: forgetStack })
    return { ok: true }
  },
  SFMC_WARM_UP: async (m) => {
    // Settings switch "Start the other app sessions" (on unless turned off).
    const { _autoStartSessions } = await storageGet('local', ['_autoStartSessions'])
    if (_autoStartSessions === false && !m.force) return { result: { skipped: 'turned off' } }
    const stack = m.stack || (await resolveAndPublish()).stack
    return { result: await warmUpMissing(stack, { force: !!m.force, onLoggedOut: forgetStack }) }
  },
  SFMC_FETCH: async (m) => ({ data: await sfmcFetch(m) }),
  SAVE_RECORDS: async (m) => { await saveRecords(m.records || {}); return { status: 'OK' } },
  IMPORT_SHARED_QUERY: async (m) => { await saveRecords(m.records || {}); return { status: 'OK' } },
  RENAME_QUERY: async (m) => { await renameQuery(m.id, m.name); return { status: 'OK' } },
  TRACK_EVENT: (m) => { sendAnalyticsEvent(m); return null },
  SFMC_CONTEXT_CAPTURED: (m) => {
    captureContext(m.context)
    // An SFMC page loaded: check watched automations (at most every 15 minutes).
    if (m.context?.stackKey) checkWatches(m.context.stackKey).catch(() => undefined)
    return null
  },
  WATCH_CHECK: async (m) => ({ result: await checkWatches(m.stack || (await resolveAndPublish()).stack, { force: !!m.force }) }),
  WATCH_BADGE: async () => { await updateBadge(); return { ok: true } },
  // From the Automation Summary tab on Automation Studio pages (public/automationPanel.js).
  OPEN_APP: (m) => {
    const path = typeof m.path === 'string' && m.path.startsWith('/') ? m.path : '/'
    createTab({ url: chrome.runtime.getURL(`${APP_PAGE}#${path}`) })
    return { ok: true }
  },
  MCA_TOKEN_CAPTURED: (m, sender) => { handleCapturedToken(sender, m.accessToken); return null },
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.type]
  if (!handler) return false
  Promise.resolve()
    .then(() => handler(message, sender))
    .then((reply) => sendResponse(reply ?? {}), (err) => sendResponse(errorReply(err)))
  return true
})

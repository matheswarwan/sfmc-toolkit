// Feedback endpoint for SFMC Toolkit (and SFMC Query Saver 1.4.0 before it), on
// Cloudflare Workers with D1 `sfmc-query-saver-feedback`.
//
// POST /feedback  { message, details?, kind?, screen?, version?, app?, name?, email?,
//                   metadata?, screenshot? }   → { ok: true, id }
//
// Screenshots (JPEG/PNG/WebP data URLs, up to 1.9 MB) go to their own table, so
// feedback queries stay readable; there is deliberately no way to read them back
// over HTTP (they can show customer data). Use show-screenshot.sh.

const LIMITS = { message: 2000, details: 5000, screen: 200, version: 40, app: 40, kind: 20, name: 100, email: 200, metadata: 20000, screenshot: 1_900_000 }
const SCREENSHOT_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function validate(body) {
  const message = text(body?.message, LIMITS.message)
  if (!message) return { error: 'message is required' }
  let metadata = null
  if (body.metadata != null) {
    metadata = JSON.stringify(body.metadata)
    if (metadata.length > LIMITS.metadata) return { error: 'metadata is too large' }
  }
  let screenshot = null
  if (body.screenshot != null) {
    if (typeof body.screenshot !== 'string' || !SCREENSHOT_RE.test(body.screenshot)) return { error: 'screenshot must be an image data URL' }
    if (body.screenshot.length > LIMITS.screenshot) return { error: 'screenshot is too large' }
    screenshot = body.screenshot
  }
  return {
    row: {
      message,
      details: text(body.details, LIMITS.details),
      kind: text(body.kind, LIMITS.kind),
      screen: text(body.screen, LIMITS.screen) ?? 'unknown',
      version: text(body.version, LIMITS.version) ?? 'unknown',
      app: text(body.app, LIMITS.app),
      name: text(body.name, LIMITS.name),
      email: text(body.email, LIMITS.email),
      metadata,
    },
    screenshot,
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return cors(null, 204)
    if (request.method !== 'POST' || url.pathname !== '/feedback') return cors({ error: 'Not found' }, 404)

    let body
    try { body = await request.json() } catch { return cors({ error: 'Invalid JSON' }, 400) }
    const v = validate(body)
    if (v.error) return cors({ error: v.error }, 400)

    const r = v.row
    const now = Date.now()
    const res = await env.FEEDBACK_DB
      .prepare('INSERT INTO feedback (message, details, kind, screen, version, app, name, email, metadata, has_screenshot, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(r.message, r.details, r.kind, r.screen, r.version, r.app, r.name, r.email, r.metadata, v.screenshot ? 1 : 0,
        request.headers.get('CF-Connecting-IP') ?? null, now)
      .run()
    const id = res?.meta?.last_row_id ?? null
    if (v.screenshot && id != null) {
      await env.FEEDBACK_DB.prepare('INSERT INTO feedback_screenshots (feedback_id, data_url, created_at) VALUES (?, ?, ?)')
        .bind(id, v.screenshot, now).run()
    }
    return cors({ ok: true, id }, 200)
  },
}

function cors(body, status) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
  })
}

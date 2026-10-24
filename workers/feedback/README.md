# Feedback worker

Receives feedback from SFMC Toolkit (and SFMC Query Saver 1.4.0) and stores it in Cloudflare D1 `sfmc-query-saver-feedback`. Live at https://query-saver-feedback.mathes-btech.workers.dev.

- Deploy, from this folder: `CLOUDFLARE_ACCOUNT_ID=51f0411bb44bb1022dbe10412e1b5b9c npx wrangler deploy`
- Schema: `schema/0001_feedback.sql` (existing), `schema/0002_details_screenshots.sql` (apply once with `npx wrangler d1 execute sfmc-query-saver-feedback --remote --file schema/0002_details_screenshots.sql`, before deploying the new worker).
- Read feedback: `npx wrangler d1 execute sfmc-query-saver-feedback --remote --command "SELECT id, created_at, app, kind, screen, message, details, has_screenshot FROM feedback ORDER BY created_at DESC LIMIT 20"`
- Save a screenshot: `sh show-screenshot.sh <id>` (writes `feedback-<id>.jpg`; there is no HTTP way to read screenshots, since they can show customer data).

## Triage status

`schema/0003_status.sql` (applied 2026-10-24) adds four nullable columns, set by hand when a row is reviewed; the worker never writes them:

- `status`: `released` (in a version users have), `fixed` (done, in a version not yet published), `partial` (done in part, or the cause is unconfirmed), `waiting` (needs information from the user), `open`, `wontfix`, `duplicate`, `test`.
- `status_version`: the version that carries the fix (`app <deployment>` for the Toolkit App).
- `status_note`: one plain sentence, with the commit where known.
- `status_at`: when it was set, in milliseconds like `created_at`.

Open items: `npx wrangler d1 execute sfmc-query-saver-feedback --remote --command "SELECT id, version, message, status, status_note FROM feedback WHERE app='toolkit' AND (status IS NULL OR status IN ('open','waiting','partial')) ORDER BY id"`

Mark a row: `... --command "UPDATE feedback SET status='released', status_version='2.0.12', status_note='...', status_at=$(date +%s000) WHERE id=125"`. When a version is published, move its rows from `fixed` to `released`: `UPDATE feedback SET status='released' WHERE status='fixed' AND status_version='2.0.12'`.

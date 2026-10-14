# Feedback worker

Receives feedback from SFMC Toolkit (and SFMC Query Saver 1.4.0) and stores it in Cloudflare D1 `sfmc-query-saver-feedback`. Live at https://query-saver-feedback.mathes-btech.workers.dev.

- Deploy, from this folder: `CLOUDFLARE_ACCOUNT_ID=51f0411bb44bb1022dbe10412e1b5b9c npx wrangler deploy`
- Schema: `schema/0001_feedback.sql` (existing), `schema/0002_details_screenshots.sql` (apply once with `npx wrangler d1 execute sfmc-query-saver-feedback --remote --file schema/0002_details_screenshots.sql`, before deploying the new worker).
- Read feedback: `npx wrangler d1 execute sfmc-query-saver-feedback --remote --command "SELECT id, created_at, app, kind, screen, message, details, has_screenshot FROM feedback ORDER BY created_at DESC LIMIT 20"`
- Save a screenshot: `sh show-screenshot.sh <id>` (writes `feedback-<id>.jpg`; there is no HTTP way to read screenshots, since they can show customer data).

#!/bin/sh
# Saves the screenshot of one feedback row as feedback-<id>.jpg (or .png/.webp).
# Usage: CLOUDFLARE_ACCOUNT_ID=51f0411bb44bb1022dbe10412e1b5b9c sh show-screenshot.sh <project> <id> [--archive]
#   project: toolkit | toolkit_app | data_cloud_inspector | mcp_logger | query_saver | other
set -e
project="$1"; id="$2"; table="fb_${project}_screenshots"
case "$project" in toolkit|toolkit_app|data_cloud_inspector|mcp_logger|query_saver|other) ;; *) echo "Usage: sh show-screenshot.sh <project> <feedback id> [--archive]"; exit 1;; esac
[ -n "$id" ] || { echo "Usage: sh show-screenshot.sh <project> <feedback id> [--archive]"; exit 1; }
case "$id" in *[!0-9]*) echo "The id is a number."; exit 1;; esac
[ "$3" = "--archive" ] && table="fb_${project}_archive_screenshots"
cd "$(dirname "$0")"
npx wrangler d1 execute sfmc-query-saver-feedback --remote --json \
  --command "SELECT data_url FROM $table WHERE feedback_id = $id" > .shot.json
node -e '
const rows = JSON.parse(require("fs").readFileSync(".shot.json", "utf8"))[0].results
if (!rows.length) { console.log("No screenshot for that id."); process.exit(1) }
const m = rows[0].data_url.match(/^data:image\/(\w+);base64,(.+)$/)
const ext = m[1] === "jpeg" ? "jpg" : m[1]
require("fs").writeFileSync(`feedback-${process.argv[1]}.${ext}`, Buffer.from(m[2], "base64"))
console.log(`Saved feedback-${process.argv[1]}.${ext}`)
' "$id"
rm -f .shot.json

# SFMC Toolkit

A Chrome extension for Salesforce Marketing Cloud. It combines SFMC Query Saver and SFMC Automation Viewer in one full-tab app, and replaces SFMC Query Saver in the Chrome Web Store (version 2.0.0 is published as an update to that listing, so its users keep their data):

- **Queries:** saved queries (captured from Query Studio), Run Query (up to 6 SQL panels with lint, autocomplete and run-to-DE), and a visual Query Builder.
- **Automation:** automations with schedules, notifications and every activity's details; activities by type.
- **Journey:** journeys drawn like the Journey Builder canvas (horizontal or vertical) with each step's content; journey entry events.
- **Data:** data extensions (local, Shared and Synchronized) with fields, folder paths, query building and Excel export.
- **Content:** CloudPages with URLs and folder paths; saved versions of Content Builder emails, with revert.

It uses your existing Marketing Cloud login. It never asks for or stores credentials.

## Status

Version 2.0.0 is the first release. It is published as an update to the SFMC Query Saver listing on the Chrome Web Store. How it was built:

| Step | What | State |
|---|---|---|
| 1 | Scaffold: build, service worker, app shell, Settings | done |
| 2 | Queries: Saved, Workspace, Builder; backup export and import | done |
| 3 | Emails | done |
| 4 | Data Extensions | done |
| 5 | Automations and Activities | done |
| 6 | Journeys and CloudPages | done |
| 7 | Search, Features and To do pages, first release | done |

## Install

From the Chrome Web Store (the listing that was SFMC Query Saver), or unpacked:

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `dist/` folder. Click the toolbar icon to open the app.

## How authentication works

All SFMC calls are made by the service worker with your session cookies (extension pages cannot send them).

1. **Stack:** the stack you pinned, else the SFMC tab you used last, else any open SFMC tab, else your login cookies (several are each checked with a real call).
2. **Core APIs** (`mc.<stack>.exacttarget.com`): cookies, plus the CSRF token captured from SFMC's own requests on writes.
3. **Automation Studio, Contact Builder and Content Builder** (`*.marketingcloudapps.com`): a Bearer token, minted by opening `update-token.json` in an inactive tab for a moment. Content Builder writes also send its `_csrf` cookie as a header.
4. **Journey Builder and CloudPages**, and any app that still has no session: the app is opened in an inactive tab until its API answers, then the tab is closed and the call retried once.

The connection menu in the top bar shows the stack, the business unit and each app's session, and lets you pin a stack.

## Development

| Command | What it does |
|---|---|
| `npm run build` | Builds the app (`app.html`) and the service worker into `dist/` |
| `npm run dev` | Rebuilds the app on change (run `npm run build` once first for the service worker) |
| `npm test` | Runs the tests (vitest) |

Layout:

| Path | What |
|---|---|
| `app.html`, `src/app/` | The app: router, sidebar sections (`nav.js`), shell |
| `src/views/` | One folder per section |
| `src/background/` | Service worker modules; `index.js` lists every message |
| `src/utils/sfmcApi.js` | SFMC API calls from the pages, all through the service worker |
| `public/` | Copied as is: `manifest.json`, `content.js` (SSO and token capture), `share-handler.js`, images |

Storage keys are the same as SFMC Query Saver's (`sql_*`, `email_*`, `workspace_*` and its settings), so a Query Saver backup imports unchanged.

## Chrome Web Store listing

The store text, single-purpose statement, permission justifications and data-use answers are in [docs/store-listing.md](docs/store-listing.md).

## Feedback

Use **Send feedback** in the app, or email mathes.btech@gmail.com.

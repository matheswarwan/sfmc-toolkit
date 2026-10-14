# SFMC Toolkit: notes for Claude

Chrome MV3 extension, Vue 3 + Vite + Tailwind. It merges SFMC Query Saver (`../SFMCQuerySaver`, from branch `feature/shared-des-remove-launcher`, PR #44) and SFMC Automation Viewer (`../sfmc-automation-viewer`, v1.2 plus PR #4). The plan, decisions and status log are in `../sfmc-toolkit-plan.md`.

## Rules

- **Everything is built from `src/` and `public/`.** `dist/` is build output and is not committed. Never hand-edit `dist/` (Query Saver's Bug 9: hand patches to bundles vanish on the next build).
- **The service worker is `src/background/`**, built by `vite.sw.config.js` into one ES module (`dist/background.js`, `"type": "module"` in the manifest). Every message is listed at the top of `src/background/index.js`; messages are `{ type, ... }`.
- **Never call SFMC from an extension page.** Pages use `sfmcFetch`/`proxyFetch` in `src/utils/sfmcApi.js`, which sends `SFMC_FETCH` to the service worker. Errors keep Query Saver's text (`SFMC API error <status>: ...`, "DE not found", "session expired") since callers match on it; replies also carry `code` (`SFMC_LOGIN_REQUIRED`, `SFMC_SESSION_UNAVAILABLE`) and `status`.
- **Storage keys stay Query Saver's** (`sql_*`, `email_*`, `workspace_*`, `_emailSaverEnabled`, `_emailSaveDebounce`, `_reuseQueryDE`, `sfmcqs_theme`, `lintDisabledRules`, `stackOverride`, `sfmcStack`), so a Query Saver backup imports as is.
- **Theme:** the `.dark` class from `useTheme.js` drives the colour tokens; components set text colour explicitly (`text-foreground`, ...), never from a `prefers-color-scheme` media query (Query Saver's Bug 8).
- **Toolbar icon:** no `default_popup`; `chrome.action.onClicked` opens or focuses `app.html`.
- **Writing:** plain prose, no em dashes, no emoji.

## Auth (src/background)

- `stack.js`: stack resolution (pin → last active SFMC tab → open tab → login cookies, verified when several → probe), `forgetStack` after an auth failure.
- `csrf.js`: core CSRF captured passively from `*.exacttarget.com` requests (no way to fetch one); `_csrf` cookie for marketingcloudapps apps.
- `mcaToken.js`: Bearer token minted in an inactive `update-token.json` tab; `content.js` reports `MCA_TOKEN_CAPTURED`. A failed mint backs off for 2 minutes.
- `sessions.js` + `apps.js`: Automation Viewer's per-app session warm-up (inactive landing tab, probe until 200). Apps with `bearer: true` (Automation Studio, Contact Builder meta, Content Builder) get the token; Journey Builder and CloudPages use cookies only. **Not yet checked live in the merged form**, in particular Journey Builder and CloudPages.
- `fetchProxy.js`: the order is Bearer/CSRF → re-read a rotated CSRF after a 403 → re-mint a rejected token once → warm up the app session once → `LOGIN_REQUIRED`. Requests use `redirect: 'manual'`, so a redirect into SSO reads as "no session".

## Tests

`npm test` (vitest, jsdom). `src/background/__tests__/harness.js` loads the service worker modules against a fake `chrome` and a simulated SFMC (per-app sessions, Bearer minting, rotating Content Builder CSRF). Ported from Query Saver's `backgroundStack.test.js` and Automation Viewer's `sfmcAuth.test.js`.

## Porting status

Steps 1 (scaffold), 2 (Queries) and 3 (Emails) are done. Query Saver's info page is under `src/views/info/` but **not routed yet** (step 7); it still imports `./composables/...` paths and link to the old `*.html` pages. Automation Viewer's screens are rewritten from scratch in steps 4 to 6 (its source is plain JS in `../sfmc-automation-viewer`; the feature list is in the plan).

Queries section notes:
- `WorkspacePage` and `BuilderPage` are kept alive (`<KeepAlive>` in `App.vue`), so a run's polling and a half-built query survive a visit to another section. Never key them on the route.
- Workspace: `?id=`, `?sql=`, `?ws=` are applied by `openInPanel`/`restore` in `useWorkspace.js` and then removed from the URL. The last workspace is remembered in `toolkit_lastWorkspace`. An empty panel takes the opened query; otherwise a panel is added (6 at most).
- Builder: `QueryBuilder.vue` is the old page; `BuilderPage` remounts it (`session` key) for New query or a different `?id=`. The last builder record is in `toolkit_lastBuilder`.
- Workspace panels store a `sql_*` record as soon as they open; Saved queries hides records with no SQL and no runs.
- Emails: `/emails` (list) and `/emails/:id` (versions, preview, revert with a confirm step, delete). Capture happens in `src/background/capture.js`.
- API console: one drawer for the whole app (`components/shell/ApiConsole.vue`, `useApiConsole.js`), on/off in Settings, stored as `sfmcqs_settings.apiConsole`. Pages don't call `setApiLogCallback` themselves.
- Backups: `src/utils/backup.js` (`planImport` never overwrites). Query Saver exports the same format.

Known Automation Viewer bugs not to carry over: Journey "Event Definition Key" filter read the DE-id input; the DE Clear button was bound to the Activity tab's button; activity types 725, 726, 736, 783, 1010, 1101, 1701, 3700 called missing renderers; `escapeHtml` did not escape `&` or quotes.

## Release

Not released yet. When it is: bump `public/manifest.json`, `npm run build`, zip from inside `dist/` into `releases/` (`cd dist && zip -r ../releases/sfmc-toolkit-<version>.zip .`), and check `unzip -l` shows `manifest.json` at the root (Query Saver's Bug 11). The user uploads to the Chrome Web Store.

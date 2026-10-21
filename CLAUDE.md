# SFMC Toolkit: notes for Claude

Chrome MV3 extension, Vue 3 + Vite + Tailwind. It merges SFMC Query Saver (`../SFMCQuerySaver`, from branch `feature/shared-des-remove-launcher`, PR #44) and SFMC Automation Viewer (`../sfmc-automation-viewer`, v1.2 plus PR #4). The plan, decisions and status log are in `../sfmc-toolkit-plan.md`.

## Replaces SFMC Query Saver (user, 2026-10-14)

- SFMC Toolkit is published as an **update to the SFMC Query Saver store listing** (same extension ID, renamed), so Query Saver users keep their `chrome.storage` data. Versions continue from Query Saver: 2.0.0 is the first Toolkit release (Query Saver ended at 1.4.0).
- **Never add a permission or host that Query Saver 1.4.0 did not have** without telling the user: Chrome disables an updated extension until each user accepts new permissions. Today the Toolkit's are a subset (it dropped `activeTab`). Exception, by design: `optional_host_permissions: ["https://*.herokuapp.com/*"]` (2026-10-19, feedback #32). Optional permissions need no approval on update; Settings > Running queries > Save Query Studio 2 runs requests only the origins in `src/utils/queryStudio.js` and removes them when switched off.
- Query Saver's old pages (`index.html`, `query-detail.html`, `query-builder.html`, `email-detail.html`, `features.html`, `todo.html`, `popup.html`) are tiny files in `public/` that forward to `app.html` (`public/legacy-redirect.js`), so bookmarks keep working.
- `WhatsNew.vue` explains the change once to upgraders (key `_seenVersion`, Query Saver's).
- Automation Viewer's listing: undecided.

## Rules

- **Everything is built from `src/` and `public/`.** `dist/` is build output and is not committed. Never hand-edit `dist/` (Query Saver's Bug 9: hand patches to bundles vanish on the next build).
- **The service worker is `src/background/`**, built by `vite.sw.config.js` into one ES module (`dist/background.js`, `"type": "module"` in the manifest). Every message is listed at the top of `src/background/index.js`; messages are `{ type, ... }`.
- **Never call SFMC from an extension page.** Pages use `sfmcFetch`/`proxyFetch` in `src/utils/sfmcApi.js`, which sends `SFMC_FETCH` to the service worker. Errors keep Query Saver's text (`SFMC API error <status>: ...`, "DE not found", "session expired") since callers match on it; replies also carry `code` (`SFMC_LOGIN_REQUIRED`, `SFMC_SESSION_UNAVAILABLE`) and `status`.
- **Storage keys stay Query Saver's** (`sql_*`, `email_*`, `workspace_*`, `_emailSaverEnabled`, `_emailSaveDebounce`, `_reuseQueryDE`, `sfmcqs_theme`, `lintDisabledRules`, `stackOverride`, `sfmcStack`), so a Query Saver backup imports as is.
- **Theme:** the `.dark` class from `useTheme.js` drives the colour tokens; components set text colour explicitly (`text-foreground`, ...), never from a `prefers-color-scheme` media query (Query Saver's Bug 8).
- **Toolbar icon:** no `default_popup`; `chrome.action.onClicked` opens a new `app.html` tab on every click. Several tabs can be open: `src/utils/tabClaims.js` (BroadcastChannel) keeps two tabs from reopening the same workspace or Query Builder query.
- **Writing:** plain prose, no em dashes, no emoji.
- **Git:** no feature branches (user, 2026-10-14). Commit to `main` and push; run `npm test` and `npm run build` first.

## Auth (src/background)

- `stack.js`: stack resolution (pin → last active SFMC tab → open tab → login cookies, verified when several → probe), `forgetStack` after an auth failure.
- `csrf.js`: core CSRF captured passively from `*.exacttarget.com` requests (no way to fetch one); `_csrf` cookie for marketingcloudapps apps.
- `mcaToken.js`: Bearer token minted in an inactive `update-token.json` tab; `content.js` reports `MCA_TOKEN_CAPTURED`. A failed mint backs off for 2 minutes.
- `sessions.js` + `apps.js`: Automation Viewer's per-app session warm-up (inactive landing tab, probe until 200). Apps with `bearer: true` (Automation Studio, Contact Builder meta, Content Builder) get the token; Journey Builder and CloudPages use cookies only. **Not yet checked live in the merged form**, in particular Journey Builder and CloudPages.
- `sessions.js` `warmUpMissing` (message `SFMC_WARM_UP`, sent by `App.vue` when the stack is known): when logged in and at least one app probes 200, starts the other apps one at a time with `ensureSession`; at most every 10 minutes per stack unless `force` (Start missing in the connection menu); off with `_autoStartSessions: false` (Settings > Connection). `sessionStatus` reports `starting` per app. Note that the probe uses cookies only, so a Bearer-only app counts as missing.
- `fetchProxy.js`: the order is Bearer/CSRF → re-read a rotated CSRF after a 403 → re-mint a rejected token once → warm up the app session once → `LOGIN_REQUIRED`. Requests use `redirect: 'manual'`, so a redirect into SSO reads as "no session".

## Tests

`npm test` (vitest, jsdom). `src/background/__tests__/harness.js` loads the service worker modules against a fake `chrome` and a simulated SFMC (per-app sessions, Bearer minting, rotating Content Builder CSRF). Ported from Query Saver's `backgroundStack.test.js` and Automation Viewer's `sfmcAuth.test.js`.

## Porting status

Steps 1 to 6 are done: every section of both extensions is in. Query Saver's info page is under `src/views/info/` but **not routed yet** (step 7); it still imports `./composables/...` paths and link to the old `*.html` pages. Automation Viewer's screens were rewritten from scratch (its source is plain JS in `../sfmc-automation-viewer`; the feature list is in the plan). Step 7 left: Ctrl+K search across records, Features and To do pages, first release.

Queries section notes:
- `WorkspacePage` and `BuilderPage` are kept alive (`<KeepAlive>` in `App.vue`), so a run's polling and a half-built query survive a visit to another section. Never key them on the route.
- Workspace: `?id=`, `?sql=`, `?ws=` are applied by `openInPanel`/`restore` in `useWorkspace.js` and then removed from the URL. The last workspace is remembered in `toolkit_lastWorkspace`. An empty panel takes the opened query; otherwise a panel is added (6 at most).
- Builder: `QueryBuilder.vue` is the old page; `BuilderPage` remounts it (`session` key) for New query or a different `?id=`. The last builder record is in `toolkit_lastBuilder`.
- Workspace panels store a `sql_*` record as soon as they open; Saved queries hides records with no SQL and no runs.
- Emails: `/emails` (list) and `/emails/:id` (versions, preview, revert with a confirm step, delete). Capture happens in `src/background/capture.js`.
- API console: one drawer for the whole app (`components/shell/ApiConsole.vue`, `useApiConsole.js`), on/off in Settings, stored as `sfmcqs_settings.apiConsole`. Pages don't call `setApiLogCallback` themselves.
- Result screens (DE, and Automations, Activities, Journeys, CloudPages next) share `components/results/`: `DataTable` (columns can be hidden, remembered in localStorage `toolkit_cols_<key>`; `expanded` rows), `DownloadMenu` (View/Copy as Markdown, .md, .docx, .html) built on `utils/exportDoc.js` (one document model: `h`, `p`, `kv`, `table`, `code` blocks; Excel via `downloadWorkbook`, SheetJS from its CDN tarball since npm's copy is outdated). Kept-alive pages are listed in `KEEP_ALIVE` in `App.vue`.
- Data Extensions: `utils/deApi.js` (Automation Viewer's contactsmeta endpoints; Shared/Synchronized from Query Saver's catalog in `sfmcApi.js`), `utils/deSql.js` (ticked fields to a SELECT with joins on a shared column name), `utils/batchRunner.js` (10 at a time).
- Where used (dependency analysis, `utils/usage/`): `match.js` (pure: `tablesInSql`, `matchQuery`, `matchField`, `deRefsInCode`/`codeRefsToDE` for AMPscript and SSJS, `contentBlockRefs`, `assetText`, `findValues`/`findPathMentions`/`collectProfileRefs` for JSON of unknown shape, `buildActivityIndex` for every activity type, `lineageEdges`/`lineageTree`), `sources.js` (one loader per kind of SFMC record, with `refresh(saved)` that reads only changes: `deltaList` for lists sorted newest change first, automation steps and journey definitions read again only when their change marker moved, Content Builder deletions found by an ID-only listing: queries, imports, filters, dataextracts, filetransfers, scripts, automations (list plus each one's steps, 10 at a time; SFMC has no reverse lookup), emailsends (type 42 definitions), journeys (list plus each one's definition), events, locations (`/automation/v1/ftplocations/`), assets (Content Builder emails, templates, blocks, CloudPages with their content, up to 5,000)), `kinds.js` (per kind: stages and `analyze` returning sections of items), `store.js` (IndexedDB `toolkit-where-used`, memory fallback; keys `stack:businessUnitId:source`, the BU from `fetchCurrentBU`), `index.js` (`findUsage`: saved under 5 minutes ago is used as is, older is refreshed, none or Rescan reads in full; loads sources one after another, a failing source marks its stage and sections but does not end the scan). UI: `composables/useUsage.js` (one scan for the app, module state, history for Back), `components/usage/UsagePanel.vue` (mounted in `App.vue`, with the top bar pill), `views/data/WhereUsedPage.vue` (pickers). No SOAP: it would need a new host permission. Not checked live: the automation grid's change field (`modifiedDate`, else `lastSavedDate`/`updatedDate`; without one, every automation's steps are read again), list fields (`queryText`, `targetKey`, `fileTransferLocationId`, `script` are fetched per item when missing), the email send definition and Update Contact shapes (matched by value anywhere in the JSON), `ftplocations`, Content Builder `slots`/`blocks` for placed blocks.
- Automations and Activities: `utils/automationApi.js`, `utils/activityTypes.js` (`describeActivity` turns any activity's details into plain data for `ActivityCard` and the exports; fields a type doesn't list go to `extra`; values are text, never HTML), `utils/automationDoc.js`, `utils/ical.js`. Activity details load 4 at a time.
- Journey section: Journeys (`utils/journeys.js`: Journey Builder `interactions` list and detail, `journeyGraph`/`layoutJourney` for the canvas in `components/journey/JourneyCanvas.vue`, `describeJourneyNode`, `describeCriteria` for decision XML, email preview found by legacy email ID in Content Builder; none of these calls checked live yet) and Journey Entry (`utils/journeyApi.js`, event definitions, filtered in the page). Sidebar names: Run Query (route `/queries/workspace`, component WorkspacePage), Saved Emails (`/emails`). CloudPages: `utils/cloudPagesApi.js` (Content Builder asset search; URL from the asset, else the CloudPages sites list).
- Feedback: `components/modals/FeedbackModal.vue` (kind, message, details, screenshot via `utils/screenshot.js` and `components/feedback/ScreenshotEditor.vue`, technical details from `utils/feedbackMeta.js` with a preview; `recentApiErrors()` in `sfmcApi.js` keeps the last 5 failed calls without query strings). Worker in `workers/feedback/` (moved from Query Saver; same name and D1). Its schema change `schema/0002_details_screenshots.sql` must be applied before deploying it. The worker stays compatible with Query Saver 1.4.0's posts.
- Backups: `src/utils/backup.js` (`planImport` never overwrites). Query Saver exports the same format.
- DE storage (feedback #68, 2.0.10): `views/data/DEStoragePage.vue` reads `utils/storageApi.js` (Contact Builder's `mc-data-ui.<stack>.marketingcloudapps.com/fuelapi/data/v1/customobjects/storageDetails` and `storageHistory?startDate=MM-DD-YYYY&endDate=...`, from the user's network log; not checked live through the extension). App `dataUi` in `background/apps.js` has `onDemand: true`: left out of `sessionStatus` and `warmUpMissing` (its cookie probe may never pass, which would open a Contact Builder tab every 10 minutes), started only when a call needs it. When the storage calls fail, `components/storage/RowCountStorage.vue` + `utils/deStorage.js` read row counts per DE instead.
- Overview pages and DE storage keep what they read per stack and BU in `utils/pageCache.js` (module memory, lost when the tab closes; feedback #66).
- Dashboard card (feedback #65, trial): `public/dashboardPanel.js` on `mc.<stack>.exacttarget.com/cloud/#app/Marketing Cloud Dashboard`, setting `_dashboardPanel` (on unless false), collapsed state `_dashboardPanelCollapsed`. Data from `DASHBOARD_SUMMARY` (`background/dashboard.js`, 10-minute cache per stack and BU), using the pure counts in `utils/summaries.js` (shared with `utils/overview.js`).
- `fetchProxy.js` `errorText`: SFMC's HTML error pages (IIS 403 "Not Authorized") become their title in error messages.

Known Automation Viewer bugs not to carry over: Journey "Event Definition Key" filter read the DE-id input; the DE Clear button was bound to the Activity tab's button; activity types 725, 726, 736, 783, 1010, 1101, 1701, 3700 called missing renderers; `escapeHtml` did not escape `&` or quotes.

## Release checklist

The Toolkit ships as an update to the SFMC Query Saver store listing; the user uploads the zip and then tells Claude (record it in `../CLAUDE.md`).

1. Version: `public/manifest.json` and `package.json` (higher than the published one; Query Saver ended at 1.4.0). If the release has news for users, update `WhatsNew.vue` (`VERSION` and the list) and `src/data/features.js` / `todo.js`.
2. Permissions: compare `public/manifest.json` with the published manifest. Any new permission, host or content-script match makes Chrome disable the extension until each user accepts it; tell the user first.
3. `npm test` and `npm run build`.
4. Package from inside `dist/` (manifest at the zip root; Query Saver's Bug 11): `cd dist && zip -qr ../releases/sfmc-toolkit-<version>.zip . -x "*.DS_Store"`. Never delete older zips in `releases/`.
5. Check the zip: `unzip -l releases/sfmc-toolkit-<version>.zip` lists `manifest.json`, `background.js`, `app.html`, `content.js` with no `dist/` prefix; `unzip -p releases/sfmc-toolkit-<version>.zip manifest.json | grep version` shows the new version.
6. Commit the zip, push, and make a GitHub release `v<version>` with it.

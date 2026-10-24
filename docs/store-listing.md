# Chrome Web Store listing: Marketing Cloud Toolkit 2.0.0

Text for the Chrome Web Store dashboard. Marketing Cloud Toolkit is published as a new version of the existing **SFMC Query Saver** item, so update each field of that item.

## Name

Marketing Cloud Toolkit

(The name shown in Chrome comes from `manifest.json`; the store page name is set here.)

## Summary (from the manifest, at most 132 characters)

Run and save SFMC SQL, and explore automations, journeys, data extensions, CloudPages and saved email versions in one place.

## Description

Marketing Cloud Toolkit is a set of tools for Salesforce Marketing Cloud, in one full-tab app. It replaces SFMC Query Saver: if you used Query Saver, your saved queries, run history and email versions are already here.

It works with the Marketing Cloud login you already have in this browser. It never asks for or stores your password.

QUERIES

Saved queries
- Every query you run in Query Studio is saved automatically, with the business unit it ran in.
- Search by name, SQL or business unit; browse by date; mark favourites.
- Preview, copy, share as a link, export and import as CSV.

Run Query
- Write and run up to 6 queries side by side. Each run creates the target data extension and Query Activity for you and shows the results.
- The editor checks SFMC SQL as you type (44 checks, with one-click fixes), suggests data extensions, data views and fields, explains functions on hover, and formats SQL.
- Download results as CSV or Markdown, or copy them ready to paste into an AI assistant.
- Open an existing Query Activity from Automation Studio.

Query Builder
- Build a query by picking data extensions and fields, in a list or on a canvas, with joins, filters, grouping and sorting.

AUTOMATION

Automations
- Find any automation and see its schedule in plain words, its error notifications, and every step.
- See each activity's details: SQL, scripts, imports, extracts, file transfers, filters, email sends and more.
- Viewing an automation never pauses or changes it.

Activities
- List Query, Script, Import, Data Extract, File Transfer and Filter activities, search them, or load them all.

JOURNEY

Journeys
- Find any journey and see it drawn like the Journey Builder canvas, left to right or top to bottom.
- Click a step to see what it does: email subject, preheader and preview; wait times; decision split criteria in plain words; random split shares; every setting.

Journey Entry
- List journey entry events and filter them by name, key, data extension, type, category and journey status.

DATA

Data Extensions
- Search local, Shared and Synchronized data extensions; see folder paths and fields.
- Tick fields in one or more data extensions to build a query that joins them.
- Export names or every field to Excel.

DE storage
- See the GB and rows your data extensions use, day by day, by business unit, and the largest data extensions first.

CONTENT

CloudPages
- Search CloudPages, get their URLs and folder paths, export to Excel.

Saved Emails
- Every time you save an email in Content Builder, a version is kept. Preview any version, and revert the email to it.

ALSO
- Download any result as Markdown, Word or HTML.
- Ctrl+K to jump to a section, open a saved query or email, or search SFMC.
- Light, dark or system theme.
- Back up everything to one file, and restore it on another computer.
- Send feedback with a screenshot you can mark up.

Your queries and emails are stored in your browser only. SFMC calls go straight from the extension to your Marketing Cloud account.

## What's new (for the version notes, if asked)

2.0.12: Sort and filter tables by column, Salesforce blue instead of purple, sidebar order Queries, Data, Automation, Journey, Content, DE storage says when it needs the parent business unit, running automations show a moving bar with the step they are on, icons for statuses and activity types, progress bars on long loads, Saved Activities (versions of SQL Query and Script activities saved in Automation Studio, with compare and restore), View rows of a data extension without a query (CSV, Excel, Markdown), Create DE (paste or upload a sample: CSV, TSV, JSON, Parquet, Excel; or start empty; guessed field types, folder, sendable, retention), searches reconnect an SFMC app with no session and otherwise say which app to log in to, Save as query activity in Run Query (new or existing data extension, folders, data action; never run), results data extension and Query Activity named after a run, Query Builder reorder and swap by dragging, Query Builder search finds every data extension, overviews load in the background, To do page hidden. No new permissions.

2.0.11: renamed to Marketing Cloud Toolkit (update the store name too), connects when SFMC is opened as mc.exacttarget.com, schema search and Cmd/Ctrl+Enter in Run Query, row counts next to data extensions, ENT. for Shared DEs in generated SQL, new tabs open next to the current one, Download menu on Automation overview and Journey overview, Where used steps can be left out or skipped. No new permissions.

2.0.10: DE storage (GB and rows per data extension, storage over time, by business unit), an optional Marketing Cloud Toolkit summary in place of the Marketing Cloud Dashboard page (trial, off by default), overviews kept while you move between sections, feedback remembers your name and email, Query Studio 2 runs saved by default (new site access: Chrome asks users to approve it), and Filter activities no longer fail first. No new permissions.

2.0.7: Automation Summary tab on Automation Studio automation pages (from SFMC Automation Viewer), data view joins in Query Builder filled in straight away.

2.0.6: Automation overview (by status, needs a look, run trends), watch automations (paused, activated, runs, fails) with a bell, a toolbar badge and optional desktop notifications, Journey overview (by status, what live journeys send), saved queries for the current business unit first, CloudPages Get URL for landing pages.

2.0.5: automation run history; four more Automation Templates (Unengaged subscribers, Held and bouncing subscribers, Automation run log, Unsubscribes for CRM).

2.0.4: Settings > Storage by section and business unit (delete one part, keep only the newest email versions), download several or all automations, data extension row counts, templates check their queries with SFMC before creating anything and can delete what a stopped run made, file names with business unit and date, readable journey step settings, and a prompt to restart when an update is ready.

2.0.3: Automation Templates (Orphan contacts, Data view archive): the Toolkit creates the data extensions, queries and automation, and never schedules or runs them. Run a SQL activity from its card, Clean up SFMC for data extensions and queries Run Query created, optional data retention on new data extensions, saving Query Studio 2 runs (optional permission), and fixes to data extension search, Load more automations, Filter activities and the Automation Studio link.

2.0.0:

SFMC Query Saver is now Marketing Cloud Toolkit. Everything you saved is still here. New: Automations, Activities, Journeys (with a journey canvas), Journey Entry, Data Extensions and CloudPages; a full-tab layout with a sidebar; Ctrl+K search; backups; feedback with screenshots; every SQL check can be turned off in Settings.

## Category

Developer Tools (Workflow and Planning also fits). Keep whatever the Query Saver item uses unless you want to change it.

## Single purpose (Privacy practices tab)

Marketing Cloud Toolkit helps Salesforce Marketing Cloud users work with their own account: save, write and run SQL queries, and view automations, journeys, data extensions, CloudPages and saved email versions.

## Permission justifications (Privacy practices tab)

- **storage, unlimitedStorage:** saved queries, their run history, saved email versions and settings are stored locally in the browser; email versions can be large.
- **cookies:** the extension calls Marketing Cloud with the user's existing Marketing Cloud session, and reads Marketing Cloud's own security cookie (CSRF token) to send with requests that change data, such as running a query or reverting an email.
- **webRequest:** to save queries the user runs in Query Studio and emails the user saves in Content Builder, and to read the security token Marketing Cloud attaches to its own requests.
- **tabs:** to open the app in a tab, to tell which Marketing Cloud stack the user is working in from their open Marketing Cloud tabs, and to open a Marketing Cloud page briefly in the background when an app (such as Journey Builder) needs a session.
- **Host permissions:**
  - `*.exacttarget.com`, `*.marketingcloudapps.com`, `*.marketingcloud.com`, `*.salesforce-marketingcloud.com`: Marketing Cloud's own domains, which the extension calls on the user's behalf.
  - `querystudio.herokuapp.com`: Query Studio, to save the queries the user runs there.
  - Optional permission `notifications` (from 2.0.6): requested only when the user turns on Settings > Connection > Desktop notifications for watched automations, to show a desktop notification when a watched automation is paused, activated, runs or fails. Turning the setting off removes the permission.
  - `querystudio2-dev-89f7e4653c61.herokuapp.com` (required from 2.0.10; optional `*.herokuapp.com` in 2.0.3 to 2.0.9): Query Studio 2, to save the queries the user runs there. Settings > Running queries > Save Query Studio 2 runs (on by default) turns the saving off.
  - `sfmc-share-worker.mathes-btech.workers.dev`: creates and opens share links for queries, when the user chooses to share one.
  - `query-saver-feedback.mathes-btech.workers.dev`: receives feedback the user chooses to send.
  - `www.google-analytics.com`: anonymous usage counts (see below).
- **Remote code:** none. All code is in the package.

## Data usage (Privacy practices tab)

- **Website content:** yes. Marketing Cloud content the user views (queries, automations, journeys, emails) is shown and stored locally in the browser. It is not sent anywhere except back to the user's own Marketing Cloud account.
- **Personally identifiable information:** only if the user types a name or email into the feedback form, or includes a screenshot.
- **Usage data:** anonymous events (for example "query run", "app opened") with a random ID, sent to Google Analytics. No SQL, data or names.
- Certify: data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending.

## Screenshots to upload (1280x800 or 640x400)

1. Run Query with two panels and results.
2. Saved queries with the date sidebar.
3. A journey on the canvas with a step's details open.
4. An automation in Full view.
5. Data Extensions with fields ticked and the query below.

## Store icon

Unchanged (`public/images/icon128x128.png`).

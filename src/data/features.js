// Shown on features.html. Only list what the current code actually does; mark
// additions with `since` for one or two releases, then drop the tag.
//
// item: { title, how?, detail, since? }

export const FEATURE_GROUPS = [
  {
    id: 'saved-queries',
    title: 'Saved queries (main page)',
    intro: 'Click the toolbar icon to open the main page in a full tab. If it is already open, that tab is reused.',
    items: [
      {
        title: 'Automatic capture from Query Studio',
        how: 'Automatic',
        detail: 'Every query you run in Query Studio is saved, named with the date and time. The toolbar icon blinks briefly as a cue. On Query Studio pages a small extension icon also appears, which opens this page.',
      },
      {
        title: 'Add a query by hand',
        how: 'The + button in the header',
        detail: 'Enter a name and the SQL.',
      },
      {
        title: 'Search',
        how: 'The magnifier in the header (Esc closes it)',
        detail: 'Matches query names, SQL text and business unit names. Use bu:<name or MID> to filter by business unit.',
      },
      {
        title: 'Date sidebar and business unit filter',
        detail: 'Browse by Today, Yesterday, This Week, Last Week, This Month, Last Month or by month. The sidebar can be resized. A business unit filter appears once queries carry a business unit.',
      },
      {
        title: 'Business unit badge',
        how: 'Automatic',
        detail: 'Queries captured from Query Studio, and queries the first time they run in the Query Workspace, record the business unit you were in. It shows as a badge on the card and feeds the business unit filter.',
        since: '1.4.0',
      },
      {
        title: 'Favourites',
        how: 'The star on a card, then the Favourites pill',
        detail: 'Show only the queries you starred.',
      },
      {
        title: 'Large or compact cards',
        how: 'The Large cards / Compact cards button',
        detail: 'Large cards are wider and show up to 40 lines of SQL instead of 18. The choice is remembered.',
        since: '1.3.0',
      },
      {
        title: 'Quick preview',
        how: 'Click a card',
        detail: 'Shows the full SQL with Copy, Share (a link valid for 24 hours, copied to the clipboard) and Open in editor.',
      },
      {
        title: 'CSV export and import',
        how: 'The download and upload icons in the header',
        detail: 'Export writes Time Saved, Name and Query Text columns. Import reads the same format, skips the header row and any row without SQL, and reports how many queries it added.',
      },
      {
        title: 'Delete several at once',
        how: 'The trash icon in the header',
        detail: 'Tick cards, or use Select all (it covers the cards visible under the current date filter), then Delete.',
      },
      {
        title: 'Settings',
        how: 'The gear in the header',
        detail: 'Turn email saving on or off, set how many seconds apart two saves of the same email must be to count as separate versions (default 5), let a re-run of the same query reuse its last DE and Query Activity, see how much storage is used, or clear all data.',
      },
      {
        title: 'Light and dark theme',
        how: 'The moon icon',
        detail: 'Applies to every page of the extension.',
      },
      {
        title: 'Feedback',
        how: 'The speech bubble on any page',
        detail: 'Send a message, with your name and email if you want a reply. The extension version and the page you are on are included.',
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Query Workspace',
    intro: 'Open it with Run Query on the main page, or Open in editor on a saved query.',
    items: [
      {
        title: 'Up to 6 queries side by side',
        how: 'Layout buttons 1×1, 1×2, 2×2, 2×3 and + Panel',
        detail: 'Each panel has its own editor, validation, run and history, and panels run independently. Drag the borders to resize, or expand one panel to fill the page while the others keep running. The workspace is kept under its own address, so reopening it restores the panels.',
      },
      {
        title: 'Autosave',
        detail: 'SQL is saved half a second after you stop typing, and every non-empty panel appears in the saved queries list.',
      },
      {
        title: 'Rename a panel',
        how: 'The pencil, or double-click the title',
        detail: 'The new name also shows in the saved queries list.',
      },
      {
        title: 'Open a Query Activity from Automation Studio',
        how: 'The folder icon',
        detail: 'Browse your Query Activities by folder, or search across all of them, and load one into the panel.',
      },
      {
        title: 'Share a query',
        how: 'The share icon',
        detail: 'Creates a link that is valid for 24 hours. Only the SQL and its name are shared. Anyone with the extension who opens the link gets the query added to their list.',
      },
      {
        title: 'Validate',
        how: 'The shield icon',
        detail: 'SFMC checks the query and lists errors and warnings. This needs at least one existing Query Activity in the business unit.',
      },
      {
        title: 'Run a query and see the results',
        how: 'The play icon',
        detail: 'Runs in five steps: validate, create the target DE, create the Query Activity, run it and fetch the results. Each step shows its time, links to what it created in SFMC, and can be retried from where it failed. The DE and activity go into QuerySaver folders. Up to 2,500 rows are fetched, and a run gives up after 10 minutes.',
      },
      {
        title: 'Asks before opening Contact Builder',
        how: 'During a run, when SFMC needs a fresh session',
        detail: 'If the DE folder or the new DE cannot be created, the step asks whether to open Contact Builder in a background tab for a few seconds and retry. Before, the tab opened without asking.',
        since: '1.4.0',
      },
      {
        title: 'Fewer "Cannot find table 0" failures',
        how: 'Automatic during a run',
        detail: 'When SFMC cannot see the new target DE yet, creating and starting the Query Activity wait and retry twice before showing a plain explanation. Folder IDs remembered from an earlier run are only reused on the same stack, and are looked up again if they stop working.',
        since: '1.4.0',
      },
      {
        title: 'Field names SFMC would refuse are renamed',
        how: 'Automatic during a run',
        detail: 'Output columns that start with an underscore (such as _ContactKey from a synchronized DE) become t_ContactKey, or t1_, t2_ if that name is taken. Your SQL is not changed, and the Create DE step lists every rename.',
        since: '1.2.7',
      },
      {
        title: 'Better field types in the target DE',
        how: 'Automatic during a run',
        detail: 'Date functions such as GETDATE() and DATEADD() make Date fields, COUNT, DATEDIFF and LEN make Number fields, and columns passed through from a DE or data view keep that field\'s type. Decimal fields get a valid precision (18,2 unless the source says otherwise). Anything unknown is Text(4000), the SFMC maximum, so values are never cut off (it was Text(500) before 1.4.0).',
        since: '1.2.7',
      },
      {
        title: 'Results table',
        detail: '50 rows per page. Download as CSV, and delete the DE or Query Activity a run created when you no longer need it.',
      },
      {
        title: 'Results as Markdown, and Copy for AI',
        how: 'The MD and Copy for AI buttons above the results',
        detail: 'The query name, the SQL and the results as a Markdown table (first 200 rows, with a note when rows are left out), as a file or on the clipboard, ready to paste into Claude or ChatGPT.',
        since: '1.3.0',
      },
      {
        title: 'Run history',
        how: 'The clock icon',
        detail: 'Lists earlier runs of the panel. View results fetches them again from that run\'s DE, as long as the DE still exists.',
      },
    ],
  },
  {
    id: 'editor',
    title: 'SQL editor',
    intro: 'In the Query Workspace and, with fewer features, in the Query Builder.',
    items: [
      {
        title: 'SFMC checks as you type',
        how: 'Underlines and gutter markers; hover to read them',
        detail: 'About 40 rules catch what SFMC rejects or handles badly: more than one statement, variables, temp tables, WITH, a computed column without an alias, duplicate column names, ORDER BY in a subquery without TOP, = NULL, NOT IN with a subquery, a tracking data view without a date filter, functions SFMC does not support, and more. Each message shows its rule code (QS001 and so on). SELECT * is allowed.',
        since: '1.3.0',
      },
      {
        title: 'One-click fixes',
        how: 'The button in a lint message',
        detail: 'For example: add an alias, move a WITH block into the FROM clause, change = NULL to IS NULL, add brackets to a name with spaces, add a 30-day date filter to a tracking data view, or give DECIMAL a precision.',
        since: '1.3.0',
      },
      {
        title: 'Turn off a check',
        how: 'Turn off QSxxx in a lint message; turn it back on in Settings (gear) under Turned-off lint rules',
        detail: 'Hides one rule everywhere, for example one that warns about a pattern you use on purpose.',
        since: '1.4.0',
      },
      {
        title: 'Unknown table check',
        detail: 'A table in FROM or JOIN that the Data Extension lookup confirms does not exist in this business unit is marked as an error. Shared ENT. tables and lookups that fail for other reasons are never flagged.',
        since: '1.4.0',
      },
      {
        title: 'Insert all fields',
        how: 'The list button in the panel toolbar, or "All fields of …" in autocomplete (after alias. it shows as *)',
        detail: 'Writes the full column list of a DE or data view. Pick a table in the query or search for one. It replaces * or alias.* for that table, inserts at the cursor otherwise, and in an empty editor writes the whole query.',
        since: '1.4.0',
      },
      {
        title: 'Autocomplete',
        how: 'Type, or press Ctrl+Space',
        detail: 'After FROM or JOIN it suggests data views and your Data Extensions, found with the DE search as you type, including Data Extensions under Shared Items and Synchronized Data Extensions. After alias. it suggests that table\'s fields. It also suggests SFMC functions and known values for some data view fields, such as _Subscribers.Status.',
        since: '1.3.0',
      },
      {
        title: 'Hover help and parameter hints',
        detail: 'Hover a function, data view or field to see what it is, with SFMC-specific notes. Inside a function\'s brackets, its parameters are shown.',
        since: '1.3.0',
      },
      {
        title: 'Format SQL',
        how: 'The format button in the panel toolbar, or Shift+Alt+F',
        detail: 'Lays the query out with upper-case keywords and indentation. If formatting would change anything other than layout, the query is left as it was and a note says so.',
        since: '1.3.0',
      },
    ],
  },
  {
    id: 'builder',
    title: 'Query Builder (experimental)',
    intro: 'Open it with Query Builder on the main page. It builds SQL from Data Extensions without typing it.',
    items: [
      {
        title: 'Pick tables',
        detail: 'Browse your DE folders, search all DEs, or pick a data view. Click to add one, or drag it onto the canvas in Visual mode.',
      },
      {
        title: 'List mode',
        detail: 'Four steps: joins (INNER or LEFT, with conditions), output fields, filters (WHERE), and options (DISTINCT, TOP, GROUP BY, ORDER BY, and computed columns such as COUNT or SUM).',
      },
      {
        title: 'Visual mode',
        detail: 'Arrange tables on a canvas and join them by clicking a field on one table and then a field on the other. Joins can be inner, left, right or full, with several conditions.',
      },
      {
        title: 'Generated SQL',
        detail: 'Shown in a panel you can dock right or bottom, or hide, and edit by hand. Copy it, Save it to your list (it reopens in the Builder), or send it to the Query Workspace to run. Your work is saved automatically.',
      },
    ],
  },
  {
    id: 'emails',
    title: 'Email version history',
    intro: 'On the Emails tab of the main page. Turn it on or off in Settings.',
    items: [
      {
        title: 'Every Content Builder save is kept',
        how: 'Automatic when you save an email in Content Builder',
        detail: 'Each save becomes a version. Saves of the same email closer together than the time set in Settings count as one.',
      },
      {
        title: 'Browse and compare versions',
        how: 'Click an email card',
        detail: 'Pick any version to preview it with its subject line. Delete versions you do not need.',
      },
      {
        title: 'Revert to an earlier version',
        how: 'Revert to this version',
        detail: 'Writes that version back to Content Builder. Refresh the email in Content Builder to see it. Emails saved before version history existed cannot be reverted.',
      },
    ],
  },
  {
    id: 'connection',
    title: 'Connection to SFMC',
    items: [
      {
        title: 'Connection status',
        how: 'The status pill in the page header',
        detail: 'Shows your SFMC stack and whether the extension is ready to run queries. It needs you to be logged in to SFMC in this browser; the token Automation Studio and Content Builder need is fetched for you in a hidden background tab.',
      },
      {
        title: 'Choose the stack',
        how: 'Open the status pill and use the Stack list',
        detail: 'The extension picks the stack of the SFMC tab you used most recently. If it picks the wrong one, choose the right stack from the list, or enter it under Other. A chosen stack shows as pinned; pick Automatic to go back. Open pages switch straight away.',
        since: '1.3.0',
      },
      {
        title: 'What is sent where',
        detail: 'Queries and emails are stored in your browser only. SFMC calls go straight from the extension to your SFMC account. Shared links and feedback go to the extension\'s own Cloudflare workers, and anonymous usage events (such as a query run) go to Google Analytics.',
      },
    ],
  },
]

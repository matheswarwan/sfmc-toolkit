// Shown on the Features page (#/features). Only list what the current code does;
// mark additions with `since` for one or two releases, then drop the tag.
//
// item: { title, how?, detail, since? }

export const FEATURE_GROUPS = [
  {
    id: 'general',
    title: 'Getting around',
    intro: 'SFMC Toolkit replaces SFMC Query Saver and includes everything SFMC Automation Viewer did. Click the toolbar icon to open it in a new tab.',
    items: [
      { title: 'Sections in the sidebar', detail: 'Queries (Saved queries, Run Query, Query Builder), Automation (Automations, Activities), Journey (Journeys, Journey Entry), Data (Data Extensions) and Content (CloudPages, Saved Emails). Collapse the sidebar to icons with Collapse.' },
      { title: 'Search everything', how: 'Ctrl+K (Cmd+K on a Mac), or Search in the top bar', detail: 'Jump to a section, open a saved query or a saved email, or start a search for data extensions, automations, activities, CloudPages or journey entry events.' },
      { title: 'Several tabs', detail: 'Each click on the toolbar icon opens a new tab, and Ctrl-click opens a section in a new tab. Two tabs never edit the same workspace or Query Builder query.' },
      { title: 'Results 50 at a time', detail: 'Every SFMC search (data extensions, automations, activities, journeys, journey entry events, CloudPages) shows the first 50 results; Load 50 more shows the next.' },
      { title: 'Results stay put', detail: 'Search results in Data Extensions, Automations, Activities, Journeys, Journey Entry and CloudPages, and a running query in Run Query, are kept while you visit other sections.' },
      { title: 'Download any result', how: 'Download on a result screen', detail: 'View or copy as Markdown (ready to paste into Claude or another assistant), or download Markdown, Word or HTML. Data Extensions and CloudPages also export to Excel.' },
      { title: 'Light, dark or system theme', how: 'The moon icon, or Settings', detail: 'System follows your computer.' },
      { title: 'Feedback', how: 'The speech bubble in the top bar', detail: 'Say what happened (or your idea), add details, and attach a screenshot: of this page, of another tab or window such as SFMC, or an image you upload or paste. Draw boxes or freehand on it to point at the problem or cover anything private. Technical details (version, browser, section, stack, business unit, the last failed SFMC calls; never SQL or data) are included unless you untick them, and you can see exactly what is sent.' },
    ],
  },
  {
    id: 'saved-queries',
    title: 'Saved queries',
    intro: 'Queries > Saved queries.',
    items: [
      { title: 'Automatic capture from Query Studio', how: 'Automatic', detail: 'Every query you run in Query Studio is saved, named with the date and time, with the business unit you were in. New captures appear without a reload.' },
      { title: 'Search and filters', detail: 'Search names, SQL and business unit names; bu:<name or MID> filters by business unit. Browse by Today, Yesterday, This Week and so on in the sidebar, filter by business unit, or show only favourites.' },
      { title: 'Quick preview', how: 'Click a card', detail: 'See the full SQL, copy it, share it (a link valid for 24 hours), or open it in Run Query or the Query Builder.' },
      { title: 'Add, import and export', how: 'The +, export and import buttons', detail: 'Add a query by hand, or export and import queries as CSV.' },
      { title: 'Large or compact cards, delete several', detail: 'Switch card size to see more SQL, and select several queries to delete at once.' },
    ],
  },
  {
    id: 'workspace',
    title: 'Run Query',
    intro: 'Queries > Run Query in the sidebar, or Open in editor on a saved query. It keeps running while you use other sections.',
    items: [
      {
        title: 'Up to 6 queries side by side',
        how: 'Layout buttons 1×1, 1×2, 2×2, 2×3 and + Panel',
        detail: 'Each panel has its own editor, validation, run and history, and panels run independently. Drag the borders to resize, or expand one panel to fill the page while the others keep running. Your panels reopen when you come back; Start fresh begins with one empty panel. Each browser tab keeps its own panels.',
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
        detail: 'Runs in five steps: validate, create the target DE, create the Query Activity, run it and fetch the results. Each step shows its time, links to what it created in SFMC, and can be retried from where it failed. The DE and activity go into QuerySaver folders (the name is kept from SFMC Query Saver). The first 2,500 rows are shown; Load next 2,500 and Load all (up to 50,000) fetch the rest. A run gives up after 10 minutes.',
      },
      {
        title: 'Asks before opening Contact Builder',
        how: 'During a run, when SFMC needs a fresh session',
        detail: 'If the DE folder or the new DE cannot be created, the step asks whether to open Contact Builder in a background tab for a few seconds and retry. Before, the tab opened without asking.',
      },
      {
        title: 'Fewer "Cannot find table 0" failures',
        how: 'Automatic during a run',
        detail: 'When SFMC cannot see the new target DE yet, creating and starting the Query Activity wait and retry twice before showing a plain explanation. Folder IDs remembered from an earlier run are only reused on the same stack, and are looked up again if they stop working.',
      },
      {
        title: 'Field names SFMC would refuse are renamed',
        how: 'Automatic during a run',
        detail: 'Output columns that start with an underscore (such as _ContactKey from a synchronized DE) become t_ContactKey, or t1_, t2_ if that name is taken. Your SQL is not changed, and the Create DE step lists every rename.',
      },
      {
        title: 'Better field types in the target DE',
        how: 'Automatic during a run',
        detail: 'Date functions such as GETDATE() and DATEADD() make Date fields, COUNT, DATEDIFF and LEN make Number fields, and columns passed through from a DE or data view keep that field\'s type. Decimal fields get a valid precision (18,2 unless the source says otherwise). Anything unknown is Text(4000), the SFMC maximum, so values are never cut off (it was Text(500) before 1.4.0).',
      },
      {
        title: 'Results table',
        detail: '50 rows per page. Download as CSV, and delete the DE or Query Activity a run created when you no longer need it.',
      },
      {
        title: 'Results as Markdown, and Copy for AI',
        how: 'The MD and Copy for AI buttons above the results',
        detail: 'The query name, the SQL and the results as a Markdown table (first 200 rows, with a note when rows are left out), as a file or on the clipboard, ready to paste into Claude or ChatGPT.',
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
    intro: 'In Run Query and, with fewer features, in the Query Builder.',
    items: [
      {
        title: 'SFMC checks as you type',
        how: 'Underlines and gutter markers; hover to read them',
        detail: 'About 40 rules catch what SFMC rejects or handles badly: more than one statement, variables, temp tables, WITH, a computed column without an alias, duplicate column names, ORDER BY in a subquery without TOP, = NULL, NOT IN with a subquery, a tracking data view without a date filter, functions SFMC does not support, and more. Each message shows its rule code (QS001 and so on). SELECT * is allowed.',
      },
      {
        title: 'One-click fixes',
        how: 'The button in a lint message',
        detail: 'For example: add an alias, move a WITH block into the FROM clause, change = NULL to IS NULL, add brackets to a name with spaces, add a 30-day date filter to a tracking data view, or give DECIMAL a precision.',
      },
      {
        title: 'Turn checks on or off',
        how: 'Turn off QSxxx in a lint message, or Settings > Running queries > SQL checks',
        detail: 'Settings lists every check with a switch and a search box; Turn all on puts them all back. A check that is off is off in every panel and tab.',
      },
      {
        title: 'Unknown table check',
        detail: 'A table in FROM or JOIN that the Data Extension lookup confirms does not exist in this business unit is marked as an error. Shared ENT. tables and lookups that fail for other reasons are never flagged.',
      },
      {
        title: 'Insert all fields',
        how: 'The list button in the panel toolbar, or "All fields of …" in autocomplete (after alias. it shows as *)',
        detail: 'Writes the full column list of a DE or data view. Pick a table in the query or search for one. It replaces * or alias.* for that table, inserts at the cursor otherwise, and in an empty editor writes the whole query.',
      },
      {
        title: 'Autocomplete',
        how: 'Type, or press Ctrl+Space',
        detail: 'After FROM or JOIN it suggests data views and your Data Extensions, found with the DE search as you type, including Data Extensions under Shared Items and Synchronized Data Extensions. After alias. it suggests that table\'s fields. It also suggests SFMC functions and known values for some data view fields, such as _Subscribers.Status.',
      },
      {
        title: 'Hover help and parameter hints',
        detail: 'Hover a function, data view or field to see what it is, with SFMC-specific notes. Inside a function\'s brackets, its parameters are shown.',
      },
      {
        title: 'Format SQL',
        how: 'The format button in the panel toolbar, or Shift+Alt+F',
        detail: 'Lays the query out with upper-case keywords and indentation. If formatting would change anything other than layout, the query is left as it was and a note says so.',
      },
    ],
  },
  {
    id: 'builder',
    title: 'Query Builder (experimental)',
    intro: 'Queries > Query Builder in the sidebar. It builds SQL from Data Extensions without typing it.',
    items: [
      {
        title: 'Pick tables',
        detail: 'Browse your DE folders, search all DEs, or pick a data view. Click to add one, or drag it onto the canvas in Visual mode. Data views are joined the way SFMC documents them (for example _Journey to _JourneyActivity on VersionID, _JourneyActivity to _Sent on JourneyActivityObjectID = TriggererSendDefinitionObjectID, tracking views on JobID, ListID, BatchID and SubscriberID).',
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
        detail: 'Shown in a panel you can dock right or bottom, or hide, and edit by hand. Copy it, Save it to Saved queries (it reopens in the Builder), or send it to Run Query. Your work is saved automatically, and the query you were building reopens; New query starts another.',
      },
    ],
  },
  {
    id: 'automations',
    title: 'Automations',
    intro: 'Automation > Automations. Viewing an automation never pauses or changes it.',
    items: [
      { title: 'Find an automation', detail: 'Search by name, or list all, most recently run first, with status, last run and modified date. Hide columns you do not need.' },
      { title: 'Overview, schedule and notifications', detail: 'Key, status and last run; the schedule in plain words (for example Every 2 weeks on Monday) with the next run; and who gets error notifications.' },
      { title: 'Overview and Full view', detail: 'Overview shows the steps side by side, like Automation Studio; click an activity for its details. Full view lists every activity with its details, SQL and scripts highlighted, and Show additional details for the rest.' },
      { title: 'Every activity type', detail: 'Queries, scripts, imports, data extracts, file transfers, filters, email sends, waits, journeys and every other type. Types SFMC has no API for show what the automation step holds.' },
      { title: 'Download the automation', detail: 'The whole automation, with every activity\'s details, as Markdown, Word or HTML.' },
    ],
  },
  {
    id: 'activities',
    title: 'Activities',
    intro: 'Automation > Activities.',
    items: [
      { title: 'Activities by type', detail: 'Query, Script, Import, Data Extract, File Transfer and Filter. Search by name, list all (newest first), or Fetch all to load every one (up to 2,000).' },
      { title: 'Details for each', detail: 'The same details as in an automation, with All fields to show every property. Filters can load their filter definitions.' },
    ],
  },
  {
    id: 'data-extensions',
    title: 'Data Extensions',
    intro: 'Data > Data Extensions.',
    items: [
      { title: 'Find data extensions', detail: 'Search by name or list all, newest first, 50 at a time (Load 50 more for the next). Data extensions under Shared Items and Synchronized Data Extensions are added as soon as they are found, tagged, in date order. Hide system DEs (such as QueryStudioResults) with one tick.' },
      { title: 'Download chosen data extensions', how: 'Tick rows, then Download or Excel', detail: 'With rows ticked, Download (Markdown, Word, HTML) and Excel cover only those data extensions, with their fields. With none ticked they cover everything shown.' },
      { title: 'Folders and fields', detail: 'Get a DE\'s folder path, or all of them; open its fields, or View all fields to open every listed DE (10 at a time, with a progress bar and Stop).' },
      { title: 'Where used', how: 'Where used on a data extension\'s row', detail: 'Lists the SQL Query activities that write to the data extension (it is their target, with the update type) or read from it (FROM or JOIN, including ENT. and subqueries, ignoring comments), and the automations and steps each query runs in, with their status and last run. A Process panel shows each step with a progress bar; the scan carries on if you close the panel or open another section, and the next data extension reuses what was loaded for 30 minutes (Rescan reloads). Current business unit only.' },
      { title: 'Build a query from fields', how: 'Tick fields in one or more DEs', detail: 'Writes a SELECT that joins the DEs on a column name they share (and says so when it had to guess). Run it in Run Query or copy it.' },
      { title: 'Excel export', detail: 'Names only, or every field of every DE (one sheet each), with folder paths if you want them.' },
    ],
  },
  {
    id: 'journeys',
    title: 'Journeys',
    intro: 'Journey > Journeys. Viewing a journey never changes it.',
    items: [
      { title: 'Find a journey', detail: 'Search by name or description, or list all, most recently changed first; filter by status. Shows status, version and dates.' },
      { title: 'The journey canvas', how: 'View on a journey', detail: 'The journey drawn like Journey Builder: entry, every step and every path, with the path names on the arrows. Switch between Horizontal and Vertical; the choice is remembered.' },
      { title: 'What each step does', how: 'Click a step', detail: 'Emails show their subject, preheader and a preview from Content Builder; waits their duration or date; decision and random splits each path with its criteria or share; every step all of its settings.' },
      { title: 'Download the journey', detail: 'Every step with its settings, goals and exit criteria, as Markdown, Word or HTML.' },
    ],
  },
  {
    id: 'journey-entry',
    title: 'Journey Entry',
    intro: 'Journey > Journey Entry lists journey entry events (event definitions).',
    items: [
      { title: 'Every entry event', detail: 'Loads up to 1,000 when you open the section; Refresh loads them again.' },
      { title: 'Filters', detail: 'Name, event definition key, data extension name or ID, type, category, journey status, and scheduled today or later.' },
    ],
  },
  {
    id: 'cloudpages',
    title: 'CloudPages',
    intro: 'Content > CloudPages.',
    items: [
      { title: 'Find CloudPages', detail: 'Search by name, content or key, or list all. Hide unpublished or system pages.' },
      { title: 'URLs and folders', detail: 'Get each page\'s public URL and folder path, one by one or for every listed page.' },
      { title: 'Excel export', detail: 'Name, key, type, status, asset ID, URL and dates, with folder paths if you want them.' },
    ],
  },
  {
    id: 'emails',
    title: 'Email versions',
    intro: 'Content > Saved Emails. Turn saving on or off in Settings.',
    items: [
      { title: 'Every Content Builder save is kept', how: 'Automatic', detail: 'Each save of an email becomes a version. Saves closer together than the time set in Settings count as one.' },
      { title: 'Preview and delete versions', how: 'Click an email', detail: 'Pick any version to preview it with its subject line, and delete versions you do not need.' },
      { title: 'Revert to an earlier version', how: 'Revert to this version, then confirm', detail: 'Writes that version back to Content Builder; reload the email there to see it. Emails saved before version history existed cannot be reverted.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings and connection',
    items: [
      { title: 'Connection menu', how: 'The stack pill in the top bar', detail: 'Shows your stack, business unit and whether the app token is ready. App sessions lists Automation Studio, Data Extensions, Content Builder, CloudPages and Journey Builder; sessions start automatically when needed, and Connect starts one now. Pin a stack if the wrong one is picked.' },
      { title: 'Backup', how: 'Settings > Backup', detail: 'Export everything (queries with run history, email versions, workspaces, settings) as one file, or import one from SFMC Toolkit or SFMC Query Saver. Import never overwrites what is already here.' },
      { title: 'API console', how: 'Settings > Troubleshooting', detail: 'Shows every SFMC call and its response at the bottom of the window, to download or send with feedback when something fails.' },
      { title: 'What is sent where', detail: 'Queries and emails are stored in your browser only. SFMC calls go straight from the extension to your SFMC account using your login; nothing is stored about your credentials. Shared links and feedback go to the extension\'s own Cloudflare workers, and anonymous usage events (such as a query run) go to Google Analytics.' },
    ],
  },
]
